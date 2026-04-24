---
title: Deployment
description: How code goes from a PR merge to live in production.
sidebar:
  order: 6
---

## The pipelines

```
                                          ┌──────────────────┐
                                          │  Vercel          │
                git push origin main ────► (dashboard, ops,  │
                                          │  docs, link-ui)  │
                                          └────────┬─────────┘
                                                   │ webhook
                                                   ▼
                                          ┌──────────────────┐
                                          │  Render          │
                                          │  (vesly-backend) │
                                          └──────────────────┘
```

Every push to main triggers builds in parallel on Vercel and Render.

## Vercel

**Project per app**:
- `vesly-dashboard` ← `apps/dashboard`
- `beacon-ops` ← (separate repo)
- `beacon-docs` ← `apps/docs` (added by this doc-site PR)
- `link-ui` ← `apps/link-ui`

Vercel auto-detects the framework (Vite for dashboard/link-ui, Astro
for docs) and runs the appropriate build command. Each project has its
own env vars.

**Build settings** for the dashboard:
- Framework: Vite
- Build command: `pnpm --filter @finlink/dashboard build`
- Output directory: `apps/dashboard/dist`
- Install command: `pnpm install --frozen-lockfile=false` (we don't
  commit a lockfile yet — TODO: revisit)
- Root directory: `apps/dashboard`

**Region**: fra1 (Frankfurt). Hobby tier allows one region per project.

**Deploy time**: ~2 min for the dashboard. Vercel caches `node_modules`
and the Vite build cache aggressively, so iteration is fast.

## Render

**Service**: `vesly-backend` (single Docker web service)

**Build**: Dockerfile multi-stage build:
1. base: node:20-alpine + pnpm
2. deps: install workspace deps with `--filter @finlink/backend...`
3. build: copy source, run `tsc -b`, run `prisma generate`
4. runtime: copy `dist/`, copy `prisma/` schema, copy entrypoint script

**Entrypoint** (`apps/backend/docker-entrypoint.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[entrypoint] applying schema with prisma db push"
pnpm exec prisma db push --accept-data-loss --skip-generate
echo "[entrypoint] seed if empty"
node dist/scripts/seedIfEmpty.js || true
echo "[entrypoint] starting server"
exec node dist/server.js
```

`prisma db push` syncs the schema; `seedIfEmpty` populates the demo
developer if the DB is fresh; `node dist/server.js` starts Express.

**Deploy time**: ~5 min. Render is slower than Vercel because of the
Docker layer rebuilds.

**Auto-deploy**: enabled on main. Render polls GitHub for the latest
commit on a 30-60s interval; sometimes the webhook is missed and the
deploy stalls — see [Runbook: Render auto-deploy stuck](/runbooks/render-deploy-stuck/).

## Promotion path (dev → prod)

There is no staging environment. Every PR runs locally; merging to main
is the prod release.

This is fine **at our scale** because:
- The backend has good unit-test coverage
- The dashboard build catches type errors before deploy
- Customer base is small enough to absorb a 5-minute revert if
  something slips

It would NOT be fine at 10x more users. If/when we cross that line, the
plan is:
1. Add a `staging` Render service that deploys from a `staging` branch
2. Add a `staging` Vercel project for the dashboard
3. Add a manual promotion step (cherry-pick or merge `staging` → `main`)

Tracked as an open question in [ADR: Single-environment deploy](/adrs/single-env/) (placeholder).

## Rollback

**Vercel**: every commit produces a unique URL like
`vesly-dashboard-abc123.vercel.app`. To roll back, find the last good
deploy in the Vercel dashboard and click "Promote to Production." Takes
~10 seconds.

**Render**: keeps the previous deploy as `deactivated`. To roll back,
go to Deploys → the previous one → "Redeploy this commit." Takes
~3 minutes (no shortcut for backend).

**Database**: Neon provides 7-day point-in-time recovery on the free
tier. Use it for "we deployed a bad migration" only — never for "an
end user clicked the wrong button" because that's a single-user issue
and PIT restore is account-wide.

## Env var hygiene

Every secret has a single source-of-truth env in Render or Vercel.
**Never check in `.env` files**. The `.env.example` (TODO: create) is
the only on-disk reference.

When rotating a secret:
1. Generate the new value
2. Update Render / Vercel env
3. Redeploy (env changes don't auto-deploy on Render — they trigger
   a deploy when you save, but the timing isn't always reliable)
4. Invalidate the old secret upstream (e.g. revoke the SnapTrade key
   on their dashboard)

## Observability

**Logs**:
- Render: `vesly-backend` → Logs tab. Streams live, filterable by level.
- Vercel: each project → Logs. Edge function logs are in the same view.

**Metrics**:
- Render shows CPU/memory/restart count on the service dashboard.
- Vercel shows request count + p95 latency per route.

**Errors**: no structured error tracker yet. We notice errors via:
1. The ops self-test page (manually checked)
2. User reports
3. Render's restart-loop alert

This is the biggest visibility gap in production. Sentry is the
obvious next step; not done yet to keep the stack simple.
