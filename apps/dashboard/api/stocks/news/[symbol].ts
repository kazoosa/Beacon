import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchNews,
  isValidSymbol,
  normalizeSymbol,
  setCors,
} from "../../_lib/yahoo.js";

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

  try {
    const items = await fetchNews(symbol, 10);
    return res.status(200).json({ symbol, items });
  } catch (err) {
    console.error("[api/stocks/news] failed:", err);
    return res
      .status(500)
      .json({ error: "FETCH_FAILED", message: err instanceof Error ? err.message : "" });
  }
}
