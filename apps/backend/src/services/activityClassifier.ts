/**
 * Single source of truth for mapping a raw broker activity label onto
 * our transaction type vocabulary. Both the CSV importer (Fidelity's
 * `Action` column) and the SnapTrade sync (`type` / `action` field)
 * route through this classifier so the two import paths stay in sync
 * — historically they drifted apart and each had its own allow-list
 * with different blind spots.
 *
 * Callers must upper-case the raw label first (or let the classifier
 * do it — both forms are supported) and handle a `null` return by
 * logging and skipping the row, never by throwing. Unknown actions
 * are safe to extend; reorg/split events are intentionally skipped
 * until the schema grows a dedicated type for them.
 */

export type ActivityType = "buy" | "sell" | "dividend" | "interest" | "fee" | "transfer";

export function classifyActivity(rawLabel: string | null | undefined): ActivityType | null {
  if (!rawLabel) return null;
  const a = String(rawLabel).trim().toUpperCase();
  if (!a) return null;

  // Reinvestment FIRST — DRIP/REI/REINVESTMENT would otherwise match
  // "INVESTMENT"-less dividend keywords if ordered wrong. Reinvested
  // dividends create new share lots, so they are modelled as buys for
  // cost-basis purposes (SnapTrade and Fidelity both model them that
  // way in their APIs).
  if (a.includes("REINVEST") || a === "REI" || a === "DRIP") return "buy";

  // Capital gain distributions from mutual funds behave like dividends
  // for reporting purposes. Catch both "CAPITAL GAIN" and the shorter
  // "CAP GAIN" / "CAP GN" that some exports use.
  if (a.includes("CAPITAL GAIN") || a.includes("CAP GAIN") || a.includes("CAP GN"))
    return "dividend";

  if (a.includes("DIVIDEND") || a === "DIV" || a === "CASH_DIVIDEND" || a === "STOCK_DIVIDEND")
    return "dividend";

  if (a.includes("BOUGHT") || a === "BUY" || a === "PURCHASED" || a === "PURCHASE") return "buy";
  if (a.includes("SOLD") || a === "SELL" || a === "SALE") return "sell";

  if (a.includes("INTEREST")) return "interest";

  if (a.includes("FEE") || a === "TAX" || a.includes("COMMISSION")) return "fee";

  if (
    a.includes("CONTRIBUTION") ||
    a.includes("WITHDRAWAL") ||
    a.includes("TRANSFER") ||
    a === "DEPOSIT" ||
    a === "TRANSFER_IN" ||
    a === "TRANSFER_OUT"
  )
    return "transfer";

  return null;
}
