import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchHistory,
  getLastError,
  isValidSymbol,
  normalizeSymbol,
  setCors,
  type HistoryRange,
} from "../../_lib/yahoo.js";

const VALID_RANGES = ["1d", "5d", "1mo", "3mo", "1y", "max"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(
    setCors({ "Cache-Control": "s-maxage=300, stale-while-revalidate=600" }),
  )) {
    res.setHeader(k, v);
  }

  const raw = String(req.query.symbol ?? "").trim();
  const symbol = normalizeSymbol(raw);
  if (!isValidSymbol(symbol)) {
    return res.status(400).json({ error: "INVALID_SYMBOL" });
  }
  const rangeParam = String(req.query.range ?? "1mo");
  if (!VALID_RANGES.includes(rangeParam as (typeof VALID_RANGES)[number])) {
    return res.status(400).json({ error: "INVALID_RANGE" });
  }
  const range = rangeParam as HistoryRange;

  try {
    const history = await fetchHistory(symbol, range);
    if (history.isFallback) {
      res.setHeader(
        "X-Yahoo-Debug",
        (getLastError() ?? "null").replace(/[\r\n\t]+/g, " ").slice(0, 400),
      );
    }
    return res.status(200).json(history);
  } catch (err) {
    console.error("[api/stocks/history] failed:", err);
    return res
      .status(500)
      .json({ error: "FETCH_FAILED", message: err instanceof Error ? err.message : "" });
  }
}
