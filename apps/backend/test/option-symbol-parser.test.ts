import { describe, it, expect } from "vitest";
import { parseOptionSymbol } from "../src/services/optionSymbolParser.js";

describe("parseOptionSymbol — Fidelity-style compact symbols", () => {
  it("parses a basic short call (negative qty notation lives elsewhere)", () => {
    const r = parseOptionSymbol("-AMAT260424C400");
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("AMAT");
    expect(r!.expiry.toISOString().slice(0, 10)).toBe("2026-04-24");
    expect(r!.optionType).toBe("call");
    expect(r!.strike).toBe(400);
    expect(r!.multiplier).toBe(100);
    expect(r!.occSymbol).toBe("AMAT  260424C00400000");
  });

  it("parses a put", () => {
    const r = parseOptionSymbol("-GEV260424P950");
    expect(r!.optionType).toBe("put");
    expect(r!.strike).toBe(950);
    expect(r!.underlyingTicker).toBe("GEV");
    expect(r!.occSymbol).toBe("GEV   260424P00950000");
  });

  it("parses a decimal strike", () => {
    // Fidelity will emit strikes like 82.5 verbatim
    const r = parseOptionSymbol("-SYF270115C82.5");
    expect(r!.strike).toBe(82.5);
    expect(r!.occSymbol).toBe("SYF   270115C00082500");
  });

  it("parses a long-dated LEAPS call", () => {
    const r = parseOptionSymbol("-WMT270617C130");
    expect(r!.expiry.toISOString().slice(0, 10)).toBe("2027-06-17");
    expect(r!.strike).toBe(130);
  });

  it("parses with leading whitespace already stripped (cleanTicker upstream)", () => {
    const r = parseOptionSymbol("AMAT260424C400");
    expect(r).not.toBeNull();
    expect(r!.strike).toBe(400);
  });

  it("returns null for a plain equity ticker", () => {
    expect(parseOptionSymbol("AAPL")).toBeNull();
    expect(parseOptionSymbol("AMAT")).toBeNull();
    expect(parseOptionSymbol("BRK.B")).toBeNull();
  });
});

describe("parseOptionSymbol — OCC standard symbols", () => {
  it("parses the canonical padded form", () => {
    const r = parseOptionSymbol("AMAT  260424C00400000");
    expect(r!.underlyingTicker).toBe("AMAT");
    expect(r!.optionType).toBe("call");
    expect(r!.strike).toBe(400);
    expect(r!.expiry.toISOString().slice(0, 10)).toBe("2026-04-24");
  });

  it("parses the unpadded form Tradier returns", () => {
    const r = parseOptionSymbol("AAPL240419C00040000");
    expect(r!.underlyingTicker).toBe("AAPL");
    expect(r!.optionType).toBe("call");
    expect(r!.strike).toBe(40);
  });

  it("parses sub-dollar strikes (1.5)", () => {
    const r = parseOptionSymbol("F   260117P00001500");
    expect(r!.strike).toBe(1.5);
    expect(r!.optionType).toBe("put");
  });

  it("normalizes strike with two implied decimals (37.50)", () => {
    const r = parseOptionSymbol("AAPL260117C00037500");
    expect(r!.strike).toBe(37.5);
  });
});

describe("parseOptionSymbol — SnapTrade structured payloads", () => {
  it("parses with option_symbol present", () => {
    const r = parseOptionSymbol({
      option_symbol: "AMAT240419C00040000",
      strike_price: 40,
      expiration_date: "2024-04-19",
      option_type: "CALL",
    });
    expect(r!.underlyingTicker).toBe("AMAT");
    expect(r!.strike).toBe(40);
    expect(r!.optionType).toBe("call");
    expect(r!.expiry.toISOString().slice(0, 10)).toBe("2024-04-19");
  });

  it("parses without option_symbol when underlying + strike + expiry + type are present", () => {
    const r = parseOptionSymbol({
      underlying_symbol: "spy",
      strike_price: "500.00",
      expiration_date: "2026-12-19",
      option_type: "PUT",
    });
    expect(r!.underlyingTicker).toBe("SPY");
    expect(r!.strike).toBe(500);
    expect(r!.optionType).toBe("put");
    expect(r!.occSymbol).toBe("SPY   261219P00500000");
  });

  it("walks one level of nesting under .symbol", () => {
    const r = parseOptionSymbol({
      symbol: {
        option_symbol: "AAPL260117C00200000",
        strike_price: 200,
        expiration_date: "2026-01-17",
        option_type: "CALL",
      },
    });
    expect(r).not.toBeNull();
    expect(r!.strike).toBe(200);
  });

  it("walks two levels of nesting under .symbol.symbol", () => {
    const r = parseOptionSymbol({
      symbol: {
        symbol: {
          underlying_symbol: "TSLA",
          strike_price: 300,
          expiration_date: "2026-06-19",
          option_type: "PUT",
        },
      },
    });
    expect(r).not.toBeNull();
    expect(r!.underlyingTicker).toBe("TSLA");
  });

  it("returns null when the structured payload is incomplete", () => {
    expect(parseOptionSymbol({ underlying_symbol: "AAPL" })).toBeNull();
    expect(parseOptionSymbol({})).toBeNull();
  });

  it("structured fields override OCC strike when both present (broker is source of truth)", () => {
    const r = parseOptionSymbol({
      option_symbol: "AAPL260117C00037500",
      strike_price: 99.99, // intentionally inconsistent
      expiration_date: "2026-01-17",
      option_type: "CALL",
    });
    expect(r!.strike).toBe(99.99);
  });
});

describe("parseOptionSymbol — null / garbage / null safety", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(parseOptionSymbol(null)).toBeNull();
    expect(parseOptionSymbol(undefined)).toBeNull();
    expect(parseOptionSymbol("")).toBeNull();
    expect(parseOptionSymbol("   ")).toBeNull();
  });

  it("returns null for plain equities (no embedded date)", () => {
    expect(parseOptionSymbol("MSFT")).toBeNull();
    expect(parseOptionSymbol("123")).toBeNull();
  });

  it("returns null for malformed dates (month > 12)", () => {
    expect(parseOptionSymbol("AAPL261324C100")).toBeNull(); // month 13
  });
});

describe("parseOptionSymbol — round-trip identity across shapes", () => {
  it("Fidelity-style and OCC-style of the same contract resolve to the same occSymbol", () => {
    const a = parseOptionSymbol("-AMAT260424C400");
    const b = parseOptionSymbol("AMAT  260424C00400000");
    expect(a!.occSymbol).toBe(b!.occSymbol);
  });

  it("SnapTrade structured and Fidelity-style of the same contract match", () => {
    const a = parseOptionSymbol("-WMT270617C130");
    const b = parseOptionSymbol({
      option_symbol: "WMT270617C00130000",
      strike_price: 130,
      expiration_date: "2027-06-17",
      option_type: "CALL",
    });
    expect(a!.occSymbol).toBe(b!.occSymbol);
    // And both are the canonical form (6-char ticker pad, strike × 1000
    // zero-padded to 8 digits).
    expect(a!.occSymbol).toBe("WMT   270617C00130000");
  });
});
