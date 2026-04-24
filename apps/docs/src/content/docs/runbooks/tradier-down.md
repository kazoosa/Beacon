---
title: Tradier rate-limited or down
description: Option Greeks always null; the Tradier refresh job is failing or being throttled.
sidebar:
  order: 4
---

## When to use this

- The Options page shows contracts but every Greek is "—"
- StockDetail option mode shows "Greeks pending" indefinitely
- Render logs show `tradier rate-limited; aborting refresh`
- Render logs show `tradier auth failed (401); check TRADIER_TOKEN`

## Triage

### Step 1: confirm the symptom

```bash
# Hit Tradier directly with our token to see what they return
TOKEN=$(grep TRADIER_TOKEN apps/backend/.env | cut -d= -f2)  # local
# In prod: get the value from Render's Environment tab, don't print to logs

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://sandbox.tradier.com/v1/markets/quotes?symbols=AAPL250117C00200000&greeks=true" \
  | jq .
```

Possible responses:

- **Full quote with greeks block** → Tradier is healthy, the
  problem is in Beacon's refresh job. Check the next step.
- **`{"fault": ...}`** with rate-limit text → 429.
- **HTML login page** → token is invalid.
- **Network timeout** → Tradier sandbox is down.

### Step 2: check whether the refresh job ran

```bash
# Render logs, filter for tradier
# Should see one of:
#   "option quotes refresh complete" {refreshed, skipped, errored, durationMs}
#   "tradier rate-limited; aborting refresh"
#   "tradier batch failed; skipping batch"
#   "TRADIER_TOKEN not set; option Greeks refresh skipped"
```

If there's NO tradier log line in the last hour after a sync, the
post-sync trigger isn't firing — that's a code-path issue, not a
Tradier issue.

## Fix

### Token unset

Set `TRADIER_TOKEN` in Render's environment. Get a sandbox token
from tradier.com's developer portal (free, no credit card). Trigger
a redeploy or wait for the next env-change-triggered restart.

### 401 (token invalid)

Likely the token was rotated upstream. Generate a new one at
tradier.com and update the Render env var.

### 429 (rate-limited)

Sandbox is ~120 req/min. We batch 50 symbols per call, so the floor
is one user with 6,000 contracts which we'll never have. If we're
hitting 429:

- Multiple users syncing at exactly the same moment → naturally
  resolves on the next refresh tick
- A loop in our refresh code is firing repeatedly → check for
  multiple post-sync triggers per sync (shouldn't happen, but
  worth a Render log scan)

The job is designed to abort gracefully on 429 and let the next tick
pick up. So a transient 429 is self-healing; persistent 429 means a
code bug.

### Tradier sandbox down

Sandbox is not 100%. If the curl in step 1 times out or returns 5xx,
wait an hour and retry. There's no SLA on the free tier.

If we're consistently being affected by sandbox outages, the upgrade
path is to swap to production tier ($X/mo, real SLA) by changing
`TRADIER_BASE_URL` env and the corresponding token. See [ADR: Tradier
sandbox](/adrs/tradier-sandbox/).

## Verify

After the token is fixed or Tradier recovers:

1. Trigger a sync from the dashboard (Refresh on Accounts page).
2. Wait ~30 seconds for the post-sync refresh to run.
3. Open an option's StockDetail page → Greeks should populate within
   a page reload or two.
4. Render logs should show a healthy `option quotes refresh complete`
   line with `refreshed > 0`.

## What never to do

- **Don't disable the refresh entirely** during a partial outage.
  The job is fail-safe — null greeks are better than no data, and
  the next refresh fills in. Disabling means we forget to re-enable.
- **Don't paper over with hardcoded Greeks** for missing contracts.
  No data is honest; fake data is dangerous.
