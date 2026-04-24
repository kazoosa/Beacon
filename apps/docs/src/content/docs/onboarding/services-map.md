---
title: Services map
description: Every external service Beacon depends on, what it does, who pays, and how to log in.
sidebar:
  order: 4
---

## Production topology

```
                    Vercel                              Render
                ┌──────────────┐                  ┌──────────────────┐
   user ──────► │  dashboard   │ ─── HTTPS ─────► │ vesly-backend    │
                │ (React SPA)  │                  │ (Node + Express) │
                └──────────────┘                  └──────────────────┘
                       │                                  │   │   │
                       │                                  │   │   └──► Tradier sandbox (option Greeks)
                       │                                  │   └─────► SnapTrade API (brokerage data)
                       │                                  └─────────► Neon Postgres + Render Key Value (Redis)
                       │
                       └────────► Vercel edge functions (stock quote fallback chain)

ops mission control: separate Vercel project, calls vesly-backend's read-only ops endpoints.
docs (this site): separate Vercel project, no runtime backend.
```

## The services

### Vercel

**What** Hosts every frontend (dashboard, link-ui, ops, docs). Auto-deploys
on push to main from the relevant `apps/*` directory.

**Who pays** Hobby tier (free). Single fra1 region.

**Login** vercel.com — kazoosa@... is the owner.

**When you'd touch it** Env vars (`VITE_API_URL` on dashboard,
`GITHUB_TOKEN` on ops, `TRADIER_TOKEN` on backend if any frontend ever
needs it directly), build settings, custom domains.

**Note on regions** All projects pinned to fra1 (Frankfurt). The Hobby
tier only allows one region per project; the prod backend on Render is
us-east, so there's a transatlantic hop on every API call. We accept
this for cost; not worth Pro for the latency improvement at our scale.

### Render

**What** Hosts the backend (Docker container) and Render Key Value
(Redis). Builds on push to main.

**Who pays** Backend on Standard ($7/mo); Key Value on Free (25 MB).

**Login** render.com → vesly-backend service.

**When you'd touch it** Env vars (`DATABASE_URL`, `REDIS_URL`,
`SNAPTRADE_*`, `TRADIER_TOKEN`, `JWT_*`), Manual Deploy when GitHub
auto-deploy stutters (it does, occasionally — see
[Runbook: Render auto-deploy stuck](/runbooks/render-deploy-stuck/)).

**Migration history** We were on Upstash Redis; migrated to Render Key
Value after Upstash's 500K commands/month free quota was exhausted by
BullMQ's polling. See [ADR: Redis on Render Key Value](/adrs/redis-render/).

### Neon (Postgres)

**What** Managed Postgres for the backend. Connection pooler in
us-east-1.

**Who pays** Free tier; one project, one branch (`main`).

**Login** console.neon.tech.

**When you'd touch it** Mostly never — Prisma handles schema via
`prisma db push` on the entrypoint. If you need to inspect data
directly, the SQL editor in the Neon console works.

**Backups** Neon's free tier includes 7-day point-in-time recovery.
We've never had to use it. If you do, the runbook lives in
[Runbook: Postgres restore](/runbooks/postgres-restore/) (placeholder —
write it the first time we need it).

### SnapTrade

**What** Read-only OAuth aggregator for ~20 brokerages. Beacon uses
their SDK for both the Connection Portal (where the user authorizes a
broker) and the data sync (positions + activities).

**Who pays** Free for the first 25 simultaneous connections, then
~$0.50/connection/month. We're well under the free cap.

**Login** dashboard.snaptrade.com → Vesly application.

**When you'd touch it** API key rotation, webhook secret rotation,
debugging "broker returned no activities" reports. Their Discord is
the fastest channel for support questions.

### Tradier

**What** Option chain quotes + Greeks. Sandbox tier is genuinely free
for personal/non-commercial use.

**Who pays** No one — sandbox is free with rate limits (~120 req/min).

**Login** tradier.com → developer dashboard. Token is in the env.

**When you'd touch it** Token rotation (sandbox tokens don't expire,
but you might rotate after a leak), upgrading to production tier when
we exceed sandbox's rate limit.

### GitHub

**What** Source control + CI (none currently — tests run locally and
on Vercel/Render via build scripts) + Issues.

**Who pays** Free.

**Login** github.com/kazoosa/Beacon. Owner has admin; collaborators
get write.

**When you'd touch it** PRs, issues, the auto-deploy webhook to Render
(check Settings → Webhooks if Render stops deploying).

## Service health check

When prod feels off, run the full health sweep:

```bash
# Backend live
curl -s https://vesly-backend.onrender.com/health

# Demo session mints a token (proves Postgres + JWT signing work)
curl -sX POST https://vesly-backend.onrender.com/api/demo/session

# Dashboard loads (proves Vercel deploy is current)
curl -sI https://vesly-dashboard.vercel.app/

# Ops self-test (runs the full battery against the deployed backend)
open https://beacon-ops.vercel.app/
```

If any of these fail, jump to the matching runbook.

## Accounts a new engineer needs

You'll need invites to:

1. **GitHub repo** — write access
2. **Vercel team** — to read deploy logs and set env vars
3. **Render** — to read backend logs (you can read all logs without
   write; only the owner does deploys + env)
4. **Neon** — read-only role on the project
5. **SnapTrade dashboard** — to triage broker connection issues
6. **Tradier developer dashboard** — only if you're working on options

DM the current owner for invites. There's no IDP yet (no Google
Workspace SSO) — invites are individual.
