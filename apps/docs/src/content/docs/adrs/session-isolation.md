---
title: Demo sessions in sessionStorage, real in localStorage
description: ADR — split storage backends so a demo session in one tab can't pollute a real session in another.
sidebar:
  order: 2
---

## Context

Beacon supports two session types in the dashboard:

- **Real account session**: persists across tabs and browser
  restarts. Single sign-on across the user's entire browser is the
  expected behavior.
- **Demo session**: minted on-demand for the shared
  `demo@finlink.dev` account. Anyone can mint one without a password
  via `POST /api/demo/session`.

Originally both lived in `localStorage` under a single
`finlink_auth` key. The bug we hit:

1. User signs in to their real account in Tab A.
2. User opens the demo in Tab B (which writes the demo token to shared
   localStorage).
3. User reloads Tab A.
4. Tab A reads localStorage, sees the demo token, and silently shows
   the demo data with a green "logged in" indicator. The real account
   is gone from this tab's view until the user re-signs-in.

Worse, the user thought they were still in their real account and
considered making decisions based on the (demo) numbers.

## Decision

- **Real sessions** → `localStorage`, key `finlink_auth`
- **Demo sessions** → `sessionStorage`, key `finlink_auth_demo`
- **`readStored()`** in `apps/dashboard/src/lib/auth.tsx` checks
  sessionStorage **first** so a demo tab can never be flipped to a
  real session by another tab writing to localStorage.

The `RequireAuth` route guard further enforces: if the visitor lands
on `/app/*` with a demo session in this tab, redirect to the matching
`/demo/*` URL so the URL bar always reflects which account is being
browsed.

## Trade-offs

**What we give up**:

- **No demo persistence across tabs**: opening a new tab + going to
  `/demo` will mint a fresh demo session for that tab. (This is fine
  — the demo data is shared across all demo sessions; only the JWT
  is per-tab.)
- **Slight code complexity**: `readStored` / `writeStored` /
  `clearStored` need to know which key to use. Implemented as a thin
  abstraction in `auth.tsx`.

**Alternatives rejected**:

- **Single localStorage with a session-type field**: still leaks
  across tabs — same root issue.
- **Cookies with `__Host-` prefix**: would solve cross-tab pollution
  but adds CORS complexity (dashboard on vercel.app, backend on
  onrender.com — different domains, so cookies need `SameSite=None;
  Secure`).
- **Fully separate origins for demo vs real (demo.beacon.app)**: solves
  the problem at the URL level but requires a second Vercel project
  + DNS + cert + a second SnapTrade application. Overkill.

## Revisit when

- We adopt a real cookie-based session for some other reason and the
  same-origin / SameSite story is solved generically.
- The demo flow gets so much usage that "demo doesn't survive tab
  close" becomes user-hostile (it currently doesn't because demo data
  is shared).
