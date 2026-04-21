import { Router } from "express";
import { z } from "zod";
import { requireDeveloper } from "../middleware/authJwt.js";
import { prisma } from "../db.js";
import { Errors } from "../utils/errors.js";
import {
  previewCsv,
  importCsv,
  BROKER_LABELS,
  type Broker,
} from "../services/csvImportService.js";

const router = Router();
router.use(requireDeveloper);

const Body = z.object({
  broker: z.enum(["fidelity", "schwab", "vanguard", "robinhood"]),
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

/** Parse a CSV without saving — used for the preview step. */
router.post("/preview", async (req, res, next) => {
  try {
    const { broker, csv } = Body.parse(req.body);
    const groups = previewCsv(broker as Broker, csv);
    const totalHoldings = groups.reduce((s, g) => s + g.positions.length, 0);
    const totalValue = groups.reduce(
      (s, g) => s + g.positions.reduce((t, p) => t + p.quantity * p.price, 0),
      0,
    );
    res.json({
      broker,
      broker_label: BROKER_LABELS[broker as Broker],
      groups,
      total_holdings: totalHoldings,
      total_value: totalValue,
    });
  } catch (e) {
    next(e);
  }
});

/** Commit the parsed CSV into the user's portfolio. */
router.post("/import", async (req, res, next) => {
  try {
    const { broker, csv } = Body.parse(req.body);
    const dev = await prisma.developer.findUnique({ where: { id: req.developerId! } });
    if (!dev) throw Errors.unauthorized();
    const result = await importCsv(dev, broker as Broker, csv);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
