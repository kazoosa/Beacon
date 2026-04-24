---
title: SnapTrade sync
description: Read-only OAuth into 20+ brokerages, holdings + activity sync, post-sync option-quote refresh.
sidebar:
  order: 2
---

## What the user sees

1. Click "Connect a Brokerage" on the Accounts page.
2. SnapTrade's hosted Connection Portal opens (embedded iframe).
3. User selects their broker, authorizes via OAuth.
4. Portal closes; Beacon shows a "Sync complete · X accounts, Y
   holdings, Z transactions pulled" banner.
5. Holdings + Transactions + Dividends pages populate.

A periodic refresh and a manual "Refresh now" button on the Accounts
page re-pull updates.

## What the system does

```
ConnectButton (dashboard)
   └── POST /api/snaptrade/connect-url ──► returns SnapTrade portal URL
       └── User completes OAuth ──► portal posts back to dashboard
           └── ConnectButton.afterSnapTradeConnect()
               └── POST /api/snaptrade/sync ──► syncDeveloper(dev)

syncDeveloper(developer)
   ├── ensureSnapTradeUser → returns userId + userSecret
   ├── listBrokerageAuthorizations → connections[]
   │
   ├── for each connection:
   │     ├── upsert Institution + Item rows
   │     ├── listUserAccounts → accounts[]
   │     │
   │     └── for each account (wrapped in try/catch — one failure doesn't kill the sync):
   │           ├── upsert Account row
   │           ├── deleteMany InvestmentHoldings (wipe + recreate)
   │           ├── getUserAccountPositions → positions[]
   │           │     └── for each position:
   │           │           ├── extractPositionSymbol (option-aware)
   │           │           ├── upsertSecurity (with OptionContract for options)
   │           │           └── upsert InvestmentHolding (multiplier-aware for options)
   │           │
   │           └── getActivities (no per-account filter — see "Quirks")
   │                 └── for each activity:
   │                       ├── classifyActivity → ActivityType
   │                       └── upsert InvestmentTransaction (idempotent via snaptradeOrderId)
   │
   ├── sweepExpiredOptions(developer.id)
   │     └── synthetic option_expired ledger entry + zero the holding
   │         for any expired contract still showing as held
   │
   └── fire-and-forget refreshOptionQuotes(developer.id)
         └── batch OCC symbols (50 per call) → Tradier
              └── persist Greeks + IV + mark to OptionContract + Security
```

## Stories that built it

### Story: Initial SnapTrade integration

**What**: Connect Portal, position sync, basic activity sync.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — `syncDeveloper`
- `apps/backend/src/routes/snaptrade.routes.ts` — `/connect-url`,
  `/sync`, `/disconnect`, `/webhooks`
- `apps/dashboard/src/components/ConnectButton.tsx` — UI

**Decisions**: SnapTrade chose us not the other way around — we
considered Plaid Investments, but Plaid's $500/mo minimum is
prohibitive at our scale and SnapTrade is free under 25 connections.
See [ADR: SnapTrade vs Plaid](/adrs/snaptrade-vs-plaid/).

### Story: Per-account try/catch around sync

**What**: Wrap the per-account loop in a try/catch so one bad account
doesn't fail the whole sync. Per-row holding writes are also wrapped.

**Why**: Users were getting "Sync failed — Internal server error"
banners even when most of their accounts had synced successfully. The
500 was coming from a single bad row in a single account; without
per-account isolation it killed everything.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — try/catch wrappers
  + per-row upsert error logging

### Story: Option-aware position extractor

**What**: `extractPositionSymbol` runs `parseOptionSymbol` first.
Recognised options return an `OptionSpec` alongside the canonical OCC
ticker; the upserter then writes Security with `type: "option"` plus
an OptionContract row.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — `extractPositionSymbol`,
  `upsertSecurity` option branch

**Related**: [Epic: Options](/epics/options/) for the full options
feature.

### Story: Drop the per-account filter on getActivities

**What**: The `accounts` parameter on `getActivities` accepts a
comma-separated string. Passing a single bare account ID returns `[]`
silently with some SDK versions. We now omit the filter and filter
client-side via `act.account.id === accId`.

**Why**: This was the "user connected Robinhood and got 0
transactions" bug. Robinhood works with SnapTrade for activities; the
SDK's filtering was the issue.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — `getActivities` call site

### Story: Sync-result banner with diagnostics

**What**: The frontend banner after a sync shows raw activities
fetched, classifier-skipped count, and the unrecognized labels
themselves.

**Why**: Without this, "0 transactions returned" was indistinguishable
from "0 raw activities returned" was indistinguishable from "all
activities had unknown labels." The diagnostics let us extend the
classifier or tell the user which broker is the issue in seconds.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — `syncDeveloper`
  return shape
- `apps/dashboard/src/components/ConnectButton.tsx` — banner rendering
- `apps/dashboard/src/pages/AccountsPage.tsx` — Refresh banner

### Story: Resilient holdings via upsert

**What**: Per-position writes use `upsert` keyed on
`(accountId, securityId)` instead of `create`. Any leftover ghost
holding from a stale account is silently overwritten instead of
triggering the misleading "duplicate rows" error.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts`

### Story: Auto-sweep + post-sync Tradier refresh

**What**: After the per-account loops, `sweepExpiredOptions` clears
any expired-but-still-held contracts. Then a fire-and-forget
`refreshOptionQuotes` pulls Greeks for every option this user holds.

**Files touched**:
- `apps/backend/src/services/snaptradeService.ts` — sweep + Tradier trigger
- `apps/backend/src/jobs/refreshOptionQuotes.ts` — the job itself

## Failure modes

| Symptom | Cause | Where to look |
|---|---|---|
| "Sync failed — Internal server error" but holdings actually appeared | A non-fatal error after writes completed (used to bubble out as a 500) | Render logs for the actual error; should be wrapped now via per-account try/catch |
| 0 transactions returned for a broker that should have history | SnapTrade activity feed delay (some brokers, esp Robinhood, take 24h after first connect) OR classifier doesn't recognize the labels | Sync banner shows raw_activities and skipped_labels; check Render logs for `snaptrade: unrecognised activity type` |
| ULTY (or other newer ETF) shows in dividends but not holdings | `extractPositionSymbol` didn't recognize the symbol shape | Render logs for `could not extract ticker from position; skipping`; extend the extractor with the new shape |
| User clicks Disconnect, holdings stay | Cascade delete on Item didn't fire (rare) | Manually delete the orphan holdings; check `onDelete: Cascade` is intact in schema |
| Greeks always null on the option detail page | `TRADIER_TOKEN` not set on Render OR Tradier rate-limited | Check env; see [Runbook: Tradier rate-limited](/runbooks/tradier-down/) |

See [Runbook: SnapTrade sync failures](/runbooks/snaptrade-failures/) for
the full triage tree.

## Tests

`apps/backend/test/snaptrade-helpers.test.ts` covers symbol extraction
and activity classification edge cases. The full sync function isn't
unit-tested (it'd need a SnapTrade SDK mock with too many shapes); the
pieces are.

## Open questions

- **Webhook-driven sync**: SnapTrade can webhook us on
  `holdings.updated` / `transactions.historical_update` events. We have
  the webhook endpoint scaffolded but currently rely on user-triggered
  syncs. Worth wiring up so positions stay fresh without action.
- **Lookback window**: defaults to 1 year (`SNAPTRADE_HISTORY_YEARS`).
  Multi-year first-time pulls have been observed to return `[]` for
  Robinhood specifically. Open question whether to bump after first
  successful sync.
- **Connection health surface**: SnapTrade reports `disabled: true`
  on a connection that's broken (user revoked at the broker, password
  changed, etc). We surface `status: "ERROR"` on the Item but the
  dashboard doesn't prompt the user to re-connect. Should.
