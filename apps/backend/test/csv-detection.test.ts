/**
 * Regression coverage for Bug 1: detectBroker / detectCsvKind must
 * survive BOM-prefixed exports, casing variations, whitespace, and
 * the distinction between positions and activity CSVs from the same
 * broker.
 */
import { describe, it, expect } from "vitest";

// Mock prisma before the service is imported — detectBroker itself
// doesn't touch the DB but the module's top-level imports do.
import { vi } from "vitest";
vi.mock("../src/db.js", () => ({ prisma: {} }));

import { detectBroker, detectCsvKind } from "../src/services/csvImportService.js";

const FIDELITY_POSITIONS_HEADER =
  "Account Number,Account Name,Symbol,Description,Quantity,Last Price,Cost Basis Total,Average Cost Basis,Type";
const FIDELITY_ACTIVITY_HEADER =
  "Run Date,Account Name,Account Number,Action,Symbol,Description,Security Type,Quantity,Price,Commission,Fees,Amount,Settlement Date";
const VANGUARD_POSITIONS_HEADER =
  "Fund Account Number,Investment Name,Symbol,Shares,Share Price,Total Value";
const SCHWAB_POSITIONS_HEADER =
  "Symbol,Description,Quantity,Price,Market Value,Cost Basis,Security Type";
const ROBINHOOD_HEADER = "Symbol,Quantity,Price";
const TD_AMERITRADE_POSITIONS_HEADER =
  "Symbol,Description,Qty,Price,Mkt Value,Avg Cost";
const WEBULL_POSITIONS_HEADER =
  "Name,Symbol,Quantity,Price,Cost Price,Market Value";
const IBKR_PORTFOLIO_HEADER =
  "Symbol,Asset Class,Quantity,MarkPrice,CostBasisPrice,PositionValue";
const IBKR_FLEX_HEADER =
  "ClientAccountID,Conid,Symbol,Description,Quantity,MarkPrice,CostBasisPrice";

describe("detectBroker — positive cases", () => {
  it("recognises Fidelity positions", () => {
    expect(detectBroker(FIDELITY_POSITIONS_HEADER + "\n...")).toBe("fidelity");
  });
  it("recognises Fidelity activity (Run Date + Action)", () => {
    expect(detectBroker(FIDELITY_ACTIVITY_HEADER + "\n...")).toBe("fidelity");
  });
  it("recognises Vanguard", () => {
    expect(detectBroker(VANGUARD_POSITIONS_HEADER + "\n...")).toBe("vanguard");
  });
  it("recognises Schwab", () => {
    expect(detectBroker(SCHWAB_POSITIONS_HEADER + "\n...")).toBe("schwab");
  });
  it("recognises Robinhood", () => {
    expect(detectBroker(ROBINHOOD_HEADER + "\n...")).toBe("robinhood");
  });
  it("recognises Robinhood with Ticker/Shares aliases", () => {
    expect(detectBroker("Ticker,Shares,Price\n...")).toBe("robinhood");
  });
  it("recognises TD Ameritrade positions (Mkt Value + Avg Cost)", () => {
    expect(detectBroker(TD_AMERITRADE_POSITIONS_HEADER + "\n...")).toBe("td_ameritrade");
  });
  it("recognises Webull positions (Cost Price + Symbol)", () => {
    expect(detectBroker(WEBULL_POSITIONS_HEADER + "\n...")).toBe("webull");
  });
  it("recognises IBKR Portfolio Snapshot (MarkPrice + Symbol)", () => {
    expect(detectBroker(IBKR_PORTFOLIO_HEADER + "\n...")).toBe("ibkr");
  });
  it("recognises IBKR Flex export (Conid)", () => {
    expect(detectBroker(IBKR_FLEX_HEADER + "\n...")).toBe("ibkr");
  });
});

describe("detectBroker — robustness to formatting edge cases", () => {
  it("strips a UTF-8 BOM prefix", () => {
    expect(detectBroker("\uFEFF" + FIDELITY_POSITIONS_HEADER + "\n")).toBe("fidelity");
    expect(detectBroker("\uFEFF" + FIDELITY_ACTIVITY_HEADER + "\n")).toBe("fidelity");
  });
  it("handles mixed case column names", () => {
    expect(detectBroker("account number,SYMBOL,Cost Basis Total\n...")).toBe("fidelity");
  });
  it("handles extra internal whitespace", () => {
    expect(detectBroker("Account   Number,Cost  Basis   Total,Symbol\n...")).toBe("fidelity");
  });
  it("handles leading blank lines", () => {
    expect(detectBroker("\n\n" + FIDELITY_POSITIONS_HEADER + "\n...")).toBe("fidelity");
  });
  it("falls through to null for unrecognised headers", () => {
    expect(detectBroker("Foo,Bar,Baz\n1,2,3")).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(detectBroker("")).toBeNull();
    expect(detectBroker("\n\n")).toBeNull();
  });
});

describe("detectCsvKind", () => {
  it("classifies Fidelity activity as activity", () => {
    expect(detectCsvKind(FIDELITY_ACTIVITY_HEADER + "\n...")).toBe("activity");
  });
  it("classifies Fidelity positions as positions", () => {
    expect(detectCsvKind(FIDELITY_POSITIONS_HEADER + "\n...")).toBe("positions");
  });
  it("survives BOM prefix", () => {
    expect(detectCsvKind("\uFEFF" + FIDELITY_ACTIVITY_HEADER + "\n")).toBe("activity");
  });
  it("returns null on empty input", () => {
    expect(detectCsvKind("")).toBeNull();
  });
});
