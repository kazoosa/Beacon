import { describe, it, expect } from "vitest";
import { previewActivityCsv } from "../src/services/csvImportService.js";
import { parseOptionSymbol } from "../src/services/optionSymbolParser.js";

/**
 * Validates the parser → classifier handoff that feeds the lifecycle
 * replay logic. The actual DB writes (synthetic InvestmentTransaction,
 * underlying mutation, holding zeroing) need Postgres and live in the
 * integration suite; this file pins the pure-logic surface that
 * decides:
 *
 *   * which broker action labels become which ActivityType
 *   * the option ticker is preserved verbatim through the pipeline
 *     so the importer can look up the OptionContract
 *   * the option spec resolvable from each lifecycle row's ticker
 *     (multiplier, strike, underlying — the fields the cash + share
 *     legs need to compute the correct dollars and shares moved)
 */

const FIDELITY_OPTION_LIFECYCLE = [
  "Run Date,Account,Action,Symbol,Description,Quantity,Price,Commission,Fees,Amount,Settlement Date",
  // Open: long call buy
  '01/05/2026,X12345,YOU BOUGHT, -AAPL260117C200,AAPL JAN 17 2026 $200 CALL,1,$8.50,$0.65,$0.00,-$850.65,01/07/2026',
  // Open: short put sell-to-open
  '01/15/2026,X12345,YOU SOLD, -SPY260219P500,SPY FEB 19 2026 $500 PUT,-2,$5.00,$1.30,$0.00,$998.70,01/17/2026',
  // Lifecycle: long call expires worthless
  '01/17/2026,X12345,EXPIRED, -AAPL260117C200,AAPL JAN 17 2026 $200 CALL,-1,$0.00,$0.00,$0.00,$0.00,01/17/2026',
  // Lifecycle: short put assigned (cash debits, underlying shares received)
  '02/19/2026,X12345,ASSIGNED, -SPY260219P500,SPY FEB 19 2026 $500 PUT,2,$0.00,$0.00,$0.00,-$100000.00,02/19/2026',
  // Lifecycle: short call exercised against
  '03/01/2026,X12345,YOU SOLD, -TSLA260320C300,TSLA MAR 20 2026 $300 CALL,-1,$15.00,$1.30,$0.00,$1498.70,03/03/2026',
  '03/20/2026,X12345,EXERCISED, -TSLA260320C300,TSLA MAR 20 2026 $300 CALL,1,$0.00,$0.00,$0.00,$30000.00,03/20/2026',
].join("\n");

describe("Fidelity option lifecycle → classifier", () => {
  const acts = previewActivityCsv("fidelity", FIDELITY_OPTION_LIFECYCLE);

  it("classifies the open + lifecycle rows correctly", () => {
    const types = acts.map((a) => a.type);
    // 2 buys (the LONG call open + a sell-to-close that's actually a buy
    // direction-wise but we labeled YOU BOUGHT / YOU SOLD honestly above)
    expect(types.filter((t) => t === "buy")).toHaveLength(1);
    expect(types.filter((t) => t === "sell")).toHaveLength(2);
    expect(types.filter((t) => t === "option_expired")).toHaveLength(1);
    expect(types.filter((t) => t === "option_assigned")).toHaveLength(1);
    expect(types.filter((t) => t === "option_exercised")).toHaveLength(1);
  });

  it("preserves the option ticker through the pipeline so the OptionContract lookup works downstream", () => {
    const expired = acts.find((a) => a.type === "option_expired")!;
    expect(expired.ticker).toBe("-AAPL260117C200");
    const meta = parseOptionSymbol(expired.ticker);
    expect(meta).not.toBeNull();
    expect(meta!.underlyingTicker).toBe("AAPL");
    expect(meta!.strike).toBe(200);
    expect(meta!.multiplier).toBe(100);
    expect(meta!.optionType).toBe("call");
  });

  it("the assigned-put row carries the contracts in `quantity` so the cash leg can compute strike × qty × multiplier", () => {
    const assigned = acts.find((a) => a.type === "option_assigned")!;
    expect(assigned.ticker).toBe("-SPY260219P500");
    // Fidelity reports the contracts assigned, not signed for direction
    // — replay code uses the prior-position sign to decide.
    expect(Math.abs(assigned.quantity)).toBe(2);
    const meta = parseOptionSymbol(assigned.ticker)!;
    expect(meta.strike).toBe(500);
    // dollar leg = strike × |contracts| × 100 = 500 × 2 × 100 = 100_000
    const dollars = meta.strike * Math.abs(assigned.quantity) * meta.multiplier;
    expect(dollars).toBe(100_000);
    // And the parser already picked up the broker's 100k Amount column
    // verbatim — gives us a sanity check the math agrees with the source.
    expect(assigned.amount).toBe(100_000);
  });

  it("the exercised-call row resolves to the right underlying for the share mutation", () => {
    const exercised = acts.find((a) => a.type === "option_exercised")!;
    expect(exercised.ticker).toBe("-TSLA260320C300");
    const meta = parseOptionSymbol(exercised.ticker)!;
    expect(meta.underlyingTicker).toBe("TSLA");
    expect(meta.strike).toBe(300);
    // Short call exercised → strike × contracts × 100 dollars in
    // (you sold shares at the strike), |contracts| × 100 shares
    // delivered out of the underlying position.
    const cashIn = meta.strike * Math.abs(exercised.quantity) * meta.multiplier;
    expect(cashIn).toBe(30_000);
  });

  it("expired-call quantity is preserved so the replay can clear exactly what was held", () => {
    const expired = acts.find((a) => a.type === "option_expired")!;
    // Replay clears the option position regardless of qty sign; this
    // assertion just pins that the row carries enough info to do so.
    expect(Math.abs(expired.quantity)).toBe(1);
    expect(expired.amount).toBe(0);
  });
});
