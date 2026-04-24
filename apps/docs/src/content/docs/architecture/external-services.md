---
title: External services
description: Every third-party API Beacon depends on, what we send/receive, and what to do when it breaks.
sidebar:
  order: 5
---

This page covers what flows over the wire to each external API. For
account access ("who do I ask for a Vercel invite?"), see
[Onboarding → Services map](/onboarding/services-map/).

## SnapTrade

**Used for**: brokerage account aggregation.

**Auth**: API key + consumer key in env (`SNAPTRADE_CLIENT_ID` +
`SNAPTRADE_CONSUMER_KEY`). Each end-user gets a `userSecret` that we
store in `Developer.snaptradeUserSecret` after their first connection.

**Endpoints we call**:

| Endpoint | When | What we do |
|---|---|---|
| `POST /authorizations/login` | User clicks Connect | Returns a `redirect_url` that opens the SnapTrade Connection Portal. |
| `GET /accounts` | Every sync | Lists all the user's connected accounts. |
| `GET /accounts/{id}/positions` | Every sync, per account | Pulls current holdings. |
| `GET /transactionsAndReporting/getActivities` | Every sync | Pulls activity (trades, dividends, etc) for the configured lookback window. |
| `DELETE /authorizations/{id}` | User clicks Disconnect | Revokes the brokerage authorization. |
| `POST /webhooks` | Configured once | Their webhook posts back to `/api/snaptrade/webhooks` on transaction/holding changes. |

**Quirks worth knowing**:

- The `getActivities` endpoint takes a comma-separated `accounts` filter
  string. We discovered the SDK returns `[]` silently when you pass a
  single bare ID — we now omit the filter and filter client-side. See
  [Epic: SnapTrade sync](/epics/snaptrade-sync/).
- Symbol metadata for option positions lives at multiple nesting depths
  depending on the broker. `extractPositionSymbol` in
  `snaptradeService.ts` handles the four shapes we've seen in the
  wild.
- Some brokers (Robinhood occasionally) don't surface activity history
  for the first 24h after connect — Beacon's "0 transactions" banner
  tells the user this is normal.

**When it breaks**: see [Runbook: SnapTrade sync failures](/runbooks/snaptrade-failures/).

## Tradier

**Used for**: option Greeks + IV + mark prices.

**Auth**: bearer token in env (`TRADIER_TOKEN`). Sandbox tokens don't
expire.

**Endpoints we call**:

| Endpoint | When | What we do |
|---|---|---|
| `GET /v1/markets/quotes?symbols=...&greeks=true` | After every sync that touches an option holding | Batch up to 50 OCC symbols per call; persist Greeks + mark to OptionContract + Security. |

**Quirks**:

- Symbol format is unpadded OCC (`AAPL250117C00200000`, no space
  padding). We strip the spaces from our canonical padded form before
  sending and remap the response back.
- Returns one of three response shapes depending on count: object for
  single, array for multi, literal string `"no quotes"` when nothing
  matched. The client handles all three.
- IV lives in `greeks.mid_iv`; falls back to `greeks.smv_vol` when
  unset (some illiquid contracts).
- 429 rate-limited at ~120 req/min. The refresh job aborts the
  remaining batches on a 429 and lets the next tick pick up where it
  left off.

**When it breaks**: see [Runbook: Tradier rate-limited or down](/runbooks/tradier-down/).

## Yahoo Finance / Stooq / Finnhub (via Vercel edge)

**Used for**: stock quotes for the Stocks page (StockList, StockDetail).

**Where**: these aren't called from our backend. They're called from
Vercel **edge functions** in the dashboard repo (under `apps/dashboard/api/`
or similar — check the actual location, may have moved). The edge function
has its own fallback chain: Yahoo first, then Stooq, then Finnhub. Each
returns a normalized shape.

**Auth**: Yahoo and Stooq are unauthenticated scrapes; Finnhub uses a
free-tier API key.

**Quirks**:

- Yahoo returns `previousClose === currentPrice` outside market hours,
  which the dashboard handles by showing a "live quote unavailable"
  badge instead of a fake $0.00 day change.
- Coverage gaps for newer ETFs (ULTY) and option contracts; the
  Stocks page handles missing news / quotes gracefully.

## Vercel & Render & Neon & Render Key Value

These are infra, not APIs we send data to in the request path. See
[Architecture → Deployment](/architecture/deployment/) for the topology.

## What we don't (currently) integrate with

- **Plaid** — considered for non-brokerage accounts (checking, savings).
  Out of scope for now.
- **Stripe** — no payments yet. The pricing page is informational.
- **Sentry / Datadog** — no error tracking SaaS. We rely on Render +
  Vercel logs. Open question whether to add Sentry once we have paying
  users.
- **A real news API** — the Stocks page's headlines come from whatever
  Yahoo's news endpoint returns. Coverage is uneven by design.

## Adding a new external service

When you wire up a new third-party API:

1. **Add the env var** to `apps/backend/.env.example` (create it if
   absent) and document it in [Onboarding → Local setup](/onboarding/local-setup/).
2. **Wrap the SDK in a service file** under `apps/backend/src/services/`
   so the rest of the codebase doesn't import the third-party SDK
   directly. Unit-test the wrapper with `vi.spyOn(globalThis, 'fetch')`
   for HTTP-based services or by mocking the SDK module otherwise.
3. **Document the call site** here (this page).
4. **Write a runbook** in `apps/docs/src/content/docs/runbooks/` for
   "what to do when this service is down/throttled/returning bad
   data."
5. **Add the service to the ops self-test** if it's load-bearing for
   user-visible features.
