---
title: Local setup
description: Get Beacon running on your machine in under 30 minutes.
sidebar:
  order: 3
---

## Prerequisites

- **Node 20.x** (the engines field in `package.json` pins this; pnpm
  refuses to install if you're on an older major)
- **pnpm 9 or 10** (`corepack enable && corepack prepare pnpm@10 --activate`)
- **Docker Desktop** (for local Postgres + Redis)
- **A Neon account** if you want to dev against the real schema (free tier
  is fine; create a personal project)

If you're on Apple Silicon: everything works native, no Rosetta needed.

## First-time install

```bash
git clone https://github.com/kazoosa/Beacon.git
cd Beacon
pnpm install
```

This installs every workspace and runs `prisma generate` automatically
(via the `@prisma/client` postinstall hook).

## Local Postgres + Redis

```bash
# Postgres on 5432, Redis on 6379. The compose file lives at the repo root.
docker compose up -d
```

If you don't have a `docker-compose.yml` checked in, the equivalent
one-liners are:

```bash
docker run -d --name beacon-pg \
  -e POSTGRES_PASSWORD=beacon \
  -e POSTGRES_DB=beacon \
  -p 5432:5432 postgres:16

docker run -d --name beacon-redis \
  -p 6379:6379 redis:7-alpine
```

## Backend env vars

Create `apps/backend/.env`:

```ini
DATABASE_URL=postgresql://postgres:beacon@localhost:5432/beacon
REDIS_URL=redis://localhost:6379
NODE_ENV=development

# JWT — anything random for local; generate with `openssl rand -hex 32`
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# SnapTrade sandbox — only needed if testing the real-account flow
SNAPTRADE_CLIENT_ID=...
SNAPTRADE_CONSUMER_KEY=...

# Tradier sandbox — only needed for option Greeks
TRADIER_TOKEN=...

# Used by the link-token endpoint; not security-critical for local
LINK_TOKEN_SECRET=local-dev-secret
WEBHOOK_SIGNING_SECRET=local-dev-secret
```

The optional secrets (SnapTrade, Tradier) are safe to leave unset for
most local dev — the code paths that need them log a warning and fall
back to safe behavior. See the [Tradier ADR](/adrs/tradier-sandbox/) and
[SnapTrade epic](/epics/snaptrade-sync/) for details.

## Initial schema push + seed

```bash
pnpm --filter @finlink/backend prisma:generate   # regenerate client after env load
pnpm --filter @finlink/backend exec prisma db push  # create tables from schema.prisma
pnpm --filter @finlink/backend run seed             # populate the demo developer + sample holdings
```

`prisma db push` is the local equivalent of what runs on Render at deploy
time (see [ADR: Prisma db push, no migrations](/adrs/prisma-db-push/)).
The seed script idempotently creates the demo user `demo@finlink.dev`
with a varied portfolio.

## Run the dev servers

The root `pnpm dev` script starts everything in parallel:

```bash
pnpm dev
```

This runs:

- **backend** on `http://localhost:3001`
- **dashboard** on `http://localhost:5174`
- **link-ui** on `http://localhost:5175`

To run individually: `pnpm dev:backend`, `pnpm dev:dashboard`, etc.

The dashboard's Vite config proxies `/api/**` to the backend on 3001 in
dev, so you don't need to set `VITE_API_URL`.

## Run the docs site

```bash
pnpm --filter @finlink/docs dev
# -> http://localhost:4321
```

## Verify your setup

```bash
# 1. Backend health check
curl http://localhost:3001/health
# {"status":"ok","commit":"...","uptime":12.3}

# 2. Demo session works (mints a token without password)
curl -X POST http://localhost:3001/api/demo/session

# 3. Backend tests pass (unit only; integration tests skip without DATABASE_URL pointing at a clean DB)
pnpm --filter @finlink/backend test

# 4. Dashboard typecheck
pnpm --filter @finlink/dashboard typecheck

# 5. Open the dashboard
open http://localhost:5174/landing
```

If all five succeed you're set. If any fails, the troubleshooting checklist:

| Symptom | Likely cause | Fix |
|---|---|---|
| `prisma migrate deploy failed — is postgres running?` in test output | Postgres not reachable | `docker ps`, restart Postgres container, re-check `DATABASE_URL` |
| `Cannot find module '@finlink/shared'` | shared package not built | `pnpm --filter @finlink/shared build` |
| Dashboard 404s on `/api/...` | dashboard dev server not proxying | Restart `pnpm dev:dashboard`; check `vite.config.ts` proxy is intact |
| Backend hangs on startup with `IORedis Error: ECONNREFUSED` | Redis not running | Start the Redis container; or set `WEBHOOK_WORKER_ENABLED=false` to skip the worker |
| 401 on every API call from dashboard | Stale localStorage token | Open dev tools → Application → Local Storage → clear `finlink_auth*` keys |

## What to do next

Pick something from [Epics & Stories](/epics/) — they're sized so each
one is a digestible mental model — then write a small change to that
area and open a PR. Or jump to [Architecture overview](/architecture/overview/)
for the request-lifecycle big picture before reading code.
