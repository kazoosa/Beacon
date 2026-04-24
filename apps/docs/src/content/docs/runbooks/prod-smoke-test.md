---
title: Production smoke test
description: 60-second health sweep when "is prod OK?" is the question.
sidebar:
  order: 1
---

## When to use this

- After any deploy you didn't watch closely
- When a user reports something broken and you want to know if it's
  them or you
- Before a known-risky change to confirm baseline is healthy

## Run the sweep

```bash
# 1. Backend live + correct version
curl -s https://vesly-backend.onrender.com/health
# Expect: {"status":"ok","commit":"<recent sha>","uptime":<seconds>}

# 2. Demo session mints (proves Postgres + JWT signing work)
curl -sX POST https://vesly-backend.onrender.com/api/demo/session
# Expect: {"developer":{...},"access_token":"...","refresh_token":"..."}

# 3. Real auth blocks the demo email (proves the safety check is intact)
curl -s -X POST https://vesly-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@finlink.dev","password":"wrong"}'
# Expect: 401 with "Invalid credentials"

# 4. Dashboard loads and points at the right backend
curl -sI https://vesly-dashboard.vercel.app/ | head -1
# Expect: HTTP/2 200

# 5. Quote endpoint works (Vercel edge function fallback chain)
curl -s https://vesly-dashboard.vercel.app/api/stocks/quote/AAPL | head -c 200
# Expect: a JSON quote with at least { price, change, changePct }

# 6. Ops self-test (the comprehensive check)
open https://beacon-ops.vercel.app/
# Expect: green Self-test card with 11/11 passing
```

## Triage

If any of the above fails:

| Failed check | Most likely cause | Jump to |
|---|---|---|
| 1 (health) | Render service crashed or restarting | [Render auto-deploy stuck](/runbooks/render-deploy-stuck/) — check the deploy log; if no recent deploy, check Render service status |
| 2 (demo session) | Postgres unreachable or JWT secret unset | Check Render env vars (`DATABASE_URL`, `JWT_ACCESS_SECRET`); check Neon dashboard for DB status |
| 3 (login blocks demo) | Backend running an OLD build (the safety check was added recently) | Trigger a manual Render deploy from the latest commit |
| 4 (dashboard 200) | Vercel deploy failed or paused | Check Vercel project deploys; redeploy from main |
| 5 (quote endpoint) | All three quote providers (Yahoo, Stooq, Finnhub) down OR Vercel edge fn errored | Check Vercel function logs; usually self-heals |
| 6 (self-test) | Multiple sub-tests failing — read the card for specifics | Each sub-test maps to a specific endpoint; failure on a single one usually points to that endpoint's runbook |

## Verify after a deploy

The minimum after-deploy check:

1. Run all 6 above
2. Hard-refresh `https://vesly-dashboard.vercel.app/landing` and click
   "Try the demo" → confirm the dashboard loads with data
3. If the deploy touched options: open the Options page in the demo,
   confirm at least one contract appears with non-empty days-to-expiry

## Escalate

If steps 1 or 2 are still failing after 10 minutes of attempted fixes,
this is a real outage:

1. Roll back to the previous Render deploy (Render dashboard → Deploys
   → previous → "Redeploy this commit"). 3 min to recovery.
2. Roll back the Vercel deploy (one-click in Vercel dashboard). 10 sec.
3. Post in #incidents (placeholder for when we have an incidents
   channel).
4. After recovery: write a postmortem in
   `apps/docs/src/content/docs/runbooks/postmortems/` (create the dir
   the first time we need it).
