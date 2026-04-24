---
title: Auth & sessions
description: How the JWT refresh flow works, why demo and real sessions live in different storage, and what to do when a token expires.
sidebar:
  order: 4
---

## The shape

Beacon uses two-token JWT auth:

| Token | Lifetime | Where it lives client-side | Sent how |
|---|---|---|---|
| Access token | 15 minutes | Memory (React context) + localStorage/sessionStorage backup | `Authorization: Bearer <token>` on every API call |
| Refresh token | 30 days | localStorage (real) / sessionStorage (demo) | Body of `POST /api/auth/refresh` |

The 15-minute access lifetime keeps stolen tokens short-lived; the
30-day refresh lifetime means the user signs in roughly once a month.

## The refresh dance

The dashboard installs a global "auth refresh" hook on mount via
`installAuthRefresh()` from `apps/dashboard/src/lib/api.ts`. Every
`apiFetch` call:

1. Sends the request with the current access token.
2. If the response is **401**, calls the refresh hook to swap for a
   fresh access token.
3. If the refresh succeeds, replays the original request once with the
   new token.
4. If the refresh fails, signs the user out so they don't see a stuck
   loading screen.

```
User clicks Holdings ──► apiFetch("/api/portfolio/holdings")
                            │
                            ├──► 200 OK ─────────────► render
                            │
                            └──► 401 ──► tryRefresh()
                                            │
                                            ├──► 200 OK (new tokens)
                                            │       └──► replay original ──► 200 OK ──► render
                                            │
                                            └──► 401 ──► signOut() ──► redirect to /login
```

**Inflight refresh dedup**: a burst of parallel 401s (which happens on
page load when 6 queries fire at once and the access token has aged
out) all share a single refresh round-trip via a module-level
`inflightRefresh` promise.

## Why demo + real sessions live in separate storage

Real sessions go to **`localStorage`** (`finlink_auth` key) so they
persist across tabs and browser restarts.

Demo sessions go to **`sessionStorage`** (`finlink_auth_demo` key) so
they're scoped to a single tab.

Why the split? If they shared storage, this would happen:

1. User signs in to their real account in Tab A.
2. User opens the demo in Tab B (which writes the demo token to shared storage).
3. User reloads Tab A.
4. Tab A reads shared storage, sees the demo token, and silently shows
   the demo data with a green "logged in" indicator. The real account is
   gone from this tab's view until the user re-signs-in.

We had this exact bug before the split. See [ADR: sessionStorage
isolation](/adrs/session-isolation/) for the full rationale.

`readStored()` in [`apps/dashboard/src/lib/auth.tsx`](https://github.com/kazoosa/Beacon/blob/main/apps/dashboard/src/lib/auth.tsx)
checks sessionStorage **first** so a demo tab can't be flipped by another
tab writing to localStorage.

## Routes

The dashboard mounts every authenticated route under both `/app/*` and
`/demo/*`:

- `RequireAuth` wraps `/app/*` routes. If the visitor has no session,
  redirect to `/login`. If the visitor has a *demo* session in this
  tab, redirect to the matching `/demo/*` URL — keeps the URL bar
  honest about which account is being browsed.

- `RequireDemo` wraps `/demo/*` routes. If the visitor has no session
  (or has a real session in this tab), mint a fresh demo session in
  sessionStorage. The mint endpoint is `POST /api/demo/session` which
  signs JWT pairs for the shared `demo@finlink.dev` user without
  requiring a password.

`useTo()` and `useBasePath()` in `apps/dashboard/src/lib/basePath.ts`
expose the active prefix so internal links know whether to point at
`/app/foo` or `/demo/foo`.

## Auth on the backend

Every authenticated route is gated by `requireDeveloper` middleware
(`apps/backend/src/middleware/auth.ts`) which:

1. Reads the `Authorization` header
2. Verifies the JWT signature with `JWT_ACCESS_SECRET`
3. Sets `req.developerId` from the JWT subject claim
4. Throws `Errors.unauthorized()` (401) on any failure

The demo email is **explicitly blocked** on `/api/auth/login` and
`/api/auth/register` — anyone can mint a demo session, so allowing
password-based login on that email would let an attacker change its
password and lock out the public demo. See `auth.routes.ts` line ~40.

## Refresh token storage

Refresh tokens are stored hashed in Postgres (`RefreshToken` table).
On `/api/auth/refresh`:

1. Look up the hashed refresh token by `tokenHash` (sha256 of the
   incoming token)
2. Reject if not found, expired, or revoked
3. Mint new access + refresh, **rotate** the refresh token (write a
   new row, mark the old one as `replacedById` for audit)
4. Return the new pair

Rotation means a stolen refresh token only works once; the legitimate
holder's next refresh fails (because the token was rotated by the
attacker), which is detectable as a "rotation chain divergence" if we
ever add the alerting.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Every page is empty after login | Bundle cache is stale (Vercel deploy in flight) | Hard refresh (Cmd+Shift+R) |
| Signed-in indicator flickers between real and demo | Two tabs (one demo, one real) writing to localStorage | Don't — the split is supposed to prevent this. If you see it, file a bug; the storage split was likely undone in some refactor. |
| Sudden logout after ~15 min of activity | Refresh token was revoked or expired | Check Render logs for `refresh: invalid token` warnings — usually a deploy invalidated the JWT secret |
| Sudden logout the moment you open the dashboard | localStorage was cleared (browser settings, ad blocker, etc) | Sign in again. If it persists, check for content-blocking extensions. |

## Open questions

- **Refresh token reuse detection**: we don't currently alert on
  "rotation chain divergence." Worth adding as a security signal.
- **Rate limiting**: there's no per-IP limiter on `/api/auth/login`
  yet. Brute-forcing a password is theoretically possible. The
  TODO is to add `express-rate-limit` keyed by IP+email.
- **MFA**: no plan to add. Beacon is read-only — the worst-case after
  a compromise is "attacker sees your stocks." Not worth the UX cost.
