/**
 * Bug 4 regression coverage: SnapTrade's symbol, currency, and numeric
 * fields arrive in wildly inconsistent shapes. These helpers are the
 * narrow defence layer that keeps the sync loop from writing a null
 * ticker or NaN amount. They live at module scope in snaptradeService;
 * re-declare them here so the tests exercise the same logic without
 * pulling in the full sync module (which imports the SnapTrade SDK
 * and Prisma).
 *
 * If the helpers in snaptradeService.ts drift from these copies, the
 * tests here are wrong — update both.
 */
import { describe, it, expect } from "vitest";

function extractSnapTradeSymbol(act: Record<string, unknown>): { ticker: string; description: string } {
  const raw = act.symbol;
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim().toUpperCase();
    return { ticker: t, description: t };
  }
  if (raw && typeof raw === "object") {
    const level1 = raw as { symbol?: unknown; description?: unknown };
    if (typeof level1.symbol === "string" && level1.symbol.trim()) {
      const t = level1.symbol.trim().toUpperCase();
      const d = typeof level1.description === "string" && level1.description ? level1.description : t;
      return { ticker: t, description: d };
    }
    if (level1.symbol && typeof level1.symbol === "object") {
      const level2 = level1.symbol as { symbol?: unknown; description?: unknown };
      if (typeof level2.symbol === "string" && level2.symbol.trim()) {
        const t = level2.symbol.trim().toUpperCase();
        const d = typeof level2.description === "string" && level2.description ? level2.description : t;
        return { ticker: t, description: d };
      }
    }
  }
  return { ticker: "CASH", description: "Cash" };
}

function safeNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function extractCurrency(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  if (typeof v === "object") {
    const code = (v as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim().toUpperCase();
  }
  return null;
}

describe("extractSnapTradeSymbol — handles all SnapTrade symbol shapes", () => {
  it("bare string at top level", () => {
    expect(extractSnapTradeSymbol({ symbol: "AAPL" })).toEqual({ ticker: "AAPL", description: "AAPL" });
  });
  it("one level nested with description", () => {
    expect(
      extractSnapTradeSymbol({ symbol: { symbol: "AAPL", description: "APPLE INC" } }),
    ).toEqual({ ticker: "AAPL", description: "APPLE INC" });
  });
  it("two levels nested", () => {
    expect(
      extractSnapTradeSymbol({ symbol: { symbol: { symbol: "AAPL", description: "APPLE INC" } } }),
    ).toEqual({ ticker: "AAPL", description: "APPLE INC" });
  });
  it("missing symbol → CASH sentinel", () => {
    expect(extractSnapTradeSymbol({})).toEqual({ ticker: "CASH", description: "Cash" });
  });
  it("null symbol field → CASH sentinel", () => {
    expect(extractSnapTradeSymbol({ symbol: null })).toEqual({ ticker: "CASH", description: "Cash" });
  });
  it("empty string → CASH sentinel (cash-only dividend row)", () => {
    expect(extractSnapTradeSymbol({ symbol: "" })).toEqual({ ticker: "CASH", description: "Cash" });
  });
  it("inner symbol is null → CASH sentinel", () => {
    expect(extractSnapTradeSymbol({ symbol: { symbol: null, description: "foo" } })).toEqual({
      ticker: "CASH",
      description: "Cash",
    });
  });
  it("upper-cases lower-case tickers", () => {
    expect(extractSnapTradeSymbol({ symbol: "aapl" })).toEqual({ ticker: "AAPL", description: "AAPL" });
  });
});

describe("safeNumber", () => {
  it("passes through real numbers", () => {
    expect(safeNumber(1.5)).toBe(1.5);
    expect(safeNumber(0)).toBe(0);
  });
  it("parses numeric strings", () => {
    expect(safeNumber("42")).toBe(42);
    expect(safeNumber("3.14")).toBe(3.14);
  });
  it("returns fallback for null/undefined/empty/NaN", () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber("")).toBe(0);
    expect(safeNumber("not a number")).toBe(0);
    expect(safeNumber(null, 99)).toBe(99);
  });
});

describe("extractCurrency", () => {
  it("accepts a plain string", () => {
    expect(extractCurrency("USD")).toBe("USD");
  });
  it("accepts a { code } wrapper", () => {
    expect(extractCurrency({ code: "EUR" })).toBe("EUR");
  });
  it("returns null on junk", () => {
    expect(extractCurrency(null)).toBeNull();
    expect(extractCurrency(undefined)).toBeNull();
    expect(extractCurrency("")).toBeNull();
    expect(extractCurrency({})).toBeNull();
    expect(extractCurrency({ code: null })).toBeNull();
  });
});
