---
title: Activity classifier
description: How broker activity labels become Beacon's normalized ActivityType vocabulary.
sidebar:
  order: 7
---

`apps/backend/src/services/activityClassifier.ts` is the single source of
truth for normalizing broker activity labels onto Beacon's
`ActivityType` vocabulary. Both the CSV importer and the SnapTrade sync
delegate to `classifyActivity()`. Keeping the two paths in lockstep here
prevents the historical drift where each importer had its own allow-list
with different blind spots.

## The vocabulary

```typescript
type ActivityType =
  | "buy"                  // shares acquired (incl. plain stock buys)
  | "sell"                 // shares disposed
  | "dividend"             // cash dividend
  | "dividend_reinvested"  // DRIP — adds shares AND counts as income
  | "interest"             // interest paid by the broker / money market
  | "fee"                  // any fee or tax
  | "transfer"             // cash in/out of the account
  | "option_expired"       // option expired worthless
  | "option_assigned"      // short option assigned against
  | "option_exercised";    // long option exercised
```

These are stored as strings in `InvestmentTransaction.type`, not Prisma
enums (see [Architecture → Data model](/architecture/data-model/) for
why).

## Decision order

Branches are evaluated top-down. **Order matters** — broader patterns
have to come after the more specific ones they'd otherwise capture.

1. **Option lifecycle first**: EXPIRED / ASSIGNED / EXERCISED labels
   often contain substrings ("ASSIGNMENT", "EXERCISE") that would match
   later branches. Specific wins.
2. **DIVIDEND + REINVEST together** → `dividend_reinvested`. Has to
   come before plain REINVEST and plain DIVIDEND.
3. **Plain REINVEST** (no dividend keyword) → `buy`. Catches
   non-dividend reinvestments like interest reinvested into a money
   market.
4. **Capital gain** → `dividend` (mutual-fund cap-gain distributions
   behave like dividends for reporting).
5. **DIVIDEND umbrella** — qualified, non-qualified, cash, stock,
   DIS, DISTRIBUTION, RETURN OF CAPITAL, ROC.
6. **BUY / SELL / INTEREST / FEE / TRANSFER** in that order.

Anything that doesn't match returns `null`. Callers (CSV importer + SnapTrade sync) log + skip null rows; they never throw.

## Why each broker label maps where it does

| Broker label | Type | Reason |
|---|---|---|
| `YOU BOUGHT` (Fidelity) | buy | Verbose human-readable form — the BOUGHT keyword is the disambiguator. |
| `BUY` (SnapTrade enum) | buy | |
| `DIVIDEND RECEIVED` (Fidelity) | dividend | Standard cash dividend. |
| `DIVIDEND_REINVESTED` (SnapTrade) | dividend_reinvested | DRIP. |
| `DIVIDEND RECEIVED REINVESTMENT` (Fidelity) | dividend_reinvested | Fidelity's verbose DRIP label. |
| `DRIP` (some brokers) | dividend_reinvested | The acronym. |
| `REINVESTMENT` (no DIVIDEND keyword) | buy | Could be interest reinvested or a non-dividend reinvestment. Treated as a buy for the share-count replay. |
| `LONG-TERM CAP GAIN` (Fidelity) | dividend | Mutual fund cap-gain distribution. |
| `DIS` / `DISTRIBUTION` (SnapTrade — European brokers) | dividend | EU brokers use these for what US brokers call dividends. |
| `RETURN OF CAPITAL` / `ROC` | dividend | Income for reporting purposes. |
| `INTEREST EARNED` | interest | Money market or cash interest. |
| `OPTIONEXPIRATION` (SnapTrade) | option_expired | |
| `EXPIRED` (Fidelity) | option_expired | The looser CSV form. |
| `OPTIONASSIGNMENT` / `ASSIGNED PUT - AAPL` | option_assigned | |
| `OPTIONEXERCISE` / `EXERCISED CALL ON SPY` | option_exercised | |
| `CONTRIBUTION` / `WITHDRAWAL` / `DEPOSIT` / `TRANSFER` / `TRANSFER_IN` / `TRANSFER_OUT` | transfer | Cash in/out. |

Full coverage table (with one row per pinned test case) lives in
[`test/activity-classifier.test.ts`](https://github.com/kazoosa/Beacon/blob/main/apps/backend/test/activity-classifier.test.ts).
68 cases as of the last classifier expansion.

## When you find an unrecognized label

Both the CSV importer and the SnapTrade sync log + skip unrecognized
rows. The labels show up in:

- **Render logs** as `snaptrade: unrecognised activity type {rawType}`
  warnings.
- **The Connect banner** in the dashboard, which surfaces
  `skipped_labels` from the sync response.

Workflow when a new label appears:

1. Capture the raw label from logs or the banner.
2. Decide which `ActivityType` it maps to. If it's an **option event**
   you might need a new lifecycle type (rare); usually it slots into
   one of the existing seven.
3. Add the branch to `classifyActivity()`. **Position matters** —
   add it next to its semantic neighbors so the order rules above
   stay readable.
4. Add a test case to `test/activity-classifier.test.ts`.
5. PR. Once merged + deployed, re-running the user's sync will pick
   up the previously-skipped rows (the importer is idempotent).

## Why dividend_reinvested is its own type

Two competing requirements:

- **Cost basis math** wants to treat reinvested dividends as buys so
  the share count goes up by the right amount.
- **Income reports** want to count them as dividend income alongside
  cash dividends so the user's YTD income tile is honest.

Collapsing them into `buy` (which we did originally) gave the right
share count but wiped them from dividend totals. Collapsing them into
`dividend` would give the right income but break the share count.

A dedicated type lets both reads do the right thing:

- The replay treats `addsShares = a.type === "buy" || a.type === "dividend_reinvested"` (in `csvImportService.ts`).
- The dividend-income reads use `type IN ("dividend", "dividend_reinvested")` (the `DIVIDEND_INCOME_TYPES` constant).

Same pattern would extend cleanly to a future `dividend_in_kind` or
`return_of_capital_with_basis_reduction` if we ever model those
distinctly.
