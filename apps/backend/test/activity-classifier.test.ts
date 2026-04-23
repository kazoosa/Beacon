/**
 * Exhaustive coverage for the shared classifier used by both the CSV
 * importer and the SnapTrade sync. These are the vocabulary boundaries
 * that have historically caused drift between the two paths — pin them
 * here so a future change to one import route can't silently break the
 * other.
 */
import { describe, it, expect } from "vitest";
import { classifyActivity } from "../src/services/activityClassifier.js";

describe("classifyActivity — Fidelity CSV action strings", () => {
  const cases: Array<[string, ReturnType<typeof classifyActivity>]> = [
    ["YOU BOUGHT",              "buy"],
    ["YOU BOUGHT SHARES OF AAPL", "buy"],
    ["BOUGHT",                  "buy"],
    ["YOU SOLD",                "sell"],
    ["YOU SOLD SHARES OF TSLA", "sell"],
    ["DIVIDEND RECEIVED",       "dividend"],
    ["QUALIFIED DIVIDEND",      "dividend"],
    ["REINVESTMENT",            "buy"],
    ["DIVIDEND RECEIVED REINVESTMENT", "buy"],  // reinvest beats dividend
    ["INTEREST EARNED",         "interest"],
    ["FEE CHARGED",             "fee"],
    ["CONTRIBUTION",            "transfer"],
    ["WITHDRAWAL",              "transfer"],
    ["CASH CONTRIBUTION ROTH",  "transfer"],
    ["LONG-TERM CAP GAIN",      "dividend"],
    ["SHORT TERM CAPITAL GAIN", "dividend"],
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    expect(classifyActivity(input)).toBe(expected);
  });
});

describe("classifyActivity — SnapTrade activity type codes", () => {
  const cases: Array<[string, ReturnType<typeof classifyActivity>]> = [
    ["BUY",             "buy"],
    ["SELL",            "sell"],
    ["PURCHASED",       "buy"],
    ["SOLD",            "sell"],
    ["DIV",             "dividend"],
    ["DIVIDEND",        "dividend"],
    ["CASH_DIVIDEND",   "dividend"],
    ["STOCK_DIVIDEND",  "dividend"],
    ["REI",             "buy"],
    ["REINVEST",        "buy"],
    ["REINVESTMENT",    "buy"],
    ["DRIP",            "buy"],
    ["INTEREST",        "interest"],
    ["FEE",             "fee"],
    ["TAX",             "fee"],
    ["TRANSFER",        "transfer"],
    ["TRANSFER_IN",     "transfer"],
    ["TRANSFER_OUT",    "transfer"],
    ["DEPOSIT",         "transfer"],
    ["CONTRIBUTION",    "transfer"],
    ["WITHDRAWAL",      "transfer"],
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    expect(classifyActivity(input)).toBe(expected);
  });
});

describe("classifyActivity — normalisation", () => {
  it("upper-cases input for the caller", () => {
    expect(classifyActivity("you bought")).toBe("buy");
    expect(classifyActivity("Dividend Received")).toBe("dividend");
  });
  it("trims surrounding whitespace", () => {
    expect(classifyActivity("   YOU SOLD  \n")).toBe("sell");
  });
  it("returns null for empty / null / whitespace", () => {
    expect(classifyActivity(null)).toBeNull();
    expect(classifyActivity(undefined)).toBeNull();
    expect(classifyActivity("")).toBeNull();
    expect(classifyActivity("   ")).toBeNull();
  });
  it("returns null for unknown labels so callers can skip-with-warn", () => {
    expect(classifyActivity("SPLIT")).toBeNull();
    expect(classifyActivity("REORG")).toBeNull();
    expect(classifyActivity("SPINOFF")).toBeNull();
    expect(classifyActivity("FOO_BAR_BAZ")).toBeNull();
  });
});
