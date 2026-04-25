# Local Docker Loop

The minimum stack to repro a SnapTrade sync end-to-end against your own browser.

## What runs where

| Layer        | Where it runs              | Why |
|--------------|----------------------------|-----|
| Postgres 15  | Docker (`postgres:5432`)   | Persistent DB, fresh each `compose down -v` |
| Redis 7      | Docker (`redis:6379`)      | BullMQ queue |
| Backend API  | `pnpm dev:backend` on host | Fast restart, real stack traces, easy to add `console.log` |
| Dashboard    | `pnpm dev:dashboard`       | HMR — see UI changes instantly |
| Link UI      | `pnpm dev:link-ui`         | Only for the demo (mock) flow |

The backend Dockerfile exists for prod parity but for iteration we run backend on the host so changes hot-reload.

## One-time setup

```sh
# 1. Fill in SnapTrade keys in .env
#    SNAPTRADE_CLIENT_ID=...
#    SNAPTRADE_CONSUMER_KEY=...
#    (Optional) TRADIER_TOKEN=...

# 2. Bring up Postgres + Redis
docker compose up -d postgres redis

# 3. Push schema
pnpm --filter @finlink/backend exec prisma db push

# 4. Generate Prisma client
pnpm --filter @finlink/backend run prisma:generate
```

## The iterate loop

In three terminals (or panes):

```sh
# T1 — backend
pnpm dev:backend
# logs go to stdout. Pino-pretty formats nicely if installed.

# T2 — dashboard
pnpm dev:dashboard
# served at http://localhost:5174

# T3 — link-ui (only needed for demo flow, not real SnapTrade)
pnpm dev:link-ui
```

Then open http://localhost:5174 and connect a brokerage.

## Watching SnapTrade calls

Every SDK call now goes through `safeCall` in [snaptradeService.ts](apps/backend/src/services/snaptradeService.ts). Failed calls log:

```json
{
  "level": 50,
  "snaptradeCall": "list_accounts",
  "status": 401,
  "message": "Invalid credentials",
  "responseBody": { ... },
  "url": "https://api.snaptrade.com/api/v1/...",
  "method": "GET",
  "userId": "..."
}
```

Filter the backend log for `snaptrade:` to see only SnapTrade activity:

```sh
pnpm dev:backend | grep -E "snaptrade:|error"
```

## Wiping state

```sh
# Wipe the DB and start fresh
docker compose down -v && docker compose up -d postgres redis
pnpm --filter @finlink/backend exec prisma db push
```

## Tearing down

```sh
docker compose down       # keep volumes (data persists)
docker compose down -v    # nuke volumes (clean slate)
```

## Common gotchas

- **"Cannot connect to Postgres" from backend on host:** The backend's `DATABASE_URL` in `.env` points at hostname `postgres` (the docker network name). When running backend on the host, override to `localhost`: `DATABASE_URL=postgresql://finlink:finlink@localhost:5432/finlink pnpm dev:backend`.
- **Stale Prisma client:** After schema changes run `pnpm --filter @finlink/backend run prisma:generate`. IDE may need restart.
- **CORS errors in browser:** Backend reads `CORS_ORIGINS` from `.env`. Default already includes `localhost:5174` and `:5175`.
- **SnapTrade `mode: "unconfigured"`:** Means `.env` is missing `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY`. Fill them in and restart backend.
