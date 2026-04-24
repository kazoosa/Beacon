---
title: API reference
description: Endpoints the dashboard talks to, request/response shapes, and auth requirements.
sidebar:
  order: 0
---

This is the working set of HTTP endpoints the Beacon dashboard
consumes. The backend also exposes a Plaid-clone-style SDK surface
(`/api/applications/*`, `/api/items/*`, `/api/accounts/*`,
`/api/link/*`, `/api/identity/*`, `/api/income/*`) that's vestigial
from the project's origins; see [Architecture → Data model](/architecture/data-model/)
for the model and [`apps/backend/src/routes/`](https://github.com/kazoosa/Beacon/tree/main/apps/backend/src/routes)
for the source.

## Auth

| Endpoint | Auth | Purpose |
|---|---|---|
| [`POST /api/auth/register`](/api/auth/) | none | Create a new Developer account |
| [`POST /api/auth/login`](/api/auth/) | none | Sign in (refuses the demo email) |
| [`POST /api/auth/refresh`](/api/auth/) | refresh token in body | Swap a refresh token for a fresh access + refresh pair |
| [`POST /api/auth/logout`](/api/auth/) | refresh token in body | Revoke the refresh token |
| [`POST /api/demo/session`](/api/auth/) | none | Mint a session for the shared demo developer (no password) |
| [`GET /api/demo/status`](/api/auth/) | none | Health check — confirms backend is up + DB reachable + demo developer exists |

## Portfolio

All require `Authorization: Bearer <accessToken>`.

| Endpoint | Returns |
|---|---|
| [`GET /api/portfolio/holdings`](/api/portfolio/) | Consolidated holdings across all brokerages, with option metadata + cash sleeve |
| [`GET /api/portfolio/transactions?type=&ticker=&count=&offset=`](/api/portfolio/) | Paginated transactions, filterable by type and ticker |
| [`GET /api/portfolio/dividends`](/api/portfolio/) | Monthly + ticker breakdown, YTD + lifetime totals |
| [`GET /api/portfolio/allocation?rollupOptions=true|false`](/api/portfolio/) | Pies by ticker, by brokerage, by asset class |
| [`GET /api/portfolio/accounts`](/api/portfolio/) | Connected brokerage accounts |
| [`GET /api/portfolio/by-symbol/:symbol`](/api/portfolio/) | Per-ticker detail (used by StockDetail) — includes option metadata + Greeks when applicable |
| [`GET /api/portfolio/summary`](/api/portfolio/) | Net worth + cost basis + unrealized P/L + day change + YTD dividends |
| [`POST /api/portfolio/wipe-demo`](/api/portfolio/) | Clears mock items (CSV-sourced, not SnapTrade) for the user — used by the dev "Clear sample data" button |
| [`DELETE /api/portfolio/accounts/:itemId`](/api/portfolio/) | Disconnect a brokerage; cascades to all sub-accounts/holdings/transactions |

## SnapTrade

| Endpoint | Auth | Purpose |
|---|---|---|
| [`POST /api/snaptrade/connect-url`](/api/snaptrade/) | bearer | Returns the Connection Portal URL for the embedded iframe |
| [`POST /api/snaptrade/sync`](/api/snaptrade/) | bearer | Trigger a full sync of holdings + activities for this user |
| [`POST /api/snaptrade/disconnect`](/api/snaptrade/) | bearer | Revoke a SnapTrade authorization |
| [`POST /api/snaptrade/register`](/api/snaptrade/) | bearer | Ensure SnapTrade user registration (called early by the dashboard) |
| [`GET /api/snaptrade/status`](/api/snaptrade/) | none | Public status check |
| [`POST /api/snaptrade/webhooks`](/api/snaptrade/) | HMAC signature | SnapTrade webhook receiver |

## CSV import

| Endpoint | Purpose |
|---|---|
| [`GET /api/csv/brokers`](/api/csv/) | List supported brokers |
| [`POST /api/csv/detect`](/api/csv/) | Detect broker + kind from a CSV body |
| [`POST /api/csv/preview`](/api/csv/) | Parse a CSV without writing — returns the structured preview |
| [`POST /api/csv/import`](/api/csv/) | Parse + write to DB |

## Stocks (Vercel edge functions, NOT the backend)

These run on Vercel's edge runtime, in the dashboard's `api/`
directory:

| Endpoint | Purpose |
|---|---|
| `GET /api/stocks/quote/:symbol` | Yahoo → Stooq → Finnhub fallback chain for live price |
| `GET /api/stocks/history/:symbol?range=1mo` | OHLC candles for the sparkline + chart |
| `GET /api/stocks/news/:symbol` | News headlines (coverage uneven by design) |

## Conventions

**Auth header**: `Authorization: Bearer <accessToken>`. Missing or
invalid token returns 401.

**Errors**: response shape is consistent:

```json
{
  "error_type": "VALIDATION_ERROR",
  "error_code": "BROKER_REQUIRED",
  "error_message": "Couldn't detect broker from this CSV — please specify manually.",
  "display_message": null,
  "request_id": "T7n2MXzp2EUJ_GDyHe44E",
  "environment": "production",
  "details": null
}
```

`display_message` is set when the message is safe to show users
verbatim. `error_message` is for engineer triage. `request_id`
correlates with Render logs.

**Naming**: response field names are snake_case (
`ticker_symbol`, `current_balance`, `unrealized_pl`). Internal TypeScript
types use camelCase. Each consumer maps at the boundary.

**Pagination**: `count` (default 100, max 500) + `offset`. No cursors.

**Idempotence**: writes that touch external state are idempotent where
possible. CSV imports re-running the same file are safe (deterministic
external IDs); SnapTrade syncs re-pulling the same activities use
SnapTrade's own ID so they upsert.
