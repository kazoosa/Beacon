import { prisma } from "../db.js";
import { logger } from "../logger.js";
import {
  parseOptionSymbol,
  type OptionSpec,
} from "./optionSymbolParser.js";
import {
  upsertSecurityWithTx,
  type PrismaTx,
} from "./csvImportService.js";

/**
 * Replay every InvestmentTransaction for one account chronologically,
 * derive end-state share counts + cost basis + cash flow, then upsert
 * the resulting InvestmentHolding rows and update Account.currentBalance.
 *
 * Used by:
 *   * The manual add-transaction endpoint, so a single hand-entered row
 *     correctly updates the Holdings page without waiting for a SnapTrade
 *     re-sync or a CSV re-import.
 *   * (Future) any other write path that needs to re-derive holdings
 *     from the ledger.
 *
 * Mirrors the share-count + cash-flow logic that lives in
 * csvImportService.importActivityCsv. The CSV path operates on parsed
 * CSV rows; this one operates on rows already persisted to the DB. The
 * business rules (option lifecycle, average-cost on sell, etc.) are the
 * same.
 *
 * The caller can pass an existing Prisma transaction client; if omitted,
 * the function opens its own. Either way, the read of transactions and
 * the write of holdings + the account update happen on the same client
 * so an error rolls back cleanly.
 */
export async function recomputeHoldingsForAccount(
  accountId: string,
  client?: PrismaTx,
): Promise<{ holdingsWritten: number; cashBalance: number }> {
  const run = (tx: PrismaTx) => recomputeInner(accountId, tx);
  if (client) return run(client);
  return prisma.$transaction(run, { timeout: 15_000, maxWait: 5_000 });
}

interface RunningPosition {
  ticker: string;
  name: string;
  quantity: number;
  costBasis: number;
  lastPrice: number;
}

async function recomputeInner(
  accountId: string,
  tx: PrismaTx,
): Promise<{ holdingsWritten: number; cashBalance: number }> {
  const transactions = await tx.investmentTransaction.findMany({
    where: { accountId },
    orderBy: { date: "asc" },
    include: { security: true },
  });

  let cashFlow = 0;
  const positions = new Map<string, RunningPosition>();

  // Cache option metadata keyed by ticker so the lifecycle branches
  // don't re-parse every iteration.
  const optionCache = new Map<string, OptionSpec | null>();
  const optionMeta = (ticker: string): OptionSpec | null => {
    const key = ticker.toUpperCase();
    if (!optionCache.has(key)) optionCache.set(key, parseOptionSymbol(ticker));
    return optionCache.get(key) ?? null;
  };

  // Move shares of an underlying when an option is assigned/exercised.
  const mutateUnderlying = (
    underlying: string,
    deltaShares: number,
    costPerShare: number,
  ) => {
    if (!underlying || deltaShares === 0) return;
    const key = underlying.toUpperCase();
    const pos = positions.get(key) ?? {
      ticker: underlying,
      name: underlying,
      quantity: 0,
      costBasis: 0,
      lastPrice: costPerShare || 0,
    };
    if (deltaShares > 0) {
      pos.quantity += deltaShares;
      pos.costBasis += deltaShares * costPerShare;
    } else {
      const avgBefore = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;
      const removeQty = Math.abs(deltaShares);
      const sellQty = Math.min(removeQty, Math.max(0, pos.quantity));
      pos.quantity -= removeQty;
      pos.costBasis = Math.max(0, pos.costBasis - avgBefore * sellQty);
    }
    if (costPerShare > 0) pos.lastPrice = costPerShare;
    positions.set(key, pos);
  };

  for (const t of transactions) {
    const ticker = t.security.tickerSymbol;
    const amt = Number(t.amount) || 0;
    const fees = Number(t.fees) || 0;
    const qty = Number(t.quantity) || 0;
    const px = Number(t.price) || 0;
    // The DB stores `amount` as already-signed for some write paths
    // (negative for buy, positive for sell — matches what SnapTrade and
    // the brokers themselves report). The CSV path stores `Math.abs`.
    // To stay consistent with the CSV replay logic we work in absolute
    // values here and let the type column decide direction.
    const absAmt = Math.abs(amt);

    // Cash leg
    switch (t.type) {
      case "buy":
        cashFlow -= absAmt + fees;
        break;
      case "sell":
        cashFlow += absAmt - fees;
        break;
      case "fee":
        cashFlow -= absAmt;
        break;
      case "dividend":
      case "interest":
      case "transfer":
        cashFlow += absAmt;
        break;
      case "dividend_reinvested":
        // Net-zero cash.
        break;
      case "option_expired":
        // Premium already moved at open.
        break;
      case "option_assigned":
      case "option_exercised": {
        const meta = optionMeta(ticker);
        if (!meta) break;
        const priorPos = positions.get(ticker.toUpperCase());
        const priorQty = priorPos?.quantity ?? 0;
        const contracts = Math.abs(priorQty || qty);
        const dollar = meta.strike * contracts * meta.multiplier;
        const isCall = meta.optionType === "call";
        const isShort = priorQty < 0;
        const cashIn = (isShort && isCall) || (!isShort && !isCall);
        cashFlow += cashIn ? dollar : -dollar;
        break;
      }
    }

    // Holdings leg
    const addsShares = t.type === "buy" || t.type === "dividend_reinvested";
    const removesShares = t.type === "sell";

    if (
      t.type === "option_expired" ||
      t.type === "option_assigned" ||
      t.type === "option_exercised"
    ) {
      const optKey = ticker.toUpperCase();
      const optPos = positions.get(optKey);
      if (optPos) {
        const meta = optionMeta(ticker);
        const contracts = Math.abs(optPos.quantity);
        if (
          meta &&
          (t.type === "option_assigned" || t.type === "option_exercised")
        ) {
          const isCall = meta.optionType === "call";
          const isShort = optPos.quantity < 0;
          const receive = (isShort && !isCall) || (!isShort && isCall);
          mutateUnderlying(
            meta.underlyingTicker,
            receive ? contracts * meta.multiplier : -contracts * meta.multiplier,
            meta.strike,
          );
        }
        optPos.quantity = 0;
        optPos.costBasis = 0;
        positions.set(optKey, optPos);
      }
      continue;
    }

    if ((addsShares || removesShares) && ticker && qty > 0) {
      const key = ticker.toUpperCase();
      const pos = positions.get(key) ?? {
        ticker,
        name: t.security.name ?? ticker,
        quantity: 0,
        costBasis: 0,
        lastPrice: px,
      };
      if (addsShares) {
        pos.quantity += qty;
        pos.costBasis += absAmt + fees;
      } else {
        const avgBefore = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;
        const sellQty = Math.min(qty, pos.quantity);
        pos.quantity -= sellQty;
        pos.costBasis = Math.max(0, pos.costBasis - avgBefore * sellQty);
      }
      if (px > 0) pos.lastPrice = px;
      positions.set(key, pos);
    }
  }

  // First, zero out any existing holdings for tickers that are no
  // longer in the position map (i.e. the user fully sold + we want the
  // Holdings page to stop showing them). Cheap implementation: pull
  // every existing holding for this account and delete the ones whose
  // securityId isn't in the post-replay set.
  const existing = await tx.investmentHolding.findMany({
    where: { accountId },
    select: { id: true, securityId: true, security: { select: { tickerSymbol: true } } },
  });
  const finalTickers = new Set(
    Array.from(positions.values())
      .filter((p) => p.quantity !== 0)
      .map((p) => p.ticker.toUpperCase()),
  );
  const toDelete = existing.filter(
    (h) => !finalTickers.has(h.security.tickerSymbol.toUpperCase()),
  );
  if (toDelete.length > 0) {
    await tx.investmentHolding.deleteMany({
      where: { id: { in: toDelete.map((h) => h.id) } },
    });
  }

  // Write the new holdings.
  let holdingsWritten = 0;
  for (const pos of positions.values()) {
    if (pos.quantity === 0) continue;
    const meta = parseOptionSymbol(pos.ticker);
    const security = await upsertSecurityWithTx(tx, {
      ticker: pos.ticker,
      name: pos.name,
      quantity: pos.quantity,
      price: pos.lastPrice,
      option: meta ?? undefined,
    });
    const mult = meta?.multiplier ?? 1;
    const institutionValue = pos.quantity * pos.lastPrice * mult;
    await tx.investmentHolding.upsert({
      where: {
        accountId_securityId: { accountId, securityId: security.id },
      },
      create: {
        accountId,
        securityId: security.id,
        quantity: pos.quantity,
        institutionPrice: pos.lastPrice,
        institutionPriceAsOf: new Date(),
        institutionValue,
        costBasis: pos.costBasis,
        isoCurrencyCode: "USD",
      },
      update: {
        quantity: pos.quantity,
        institutionPrice: pos.lastPrice,
        institutionPriceAsOf: new Date(),
        institutionValue,
        costBasis: pos.costBasis,
      },
    });
    holdingsWritten++;
  }

  // Mirror csvImportService behavior: never LOWER a balance, since the
  // existing balance may have come from a real positions snapshot
  // (broker-reported, high-fidelity) and our replay-derived cashFlow
  // is just an estimate from the activity ledger. If the estimate is
  // higher than the snapshot, we trust it and bump up. If it's lower,
  // leave the snapshot alone.
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { currentBalance: true },
  });
  if (account && cashFlow > Number(account.currentBalance ?? 0)) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: cashFlow, availableBalance: cashFlow },
    });
  }

  logger.info(
    { accountId, holdingsWritten, cashBalance: cashFlow, txCount: transactions.length },
    "holdings recomputed from ledger",
  );

  return { holdingsWritten, cashBalance: cashFlow };
}
