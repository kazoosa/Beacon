import { Router } from "express";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library.js";
import { requireDeveloper } from "../middleware/authJwt.js";
import { prisma } from "../db.js";
import { Errors } from "../utils/errors.js";
import { logger } from "../logger.js";
import {
  previewCsv,
  previewActivityCsv,
  importCsv,
  detectBroker,
  detectCsvKind,
  BROKER_LABELS,
  type Broker,
} from "../services/csvImportService.js";

const router = Router();
router.use(requireDeveloper);

const BROKER_ENUM = z.enum([
  "fidelity",
  "schwab",
  "vanguard",
  "robinhood",
  "td_ameritrade",
  "webull",
  "ibkr",
]);

const PreviewBody = z.object({
  broker: BROKER_ENUM,
  csv: z.string().min(10, "CSV content is empty"),
});

const ImportBody = z.object({
  // broker is now optional — the handler falls back to detectBroker()
  broker: BROKER_ENUM.optional(),
  csv: z.string().min(10, "CSV content is empty"),
});

const DetectBody = z.object({
  csv: z.string().min(10, "CSV content is empty"),
});

/** List supported brokers with their labels. */
router.get("/brokers", (_req, res) => {
  res.json({
    brokers: Object.entries(BROKER_LABELS).map(([key, label]) => ({
      key,
      label,
    })),
  });
});

/**
 * Detect the broker from CSV headers — used by the import UI to
 * pre-select the right parser without bothering the user. Returns
 * `{ broker: null, reason }` when detection is inconclusive; the UI
 * then falls back to a manual picker.
 */
router.post("/detect", (req, res, next) => {
  try {
    const { csv } = DetectBody.parse(req.body);
    const broker = detectBroker(csv);
    if (broker) {
      return res.json({ broker, label: BROKER_LABELS[broker] });
    }
    return res.json({
      broker: null,
      reason: "unrecognized" as const,
      message:
        "Couldn't identify this CSV format — please pick the broker manually.",
    });
  } catch (e) {
    next(e);
  }
});

/** Parse a CSV without saving — used for the preview step. */
router.post("/preview", async (req, res, next) => {
  try {
    const { broker, csv } = PreviewBody.parse(req.body);
    const kind = detectCsvKind(csv) ?? "positions";
    if (kind === "activity") {
      const activities = previewActivityCsv(broker as Broker, csv);
      const byType: Record<string, number> = {};
      for (const a of activities) byType[a.type] = (byType[a.type] ?? 0) + 1;
      res.json({
        broker,
        broker_label: BROKER_LABELS[broker as Broker],
        kind,
        groups: [],
        total_holdings: 0,
        total_value: 0,
        total_transactions: activities.length,
        transaction_counts: byType,
      });
      return;
    }
    const groups = previewCsv(broker as Broker, csv);
    const totalHoldings = groups.reduce((s, g) => s + g.positions.length, 0);
    const totalValue = groups.reduce(
      (s, g) => s + g.positions.reduce((t, p) => t + p.quantity * p.price, 0),
      0,
    );
    res.json({
      broker,
      broker_label: BROKER_LABELS[broker as Broker],
      kind,
      groups,
      total_holdings: totalHoldings,
      total_value: totalValue,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Commit the parsed CSV into the user's portfolio.
 *
 * `broker` may be omitted — the handler runs `detectBroker()` as a
 * fallback. If detection still fails, the caller gets a typed 400
 * asking them to specify it manually.
 */
router.post("/import", async (req, res, next) => {
  try {
    const parsed = ImportBody.parse(req.body);
    const csv = parsed.csv;
    let broker: Broker | undefined = parsed.broker;

    if (!broker) {
      const detected = detectBroker(csv);
      if (!detected) {
        return res.status(400).json({
          error_type: "VALIDATION_ERROR",
          error_code: "BROKER_REQUIRED",
          error_message:
            "Couldn't detect broker from this CSV — please specify manually.",
        });
      }
      broker = detected;
    }

    // Request-context log right before the heavy work begins — makes
    // the Render log a one-line record of exactly what was attempted
    // even when the subsequent import fails.
    logger.info(
      {
        developerId: req.developerId,
        broker,
        csvBytes: csv.length,
      },
      "csv import request",
    );

    const dev = await prisma.developer.findUnique({ where: { id: req.developerId! } });
    if (!dev) throw Errors.unauthorized();
    const result = await importCsv(dev, broker, csv);
    return res.json({ ...result, broker, broker_label: BROKER_LABELS[broker] });
  } catch (e) {
    // If a 200 has already been sent (e.g., a downstream side-effect
    // like cache invalidation throws after res.json), do NOT call next()
    // — that double-fires the response and causes the client to see a
    // 500 even though the underlying import committed. This was the
    // reported "added the data but threw a 500" symptom.
    if (res.headersSent) {
      logger.error({ err: e }, "csv import: error after response sent — ignored");
      return;
    }
    // Normalise known Prisma errors at the route level so incidental
    // calls (developer.findUnique, etc.) don't leak through the global
    // error handler as a generic 500 "Internal server error". Genuine
    // unknown bugs still surface as 500 so they remain diagnosable.
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        const target = Array.isArray(e.meta?.target)
          ? (e.meta!.target as string[]).join(", ")
          : String(e.meta?.target ?? "");
        return next(
          Errors.badRequest(
            `Your CSV has duplicate rows for ${target || "a row"} — combine lots into one row and retry.`,
          ),
        );
      }
    }
    return next(e);
  }
});

export default router;
