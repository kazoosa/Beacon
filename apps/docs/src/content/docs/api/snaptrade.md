---
title: SnapTrade endpoints
description: Connection portal URL, sync, disconnect, webhooks.
sidebar:
  order: 3
---

## `POST /api/snaptrade/connect-url`

Returns the URL to embed in the SnapTrade Connection Portal iframe.

**Auth**: bearer.

**Response 200**:

```json
{
  "redirect_url": "https://app.snaptrade.com/snapTrade/redeemToken?...",
  "mode": "snaptrade"
}
```

**Mode values**:
- `"snaptrade"` — production SnapTrade portal
- `"mock"` — for the demo developer, returns a fake link_token to feed
  to the local mock Link UI (`apps/link-ui`)

## `POST /api/snaptrade/sync`

Trigger a full sync of holdings + activities for the authenticated
user. Called automatically by `ConnectButton.afterSnapTradeConnect`
and by the manual Refresh button on Accounts page.

**Auth**: bearer.

**Response 200**:

```json
{
  "connections": 2,
  "accounts": 4,
  "holdings": 47,
  "transactions": 156,
  "raw_activities": 158,
  "skipped_unknown": 2,
  "skipped_labels": ["BUY_TO_OPEN", "ACH_RECEIPT"]
}
```

Field semantics (used by the diagnostic banner):
- `raw_activities` — total returned by SnapTrade BEFORE classification
- `skipped_unknown` — how many had labels the classifier didn't
  recognize
- `skipped_labels` — the actual unrecognized strings

These three fields let the diagnostic banner distinguish "broker
returned nothing" from "broker returned activities but Beacon's
classifier didn't recognize their labels." See [Runbook: SnapTrade
sync failures](/runbooks/snaptrade-failures/) for triage.

**Side effect**: fires the `refreshOptionQuotes` job if the user
holds any options. The response returns BEFORE the Tradier refresh
finishes.

## `POST /api/snaptrade/disconnect`

Revoke a SnapTrade authorization. Removes the matching Item +
cascade-deletes its accounts/holdings/transactions.

**Auth**: bearer.

**Request body**: `{ "connection_id": "<snaptradeAuthorizationId>" }`

**Response 200**: `{ "removed": true }`.

**Errors**: 404 if the connection doesn't exist or doesn't belong to
the authenticated developer.

## `POST /api/snaptrade/register`

Ensures the developer has a SnapTrade user registration. Idempotent —
safe to call repeatedly. The dashboard calls this early to prime the
relationship before the user clicks Connect.

**Auth**: bearer.

**Response 200**: `{ "user_id": "<snaptradeUserId>" }`.

## `GET /api/snaptrade/status`

Public status check for the SnapTrade integration on the backend
side. Used by the ops self-test.

**Response 200**:

```json
{
  "configured": true,
  "environment": "production"
}
```

`configured: false` when `SNAPTRADE_CLIENT_ID` or
`SNAPTRADE_CONSUMER_KEY` env vars are missing.

## `POST /api/snaptrade/webhooks`

SnapTrade webhook receiver. Verifies the HMAC-SHA256 signature, then
fires a sync for the relevant developer in the background.

**Auth**: HMAC signature in the `Signature` header. The shared
secret is `SNAPTRADE_WEBHOOK_SECRET` env var.

**Request body**: SnapTrade's webhook payload. Documented at
docs.snaptrade.com.

**Response 200**: `{ "received": true }`.

**Response 401**: missing or invalid signature.

**Response 503**: `SNAPTRADE_WEBHOOK_SECRET` not configured.

The response returns immediately; the actual sync runs
fire-and-forget so SnapTrade's webhook timeout doesn't matter.
