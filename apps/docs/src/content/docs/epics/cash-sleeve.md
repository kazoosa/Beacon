---
title: Cash sleeve
description: Why Beacon synthesizes a CASH row from Account.currentBalance vs sum-of-holdings.
sidebar:
  order: 5
---

## The problem this solves

Activity-only CSV imports (e.g. Fidelity Accounts_History.csv) write
`InvestmentTransaction` rows but no `InvestmentHolding` rows — the file
simply doesn't contain a positions snapshot. The Account's
`currentBalance` ends up correctly populated (from the running
cash-flow estimate), but every read path that summed
`InvestmentHolding.institutionValue` got $0:

- Accounts page: ···7572 — $70,961.14 (correct, reads `currentBalance` directly)
- Overview / Net Worth: $0.00 (wrong)
- Holdings: empty (wrong)

Same problem for SnapTrade-synced accounts that hold money market
sweeps as their cash component.

## The solution

For each account, compute the **residual cash** = `Account.currentBalance - sum(holdings.institutionValue for that account)`.

When positive, that's uncovered cash (activity-only account, or a real
cash balance like Fidelity SPAXX). It's now:

- **Added to Net Worth / total_value** in `getPortfolioOverview`
- **Surfaced as a synthetic "CASH" row** in `getPortfolioHoldings`,
  with per-account locations so you can see where the cash sits

When negative (rare — would mean a stale balance vs newer holdings, or
a margin account), we ignore it and trust the holdings sum.

## Stories that built it

### Story: Compute residual cash in Overview

**Files touched**:
- `apps/backend/src/services/portfolioService.ts` —
  `getPortfolioOverview` adds `cashSleeve` to `totalValue`

### Story: Synthesize CASH row in Holdings response

**Files touched**:
- `apps/backend/src/services/portfolioService.ts` —
  `getPortfolioHoldings` builds a synthetic CASH entry with per-account
  locations

### Story: Money-market positions as $1-per-share cash holdings

**What**: When a CSV row matches a money-market sweep (SPAXX**, FDRXX**,
CORE**, FCASH** suffix or "money market" / "fdic.*sweep" in the
description), emit it as a synthetic cash position priced at $1 with
quantity = currentValue.

**Why**: Without this, the sweep balances were silently dropped at the
`quantity === 0` filter — losing tens of thousands of dollars in cash
on accounts with money-market settlements.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `parseFidelity`
  money-market branch

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Net Worth doesn't match the Accounts page sum | Account currentBalance is stale (older sync) but holdings are fresh | The cash sleeve uses `max(0, currentBalance - sum)` so a stale lower currentBalance vs fresh holdings is silently ignored — no double-counting |
| CASH row shows in Holdings but is $0 | Account.currentBalance and sum-of-holdings are equal | Expected — no residual cash |
| Money market shows in Accounts page balance but not Holdings | Sweep ticker not matched by the parser regex | Extend the sweep detection (currently `ticker.endsWith("**") || /money market|fdic.*sweep|cash.*sweep|core\*\*/i.test(description)`) |

## Tests

Indirectly covered by the Fidelity positions test fixture (which
includes SPAXX rows). No dedicated cash-sleeve test yet — would be a
good integration test addition.

## Open questions

- **Should the CASH row be expandable in the Holdings table?** Today
  it shows a single row aggregating cash across all accounts. Some
  users want per-account cash visibility. The data is there
  (`locations[]`); the UI doesn't surface it in the expand panel yet.
- **Negative residual cash on margin accounts**: We clamp to 0 and
  ignore. A margin account with a debit balance is underrepresented
  as a result. Open question whether to model margin balances
  explicitly.
