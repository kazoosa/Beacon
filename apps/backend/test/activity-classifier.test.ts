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
    // Plain REINVESTMENT (no DIVIDEND keyword) → buy. This covers
    // things like an interest reinvestment into a money-market fund.
    ["REINVESTMENT",                   "buy"],
    // DIVIDEND + REINVEST in the same label → dividend_reinvested, the
    // distinct type that adds shares (like a buy) AND counts as income
    // on the Dividends page. Previously this was "buy" alone and
    // reinvested dividends disappeared from users' dividend totals.
    ["DIVIDEND RECEIVED REINVESTMENT", "dividend_reinvested"],
    ["DIVIDEND REINVESTED",            "dividend_reinvested"],
    ["DIVIDEND_REINVESTED",            "dividend_reinvested"],
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
    ["REI",                   "buy"],
    ["REINVEST",              "buy"],
    ["REINVESTMENT",          "buy"],
    // DRIP by itself means "dividend reinvestment plan" and should be
    // treated as a reinvested dividend, not a plain buy — that way it
    // shows up on both the Dividends page (as income) and in the
    // share-count replay (as shares added).
    ["DRIP",                  "dividend_reinvested"],
    ["DIVIDEND_REINVESTED",   "dividend_reinvested"],
    ["DIVIDEND_REINVESTMENT", "dividend_reinvested"],
    // SnapTrade's European-broker dividend variants
    ["DIS",                   "dividend"],
    ["DISTRIBUTION",          "dividend"],
    ["QUALIFIED_DIVIDEND",    "dividend"],
    ["NON_QUALIFIED_DIVIDEND","dividend"],
    ["RETURN OF CAPITAL",     "dividend"],
    ["ROC",                   "dividend"],
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

describe("classifyActivity — option lifecycle labels", () => {
  // Each lifecycle event behaves differently in the replay (cash leg,
  // underlying mutation), so they MUST classify to distinct types
  // rather than collapsing into buy/sell. These cases pin the label
  // coverage for both SnapTrade-style enum strings and the looser
  // human-readable strings most CSV exports emit.
  const cases: Array<[string, ReturnType<typeof classifyActivity>]> = [
    // SnapTrade enum-style
    ["OPTIONEXPIRATION",  "option_expired"],
    ["OPTIONASSIGNMENT",  "option_assigned"],
    ["OPTIONEXERCISE",    "option_exercised"],
    ["OPTION_EXPIRATION", "option_expired"],
    ["OPTION_ASSIGNMENT", "option_assigned"],
    ["OPTION_EXERCISE",   "option_exercised"],
    // Common CSV phrasings
    ["EXPIRED",                  "option_expired"],
    ["ASSIGNED",                 "option_assigned"],
    ["EXERCISED",                "option_exercised"],
    ["OPT EXPIRATION",           "option_expired"],
    ["OPTION EXPIRATION SHORT",  "option_expired"],
    ["EXPIRED OPTION",           "option_expired"],
    ["OPTIONS EXPIRED",          "option_expired"],
    ["ASSIGNED PUT - AAPL",      "option_assigned"],
    ["EXERCISED CALL ON SPY",    "option_exercised"],
  ];
  it.each(cases)("%s → %s", (input, expected) => {
    expect(classifyActivity(input)).toBe(expected);
  });

  it("does NOT collapse option_assigned into transfer (ASSIGNMENT keyword precedence)", () => {
    // Without the option-lifecycle branch running first, "ASSIGNMENT"
    // could conceivably match a future broker-emitted "TRANSFER ASSIGNMENT"
    // label. Pin the precedence: option events win.
    expect(classifyActivity("OPTION ASSIGNMENT")).toBe("option_assigned");
  });

  it("does NOT classify plain BUY/SELL on an option ticker as a lifecycle event", () => {
    // The lifecycle branch only matches expired/assigned/exercised
    // labels — buying or selling an option contract is still a buy/sell
    // (the share-count replay handles those rows).
    expect(classifyActivity("YOU BOUGHT")).toBe("buy");
    expect(classifyActivity("YOU SOLD")).toBe("sell");
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
