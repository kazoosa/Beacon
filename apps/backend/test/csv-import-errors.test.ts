/**
 * Verifies Bug 3 fix: unexpected errors from `prisma.$transaction` must
 * surface as HTTP 500 (so real bugs stay diagnosable) rather than being
 * hidden behind a 400 "duplicate rows" message. Only known Prisma error
 * codes (P2002) get normalised to a readable 400.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library.js";

// Stub the prisma module so no DB connection is required. Each test
// overrides only the methods it exercises.
vi.mock("../src/db.js", () => {
  const mock = {
    institution: { upsert: vi.fn().mockResolvedValue({ id: "ins_10" }) },
    application: { findFirst: vi.fn().mockResolvedValue({ id: "app_1" }) },
    item: {
      findFirst: vi.fn().mockResolvedValue({ id: "item_1" }),
    },
    $transaction: vi.fn(),
  };
  return { prisma: mock };
});

import { prisma } from "../src/db.js";
import { importCsv } from "../src/services/csvImportService.js";
import { ApiError } from "../src/utils/errors.js";

const fakeDeveloper = { id: "dev_1", email: "x@y.z" } as never;

const fidelityPositionsCsv = [
  "Account Number,Account Name,Symbol,Description,Quantity,Last Price,Cost Basis Total,Average Cost Basis,Type",
  "X11111111,Brokerage,AAPL,APPLE INC,10,180.00,1700.00,170.00,Cash",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importCsv error normalisation (Bug 3)", () => {
  it("surfaces an unexpected $transaction failure as a non-ApiError (→ 500)", async () => {
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mockRejectedValue(
      new Error("unexpected"),
    );

    let caught: unknown;
    try {
      await importCsv(fakeDeveloper, "fidelity", fidelityPositionsCsv);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    // Critical: must NOT have been normalised to an ApiError — the
    // global errorHandler then returns 500 "Internal server error"
    // so the root cause stays diagnosable.
    expect(caught).not.toBeInstanceOf(ApiError);
    expect((caught as Error).message).toBe("unexpected");
  });

  it("normalises P2002 unique-constraint errors to a readable 400", async () => {
    const err = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.17.0",
      meta: { target: ["tickerSymbol"] },
    });
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mockRejectedValue(err);

    let caught: unknown;
    try {
      await importCsv(fakeDeveloper, "fidelity", fidelityPositionsCsv);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect((caught as ApiError).message).toMatch(/duplicate rows/i);
    expect((caught as ApiError).message).toMatch(/tickerSymbol/);
  });
});
