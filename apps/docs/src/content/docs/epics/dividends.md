---
title: Dividend reporting
description: Cash + reinvested dividend tracking, monthly chart, top payers, YTD income.
sidebar:
  order: 4
---

## What the user sees

The Dividends page (`/app/dividends`):
- YTD dividend income tile
- Lifetime dividend income tile
- Average monthly (12-mo) tile
- Last-12-months bar chart
- Top dividend payers list (ticker · # payments · total)

The Overview page surfaces YTD dividends as one of the headline tiles.

## Data sources

Dividends land as `InvestmentTransaction` rows of type `dividend` or
`dividend_reinvested`. They come from:

1. **SnapTrade activity sync** — the `getActivities` endpoint
2. **CSV activity import** — Fidelity's "DIVIDEND RECEIVED" rows etc

## Stories that built it

### Story: Initial dividend page

**What**: Read all `type: "dividend"` rows for the user, group by
month + ticker, render charts.

**Files touched**:
- `apps/backend/src/services/portfolioService.ts` — `getPortfolioDividends`
- `apps/backend/src/routes/portfolio.routes.ts` — `/dividends`
- `apps/dashboard/src/pages/DividendsPage.tsx`

### Story: Distinct dividend_reinvested type

**What**: Reinvested dividends used to be classified as plain `buy`
(so the share count went up correctly) but disappeared from dividend
income totals (which filtered on `type === "dividend"`). For DRIP-heavy
investors this could wipe out their entire dividend total.

We added `dividend_reinvested` as a distinct ActivityType. The
share-count replay treats it like a buy; the dividend reads union it
with plain `dividend` via the `DIVIDEND_INCOME_TYPES` constant.

**Files touched**:
- `apps/backend/src/services/activityClassifier.ts` — new type +
  classifier branches
- `apps/backend/src/services/csvImportService.ts` — replay treats it
  as `addsShares` with net-zero cash
- `apps/backend/src/services/portfolioService.ts` — every dividend
  read uses the union (overview YTD, dividends page, transactions
  filter, stock detail)

See [Architecture → Activity classifier](/architecture/activity-classifier/)
for why this is its own type.

### Story: Broader classifier coverage

**What**: SnapTrade returns `DIS`, `DISTRIBUTION`, `QUALIFIED_DIVIDEND`,
`NON_QUALIFIED_DIVIDEND`, `RETURN OF CAPITAL`, `ROC` for various
dividend variants depending on the broker. Previously dropped as
unknown; now classified correctly.

**Files touched**:
- `apps/backend/src/services/activityClassifier.ts` — dividend umbrella
  expanded
- `apps/backend/test/activity-classifier.test.ts` — pinned coverage

### Story: Stock-detail dividend calendar

**What**: Per-ticker dividend section on the StockDetail page —
quarterly buckets, per-share amount, ex-date / pay-date estimates.

**Files touched**:
- `apps/backend/src/services/portfolioService.ts` — `getPortfolioBySymbol`
  dividend block
- `apps/dashboard/src/pages/stocks/StockDetail.tsx` — `DividendCalendar`
  component

**Caveat**: ex-date and pay-date are estimated from the dates Beacon
saw the transaction; they're informational, not authoritative. The
broker's payment record is canonical.

## Failure modes

| Symptom | Cause | Remediation |
|---|---|---|
| YTD dividends shows $0 despite holding dividend stocks | No dividend transactions exist for the YTD window | Run a SnapTrade sync (with year-long lookback) or import an activity CSV |
| Dividend amount looks low for a DRIP-heavy portfolio | Reinvested dividends being filtered out | Should be fixed via `DIVIDEND_INCOME_TYPES` union; verify by querying `InvestmentTransaction` for `type IN ('dividend', 'dividend_reinvested')` |
| New broker label not classified | Classifier doesn't know it | Check Render logs for `unrecognised activity type` warnings; add the branch in `activityClassifier.ts` |
| Dividend shown for a stock the user doesn't currently hold | Dividend was paid before the user sold; transaction is preserved | Expected behavior — historical income is real income |

## Tests

- `apps/backend/test/activity-classifier.test.ts` — every dividend
  variant
- `apps/backend/test/csv-fidelity-activity-replay.test.ts` — DRIP
  handling end-to-end through the replay

## Open questions

- **Forward 12-month forecast**: The marketing/landing page mentions a
  forward 12-month dividend forecast. The Dividends page shows
  trailing 12 months. The forecast is on the roadmap; needs an external
  data source (broker yields aren't trustworthy enough) or to be
  inferred from the trailing period.
- **Tax treatment**: We don't distinguish qualified vs non-qualified
  dividends in the UI even though the classifier preserves the
  distinction in the original label. Could surface as a tooltip or a
  tax-prep export.
- **Currency**: All dividends assumed USD. Foreign dividends from ADRs
  would technically need the source-currency amount + the FX rate at
  pay date. Out of scope.
