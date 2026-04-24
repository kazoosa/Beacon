---
title: SnapTrade sync failures
description: Sync banner says "failed" or returns 0 transactions when there should be data.
sidebar:
  order: 3
---

## When to use this

- User reports "I connected my brokerage and Holdings is empty"
- The sync banner shows "0 transactions pulled"
- The sync banner shows "Sync failed — Internal server error" but
  holdings actually appeared
- A specific ticker is missing from holdings even though dividends or
  transactions reference it (the ULTY-shape bug)

## Triage

### Step 1: read the sync banner closely

After every Connect or Refresh, the banner reports:

- `accounts` / `holdings` / `transactions` counts
- `raw_activities` (what SnapTrade returned BEFORE classification)
- `skipped_unknown` (how many had unrecognized labels)
- `skipped_labels` (the actual unrecognized label strings)

The combination tells you which failure mode you're in:

| accounts | holdings | transactions | raw_activities | Diagnosis |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | SnapTrade returned no data — connection broken or never authorized |
| > 0 | 0 | 0 | 0 | Connection is alive, but broker returned nothing for this account |
| > 0 | > 0 | 0 | 0 | Broker returned positions but no activity — common, esp Robinhood within first 24h |
| > 0 | > 0 | 0 | > 0 | SnapTrade returned activities but our classifier rejected all of them — check `skipped_labels` |
| > 0 | > 0 | < raw_activities | > 0 | Some activities classified, some didn't — partial classifier coverage; check `skipped_labels` |
| missing one expected ticker | other tickers present | normal | normal | Symbol shape extractor didn't recognize that one ticker — check Render logs |

### Step 2: check Render logs

For the affected sync, look for:

```
snaptrade activities fetched {accountId, activityCount, totalReturned}
snaptrade: unrecognised activity type {rawType, accountId}
snaptrade: could not extract ticker from position; skipping {accountId, posKeys}
snaptrade: failed to upsert holding; continuing {err, accountId, ticker}
snaptrade: per-account sync failed; continuing with next account {err, accountId}
```

Each one points at a specific failure shape.

### Step 3: confirm the connection is alive on SnapTrade's side

Log in to SnapTrade's developer dashboard, find the user (by their
SnapTrade userId — visible in our Render logs), check that
their authorization shows as `disabled: false`. Disabled
authorizations need re-auth from the user; the dashboard should
prompt them but currently doesn't (open question in [Epic: SnapTrade
sync](/epics/snaptrade-sync/)).

## Fix

### "0 raw activities returned" for a known-good broker

If the user is on Robinhood and just connected: tell them to wait
24h. SnapTrade documents that Robinhood's activity feed lags the
initial connection.

If they've been connected for >24h and still 0 activities:

1. Trigger a manual sync via the dashboard's Refresh button.
2. If still 0, check SnapTrade's status page (status.snaptrade.com).
3. If SnapTrade is healthy, the broker itself may be rate-limiting
   the SnapTrade aggregator. Wait an hour and retry.

### "Unrecognized activity type" warnings

Each entry in `skipped_labels` is a label our classifier doesn't know.

1. Add a new branch in `apps/backend/src/services/activityClassifier.ts`
   mapping the label to the right `ActivityType`. Order matters — see
   [Architecture → Activity classifier](/architecture/activity-classifier/).
2. Add a test case to `apps/backend/test/activity-classifier.test.ts`.
3. PR + merge + deploy.
4. The next sync picks up the previously-skipped rows (the importer
   is idempotent via `snaptradeOrderId`).

### "Could not extract ticker from position; skipping"

`extractPositionSymbol` in `apps/backend/src/services/snaptradeService.ts`
didn't recognize the SnapTrade `pos.symbol` shape for that row. The
Render log line includes `posKeys` (the top-level keys of the
position object) — that gives you the nesting shape.

1. Add a new branch in `extractPositionSymbol`. The existing branches
   handle:
   - bare string at top level
   - one level of nesting (`pos.symbol.symbol`)
   - two levels of nesting (`pos.symbol.symbol.symbol`)
   - `raw_symbol` fallback
   - structured option payload
2. Whatever shape is missing, add it.
3. Test + deploy + the next sync picks up the missed positions.

### "Sync failed — Internal server error" but data appeared

This was the per-account try/catch case. If you see it on a recent
deploy, it means the wrapper got removed accidentally OR a new
unwrapped failure path was added.

Find the actual error in Render logs (search for `snaptrade: per-
account sync failed`) and address the underlying issue. The wrapper
should keep the user-facing banner from saying "failed."

## Verify

```bash
# Re-trigger the user's sync (you'll need their access token; easier
# to ask them to click Refresh).

# Check Render logs for the new sync; the warnings should be gone or
# fewer.

# Check the dashboard:
# - Holdings page should now include the previously-missing ticker
# - Transactions page should show the new rows
# - Dividends page YTD/Lifetime totals should bump by the new dividend rows
```

## Escalate

If SnapTrade's API itself is returning 500s or behaving strangely:

1. Check status.snaptrade.com.
2. Post in their Discord (`#api-support`).
3. Worst case: the user can fall back to importing CSV exports from
   their broker until SnapTrade resolves.
