import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  resetDb,
  seedInstitutions,
  createDeveloper,
  createApplication,
  prisma,
} from "./helpers.js";
import { signDeveloperAccess } from "../src/utils/jwt.js";
import { issueAccessToken } from "../src/services/tokenService.js";

let app: ReturnType<typeof createApp>;

/**
 * Build a developer with one Item (= one brokerage connection) and one
 * investment account underneath. Returns a Bearer token plus the
 * accountId so each test can POST against it.
 */
async function setupDeveloper(emailPrefix = "dev") {
  const { dev } = await createDeveloper(`${emailPrefix}_${Date.now()}@x.com`);
  const { app: application } = await createApplication(dev.id);
  const { hash } = issueAccessToken();
  const item = await prisma.item.create({
    data: {
      applicationId: application.id,
      institutionId: "ins_1",
      clientUserId: `user_${Date.now()}`,
      accessTokenHash: hash,
      status: "GOOD",
      products: ["investments"],
    },
  });
  const account = await prisma.account.create({
    data: {
      itemId: item.id,
      name: "Test Brokerage Account",
      mask: "1234",
      type: "investment",
      subtype: "brokerage",
      currentBalance: 0,
      isoCurrencyCode: "USD",
    },
  });
  const token = signDeveloperAccess(dev.id, dev.email);
  return { dev, account, token };
}

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await resetDb();
  await seedInstitutions();
});

describe("POST /api/portfolio/transactions/manual", () => {
  it("buy: writes the row and updates the holding to +qty at correct cost basis", async () => {
    const { account, token } = await setupDeveloper("buy");

    const res = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 10,
        price: 150,
      });

    expect(res.status).toBe(200);
    expect(res.body.transaction.ticker_symbol).toBe("AAPL");
    expect(res.body.transaction.amount).toBeCloseTo(-1500);
    expect(res.body.transaction.holdings_recomputed).toBe(1);

    const holdings = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
      include: { security: true },
    });
    expect(holdings).toHaveLength(1);
    expect(holdings[0]!.security.tickerSymbol).toBe("AAPL");
    expect(holdings[0]!.quantity).toBeCloseTo(10);
    expect(holdings[0]!.costBasis).toBeCloseTo(1500);
  });

  it("sell from existing position: holding goes to zero (deleted)", async () => {
    const { account, token } = await setupDeveloper("sell");

    // Seed a buy
    await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 10,
        price: 150,
      })
      .expect(200);

    // Sell all 10
    const sellRes = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-22",
        type: "sell",
        quantity: 10,
        price: 160,
      });
    expect(sellRes.status).toBe(200);

    const holdings = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    // After replay: 10 bought, 10 sold -> qty 0 -> holding deleted
    expect(holdings).toHaveLength(0);
  });

  it("dividend: writes the row, no holding change", async () => {
    const { account, token } = await setupDeveloper("div");

    // Seed a position so the dividend has a "context" (not strictly
    // required but mirrors real-world: you got a div on AAPL because
    // you owned AAPL). Holdings should still be just AAPL.
    await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 10,
        price: 150,
      })
      .expect(200);

    const before = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    expect(before).toHaveLength(1);
    const beforeQty = before[0]!.quantity;

    const divRes = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-25",
        type: "dividend",
        quantity: 10,
        price: 0.25,
      });
    expect(divRes.status).toBe(200);
    expect(divRes.body.transaction.amount).toBeCloseTo(2.5);

    const after = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    expect(after).toHaveLength(1);
    expect(after[0]!.quantity).toBeCloseTo(beforeQty);
  });

  it("authorization: developer A cannot post to developer B's account", async () => {
    const a = await setupDeveloper("a");
    const b = await setupDeveloper("b");

    const res = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        accountId: b.account.id, // <-- B's account
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 1,
        price: 150,
      });

    expect(res.status).toBe(403);

    // No row written under either developer
    const txs = await prisma.investmentTransaction.findMany();
    expect(txs).toHaveLength(0);
  });

  it("validation: rejects negative quantity with 400", async () => {
    const { account, token } = await setupDeveloper("val");

    const res = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: -1,
        price: 150,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_FAILED");

    const txs = await prisma.investmentTransaction.findMany();
    expect(txs).toHaveLength(0);
  });

  it("delete: removes row + recomputes holdings", async () => {
    const { account, token } = await setupDeveloper("del");

    // Buy 10 AAPL, then 5 more
    const r1 = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 10,
        price: 150,
      })
      .expect(200);
    await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId: account.id,
        ticker: "AAPL",
        date: "2026-04-22",
        type: "buy",
        quantity: 5,
        price: 200,
      })
      .expect(200);

    // Holdings = 15 shares
    let holdings = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    expect(holdings[0]!.quantity).toBeCloseTo(15);

    // Delete the first buy
    const delRes = await request(app)
      .delete(`/api/portfolio/transactions/${r1.body.transaction.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted.ticker_symbol).toBe("AAPL");

    // Holdings should now be 5 (just the second buy)
    holdings = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    expect(holdings[0]!.quantity).toBeCloseTo(5);
    expect(holdings[0]!.costBasis).toBeCloseTo(1000);
  });

  it("delete: cannot delete another developer's transaction", async () => {
    const a = await setupDeveloper("delA");
    const b = await setupDeveloper("delB");

    const created = await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${b.token}`)
      .send({
        accountId: b.account.id,
        ticker: "AAPL",
        date: "2026-04-20",
        type: "buy",
        quantity: 1,
        price: 150,
      })
      .expect(200);

    const delRes = await request(app)
      .delete(`/api/portfolio/transactions/${created.body.transaction.id}`)
      .set("Authorization", `Bearer ${a.token}`);
    expect(delRes.status).toBe(403);

    // Row still exists
    const tx = await prisma.investmentTransaction.findUnique({
      where: { id: created.body.transaction.id },
    });
    expect(tx).not.toBeNull();
  });

  it("idempotency: same buy posted twice creates two rows (intentional)", async () => {
    const { account, token } = await setupDeveloper("idem");

    const body = {
      accountId: account.id,
      ticker: "AAPL",
      date: "2026-04-20",
      type: "buy" as const,
      quantity: 5,
      price: 150,
    };

    await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(200);
    await request(app)
      .post("/api/portfolio/transactions/manual")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(200);

    const txs = await prisma.investmentTransaction.findMany({
      where: { accountId: account.id },
    });
    expect(txs).toHaveLength(2);

    // Holdings reflect both buys
    const holdings = await prisma.investmentHolding.findMany({
      where: { accountId: account.id },
    });
    expect(holdings).toHaveLength(1);
    expect(holdings[0]!.quantity).toBeCloseTo(10);
    expect(holdings[0]!.costBasis).toBeCloseTo(1500);
  });
});
