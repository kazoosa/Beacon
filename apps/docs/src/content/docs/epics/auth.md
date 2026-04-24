---
title: Auth & sessions
description: Sign in, sign out, demo mode, refresh-token flow, and per-tab session isolation.
sidebar:
  order: 1
---

## What the user sees

- A `/landing` page when unauthenticated.
- `/login` and `/register` flows with email + password.
- A "Try the demo" button that takes the user into a fully-functional
  demo of Beacon without an account, scoped to that browser tab.
- Once signed in, the dashboard at `/app/*` for real accounts or
  `/demo/*` for the demo. The URL bar always reflects which account
  is being browsed.
- Sessions persist for ~30 days with seamless renewal — no surprise
  logouts during a working session.

## What the system does

See [Architecture → Auth & sessions](/architecture/auth/) for the
detailed flow. The TL;DR:

- **Two-token JWT**: 15-min access, 30-day refresh. Refresh rotates on
  every use.
- **Real sessions in localStorage** (cross-tab persistent), **demo
  sessions in sessionStorage** (per-tab, can't pollute a real
  session).
- **Global auth-refresh hook**: every 401 transparently refreshes and
  replays the request once.

## Stories that built it

### Story: Initial sign-in / sign-up flow

**What**: Email + password sign-in. Bcrypt password hash. JWT tokens
returned in response body, stored client-side.

**Files touched**:
- `apps/backend/src/routes/auth.routes.ts` — register / login / refresh / logout endpoints
- `apps/backend/src/utils/jwt.ts` — sign + verify
- `apps/backend/src/middleware/auth.ts` — `requireDeveloper` guard
- `apps/dashboard/src/lib/auth.tsx` — React context + provider
- `apps/dashboard/src/pages/PreviewSignInPage.tsx` — UI

**Decisions**:
- JWT, not session cookies. Beacon is split across two domains
  (dashboard.vercel.app and backend.onrender.com) so cookie scoping
  would be painful. JWT in headers is simpler.
- Bcrypt over Argon2: Node has first-class bcrypt; Argon2 needs native
  bindings that complicate the Render Alpine container.

### Story: Demo mode

**What**: Anyone can mint a session for the shared `demo@finlink.dev`
user without a password by hitting `POST /api/demo/session`. The
dashboard's `/demo/*` routes auto-mint via the `RequireDemo` guard.

**Files touched**:
- `apps/backend/src/routes/demo.routes.ts` — the mint endpoint
- `apps/backend/src/routes/auth.routes.ts` — block the demo email on
  `/login` and `/register` so an attacker can't change the password
  and lock out the public demo
- `apps/dashboard/src/App.tsx` — `RequireDemo` + `RootRoute` redirect

**Decisions**:
- Mint on guard mount, not on a user action. Users sometimes deep-link
  into `/demo/holdings` and we want it to "just work" without a click.
- Block the demo email on password endpoints. The mint endpoint
  bypasses the password check; if we also accepted the password
  endpoint, the first attacker to hit `/register` with `demo@finlink.dev`
  would own it.

### Story: Per-tab session isolation

**What**: Demo sessions go to sessionStorage, real sessions to
localStorage. `readStored()` checks sessionStorage first.

**Why**: We had a bug where opening the demo in one tab silently
flipped a real-account tab to demo data on next refresh. The split
cleanly prevents that.

**Files touched**:
- `apps/dashboard/src/lib/auth.tsx` — `readStored`, `writeStored`,
  storage key constants

**ADR**: [ADR: Demo sessions in sessionStorage](/adrs/session-isolation/)

### Story: Auto-refresh on 401

**What**: A global hook installed by `AuthProvider` on mount catches
401s in `apiFetch` and refreshes + replays.

**Files touched**:
- `apps/dashboard/src/lib/api.ts` — `installAuthRefresh`,
  `tryRefresh`, `fetchWithAuth`
- `apps/dashboard/src/lib/auth.tsx` — wires the hook on mount

**Decisions**:
- Inflight refresh dedup: a burst of parallel 401s shares one refresh
  round-trip via a module-level `inflightRefresh: Promise<...>`.
- On refresh failure → sign out, not silent error. The previous
  behavior (silently leaving the user on stale empty data) was
  indistinguishable from "your CSV import was lost." See [Epic: CSV
  import](/epics/csv-import/) for the related symptom.

### Story: Mirrored /app + /demo routes

**What**: Every authenticated route is mounted under both prefixes
via the `APP_ROUTES` array. `RequireAuth` redirects demo-session
users to `/demo/*`; `RequireDemo` mints a demo session if one isn't
present.

**Files touched**:
- `apps/dashboard/src/App.tsx` — route table + guards
- `apps/dashboard/src/lib/basePath.ts` — `useBasePath()` and `useTo()`
  hooks for components that need to build internal links

**Decisions**:
- Mirror the routes rather than serve a single set under one prefix.
  Lets the URL bar always reflect "you're on the demo" vs "you're on
  your real account," which prevents a class of confusion bugs.

## Failure modes

| Symptom | Cause | Remediation |
|---|---|---|
| Sign-in returns 500 | JWT secrets unset on Render | Set `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` env vars |
| Demo button does nothing | Backend's `/api/demo/session` endpoint missing or 500ing | Check Render logs; demo developer must exist in DB (run seed) |
| Sudden mass-logout after deploy | New JWT secret in Render env (rotation) — every old token is now invalid | Expected; users sign in again |
| Demo session pollutes real account tab | Session-isolation regression — sessionStorage write went to localStorage | Bug. Check `readStored` precedence in `auth.tsx` |
| User gets logged out every 15 min | Refresh-token endpoint not reachable, or refresh token rejected | Check `/api/auth/refresh` returns 200; check `RefreshToken` row in DB has `expiresAt > now` and `revokedAt IS NULL` |

## Tests

The auth surface has both unit and integration tests in `apps/backend/test/`:

- `auth.test.ts` — register / login / refresh / logout integration tests (need Postgres)
- `applications.test.ts` — Application creation on first developer

The traceability matrix is auto-generated; see
[Testing → Test↔feature traceability](/testing/traceability/).

## Open questions

- **Refresh token reuse detection**: rotation chain divergence is a
  detectable security signal we don't currently alert on.
- **Rate limiting on /login**: brute-forcing a password is theoretically
  possible. Add `express-rate-limit` keyed by IP+email.
- **MFA**: not on the roadmap. Beacon is read-only; the worst-case
  after compromise is "attacker sees your stocks." Not worth the UX
  cost.
