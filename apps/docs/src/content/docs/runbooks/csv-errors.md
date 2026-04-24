---
title: CSV import errors
description: User-facing error messages from the CSV import path and how to triage each.
sidebar:
  order: 5
---

## When to use this

A user reports the CSV import:
- Threw an error
- Imported but the data looks wrong (missing positions, $0 balances,
  duplicate entries)
- Said it succeeded but nothing appears in Holdings/Transactions/Dividends

## The errors and what they mean

### "Couldn't parse that CSV"

The auto-detect (`detectBroker()`) didn't match any of the 7 supported
broker shapes.

**Triage**:
- Open the file in a text editor. First non-blank line should be the
  header row.
- Compare to the broker fingerprints in `apps/backend/src/services/csvImportService.ts`:
  - **Fidelity**: `Account Number,Account Name,Symbol,Description,Quantity,...`
  - **Schwab**: `Symbol,Description,Quantity,Price,...` (sometimes after a metadata row)
  - **Vanguard**: `Fund Account Number,...` or `Account Number,...,Trade Date,...`
  - **IBKR**: contains `MarkPrice` / `CostBasisPrice` / `Conid`
  - **Robinhood**: 3-column minimal `symbol,quantity,price` (any order)
  - **TD Ameritrade**: contains `Mkt Value` or `Avg Cost` with `Qty` or `Quantity`
  - **Webull**: contains `Cost Price`

**Fix**:
- If the user's broker IS one of the 7 but the headers differ from
  what's pinned, extend the detector. Add a test fixture in
  `apps/backend/test/csv-detection.test.ts`.
- If the user's broker is NOT one of the 7 and they want it added,
  that's a feature request — not an incident.
- Workaround for the user: rename/reorder columns to match one of the
  supported brokers (e.g. Robinhood's 3-column minimal).

### "Your CSV has duplicate rows for accountId, securityId — combine lots into one row and retry"

This was the famous "users couldn't import" error. Should NOT happen
post-fix — the importer now merges same-ticker rows per account
before insert, AND uses `upsert` keyed on `(accountId, securityId)`
so any leftover ghost holding gets silently overwritten.

If you see it now:

**Triage**: a fresh ghost row got past both defenses — meaning either
the merge step skipped the row, or the upsert hit a different
constraint than expected.

**Fix**:
- Check Render logs for the actual P2002 detail (which constraint?
  which target?). The error handler in `csvImportService.ts` reports
  the target columns.
- Read the CSV around the offending ticker — is there a row that
  the merge step might have missed (different casing, leading whitespace,
  etc)?
- Worst case: have the user manually combine the offending rows in
  their CSV before re-uploading. Then file a bug to extend the merge.

### "No holdings found in that file"

`previewCsv` returned an empty array. Means the file has the right
shape but the parser dropped every row.

**Triage**: open the file. If every row has `quantity === 0` (which
happens for a broker that exports zero-quantity rows for things like
options that have expired), the parser correctly skips them.

**Fix**: usually no fix — the file genuinely has no holdings to
import. Tell the user.

### "No recognised transactions found in that file"

Same shape as above but for activity CSVs. Either the file has no
recognized actions or every action's classifier returned null.

**Triage**: check Render logs for `csv activity: unrecognised action,
skipping row` warnings. Each one names the raw label.

**Fix**: extend `classifyActivity()` per the
[Architecture → Activity classifier](/architecture/activity-classifier/)
process.

### Money market position shows $0 (silently dropped)

Symptom: user's Fidelity account total in Beacon is way lower than
the broker shows. Difference is the SPAXX/FDRXX/CORE balance.

**Triage**: open the CSV, find the sweep row (usually has `**` in the
ticker, no quantity or price, real Current Value).

**Fix**: should be handled by the money-market detection in
`parseFidelity` (regex matches `**` suffix or "money market" /
"fdic.*sweep" / "core**" in description). If a new broker uses a
different sweep convention, extend the regex.

### Activity-only import gives $0 account balances

Symptom: user uploads `Accounts_History.csv`; transactions appear but
Holdings page shows $0 for the account; Net Worth ignores the activity.

**Triage**: the activity replay computes a running cash flow and
either creates a new Account with that balance, or BUMPs an existing
account's balance only if the cash flow exceeds the current balance.

**Fix**: usually works correctly. If you see this in the wild:
- Check Render logs for `CSV import complete` from the activity
  import; it reports the derived counts.
- Check the `Account.currentBalance` after import (via Prisma Studio
  or a SQL query). If it's 0, the cash-flow estimate didn't run.
- Confirm the activity rows have non-zero `amount` values — if they
  parse as 0 (currency symbol issue?), the cash flow stays 0.

### Holdings imported but Transactions/Dividends are empty

This is the most common user confusion, NOT a bug. The user uploaded
a **positions snapshot**, not an **activity history**. Different file.

Most brokers' default "Export" gives positions; activity is under
"History" or "Statements." The empty-state copy on the Transactions
and Dividends pages explains this; if the user missed it, walk them
through.

## Verify

After any fix:

1. Re-upload the same CSV via the dashboard.
2. The success banner should show non-zero counts for whatever the
   user expected.
3. Holdings / Transactions / Dividends pages should reflect the new
   data without a hard refresh (TanStack Query invalidates on
   import success).
