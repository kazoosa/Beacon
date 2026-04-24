---
title: CSV import
description: Hand-uploaded broker exports for both positions and activity, across 7 broker formats.
sidebar:
  order: 3
---

## What the user sees

1. On the Accounts page, drop a CSV into the Import box.
2. Beacon detects the broker (Fidelity / Schwab / Vanguard / Robinhood
   / TD Ameritrade / Webull / IBKR) and the kind (positions snapshot
   vs activity history).
3. A preview shows what's about to be imported.
4. Click Import. Banner: "X accounts · Y holdings · Z transactions · N
   dividends."
5. Holdings + Transactions + Dividends pages immediately reflect the new
   data. A "+ Add another CSV" button lets the user chain a positions
   CSV + an activity CSV without re-navigating.

## Two distinct CSV shapes

This is the most-misunderstood thing about CSV import:

**Positions snapshot** = a current-state file. Columns are
ticker/quantity/price/cost-basis/value. Creates `InvestmentHolding`
rows. **Does NOT create transactions.**

**Activity history** = a historical event file. Columns are
date/action/ticker/quantity/price/amount. Creates
`InvestmentTransaction` rows. The importer **also derives** holdings
from the activity by replaying every BUY/SELL chronologically.

Most brokers' default "Export" button gives the positions snapshot.
The activity export is usually under "History" or "Activity" or
"Statements." Users hit this confusion constantly — the empty-state
copy on the Transactions/Dividends pages explicitly explains the
distinction now.

## Stories that built it

### Story: Initial parser per broker

**What**: Hand-rolled parser per broker, sharing utilities for CSV
parsing and number cleaning.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `parseFidelity`,
  `parseSchwab`, `parseVanguard`, `parseRobinhood`,
  `parseTdAmeritrade`, `parseWebull`, `parseIbkr`
- `apps/backend/src/routes/csv.routes.ts` — `/preview`, `/detect`,
  `/import`, `/brokers`

**Decision**: per-broker parsers rather than a generic one. The CSV
shapes vary too much (Fidelity's two-column-pair-per-account thing,
IBKR's multi-section file, Schwab's metadata-row-before-headers) for
a single column-alias-driven parser to handle without losing
data.

### Story: Auto-detect broker

**What**: `detectBroker(csv)` fingerprints the file by header
columns and returns one of the 7 broker IDs (or null). Run on
`/preview` and `/import` so users don't have to specify the broker.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `detectBroker`,
  `detectCsvKind`

**Quirks**: Fidelity's positions and activity exports share the
"Account Number" column but have different other columns. Schwab
prepends a metadata row before the actual header. Robinhood doesn't
export positions natively — the docs tell users to build a minimal
3-column CSV.

### Story: Merge duplicate-ticker rows within an account

**What**: Many brokers (Fidelity especially) export multiple lots of
the same security as separate rows. The `InvestmentHolding` table
has a unique constraint on `(accountId, securityId)` — inserting both
rows triggers a P2002 collision. We now merge same-ticker rows per
account before insert: sum quantity, weighted-average cost basis.

**Why**: This was the "duplicate rows for accountId, securityId" error
that locked users out of importing.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `mergeDuplicateLots`,
  applied at both `parseFidelity` and `previewCsv` for defense in depth

### Story: Switch from create to upsert

**What**: Per-position writes use `upsert` keyed on
`(accountId, securityId)` instead of `create`. Even if a previous
disconnect left orphan holdings (Prisma cascade quirks in some
edge cases), re-import overwrites them silently instead of throwing.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` —
  `importPositionsCsv`

### Story: Money-market sweep handling

**What**: Fidelity's SPAXX, FDRXX, and FCASH rows have no Quantity or
Price but a real Current Value. Previously dropped at the
`quantity === 0` filter, which silently lost tens of thousands of
dollars in cash. Now imported as a synthetic cash position priced at
$1 with `quantity = currentValue`.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `parseFidelity`

### Story: Fidelity-specific quirks

**What**: Pinned in `test/csv-fidelity-positions.test.ts` — covers
BOM on header, leading-space option symbols (` -AMAT260424C400`),
quoted account names with commas (`"ROLLOVER IRA-27,000"`), pending
activity rows with negative current value, footer disclaimer text,
two accounts named "Individual - TOD" with different account numbers.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `parseFidelity`
  (heavily commented at every quirk)
- `apps/backend/test/csv-fidelity-positions.test.ts` — 8+ pinned cases

### Story: Activity replay derives holdings

**What**: `importActivityCsv` replays every transaction
chronologically per account to derive both:
- Running cash balance (sells/divs/interest/transfers in,
  buys/fees out)
- Per-ticker share count + weighted-average cost basis of every
  position remaining at end of history

The derived holdings are upserted as `InvestmentHolding` rows. Without
this, activity-only imports created transactions but no holdings, so
the user's hundreds of trades summed to "$0 in stocks" everywhere
outside the Transactions page.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — `importActivityCsv`
  + the replay loop

### Story: Option lifecycle in the activity replay

**What**: `option_expired`, `option_assigned`, `option_exercised`
events get cash-leg + share-leg + underlying-mutation handling in the
chronological replay. Auto-sweep clears any expired contract still
showing as held.

**Files touched**:
- `apps/backend/src/services/csvImportService.ts` — replay loop +
  `mutateUnderlying` helper + post-loop sweep
- `apps/backend/src/services/activityClassifier.ts` — the lifecycle
  type branches

See [Epic: Options](/epics/options/) for the full options story.

### Story: + Add another CSV

**What**: The success banner has a primary "+ Add another CSV" button
that clears the staging area and re-opens the file picker.

**Files touched**:
- `apps/dashboard/src/components/CsvImport.tsx`

**Why**: Users routinely import a positions CSV and an activity CSV
back-to-back. The previous flow required dismissing the banner +
finding the upload box again.

## Failure modes

| Symptom | Cause | Remediation |
|---|---|---|
| "Couldn't parse that CSV" | Auto-detect failed | Check file is a known broker shape; if a new shape, extend `detectBroker` |
| "Your CSV has duplicate rows for accountId, securityId" | Schema's unique constraint hit, merge step didn't run | Should not happen post-merge fix; if seen, file a bug with the CSV |
| Money market shows $0 instead of the sweep balance | Sweep row isn't recognized | Extend the sweep regex in `parseFidelity` (currently matches `**` suffix or "money market" / "fdic.*sweep" / "core**" in description) |
| Holdings look right but Transactions empty | User imported a positions CSV, not an activity CSV | Prompt in the empty-state copy explains this; user needs to import the activity export too |
| Account balances show $0 after activity-only import | Activity replay's cash-flow estimate didn't run, OR currentBalance was overwritten | Check `importActivityCsv` cash-flow logic; check `Mixed account: bump balance if cashFlow exceeds current` branch isn't lowering a real balance |

See [Runbook: CSV import errors](/runbooks/csv-errors/).

## Tests

- `apps/backend/test/csv-detection.test.ts` — every detector branch
- `apps/backend/test/csv-fidelity-positions.test.ts` — Fidelity quirks
- `apps/backend/test/csv-fidelity-activity-replay.test.ts` — replay
  classifier handoff
- `apps/backend/test/csv-import-errors.test.ts` — error path coverage
- `apps/backend/test/option-symbol-parser.test.ts` — symbol parsing
  used by both CSV and SnapTrade

Full traceability matrix at [Testing → Test↔feature traceability](/testing/traceability/).

## Open questions

- **Generic CSV importer**: A user with a broker we don't support can
  hand-craft a CSV and pick "Robinhood" as a workaround. Wider format
  support via a column-alias-driven generic parser is the right
  long-term answer; not a priority while the 7 supported brokers
  cover ~95% of users.
- **Activity CSV options coverage**: Schwab and IBKR activity exports
  with options haven't been pinned by tests yet. They should work
  via the same machinery as Fidelity; verify with real fixtures the
  next time we get one.
