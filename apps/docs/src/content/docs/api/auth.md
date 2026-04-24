---
title: Auth endpoints
description: Sign-up, sign-in, refresh, logout, demo session, and the demo health-check endpoint.
sidebar:
  order: 1
---

## `POST /api/auth/register`

Create a new Developer account.

**Request body**:

```json
{
  "email": "user@example.com",
  "password": "minimum-8-chars",
  "name": "Optional Display Name"
}
```

**Response 200**:

```json
{
  "developer": { "id": "...", "email": "...", "name": "..." },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Errors**: 400 (invalid email / weak password), 409 (email already
registered), 401 (refuses `demo@finlink.dev`).

## `POST /api/auth/login`

Sign in with email + password.

**Request body**: `{ "email": "...", "password": "..." }`

**Response 200**: same shape as register.

**Errors**: 401 on bad credentials. **Always** 401 (never 404) for
the demo email — we don't want to leak that the demo account exists
as a target.

## `POST /api/auth/refresh`

Swap a refresh token for a fresh access + refresh pair. The old
refresh token is revoked.

**Request body**: `{ "refresh_token": "eyJ..." }`

**Response 200**:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Errors**: 401 if the refresh token is missing, expired, revoked,
or signature-invalid. The dashboard's auth provider handles 401 here
by signing the user out (no infinite refresh loop).

## `POST /api/auth/logout`

Revoke the refresh token.

**Request body**: `{ "refresh_token": "eyJ..." }`

**Response 200**: `{ "success": true }`. Idempotent — revoking an
already-revoked token still returns 200.

## `POST /api/demo/session`

Mint a fresh access + refresh pair for the shared demo developer.
No password required. Anyone can hit this endpoint.

**Request body**: empty.

**Response 200**:

```json
{
  "developer": {
    "id": "...",
    "email": "demo@finlink.dev",
    "name": "Demo Developer"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

The dashboard stores the resulting tokens in **`sessionStorage`** (per-
tab) so a demo tab can't pollute a real-account session in another tab.
See [Architecture → Auth & sessions](/architecture/auth/).

## `GET /api/demo/status`

Public health endpoint. Confirms backend is up, Postgres is reachable,
and the demo developer exists in the DB.

**Response 200**:

```json
{
  "status": "ok",
  "environment": "production",
  "demoDeveloperExists": true,
  "investmentHoldingCount": 38,
  "uptime": 12345.67
}
```

Used by:
- The ops self-test (sub-test #1)
- [Runbook: Production smoke test](/runbooks/prod-smoke-test/)

A non-200 response or `demoDeveloperExists: false` means the demo
flow is broken; runbook the issue.
