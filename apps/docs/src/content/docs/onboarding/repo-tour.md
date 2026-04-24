---
title: Repo tour
description: What every top-level directory contains and when you'd touch it.
sidebar:
  order: 2
---

## Layout

```
finlink/
├── apps/
│   ├── backend/        Node + Express + Prisma. The API + worker.
│   ├── dashboard/      Vite + React SPA. The customer surface.
│   ├── docs/           This documentation site (Astro + Starlight).
│   └── link-ui/        Mock SnapTrade Link UI for the demo flow.
├── packages/
│   └── shared/         Zod schemas + TypeScript types shared between
│                       backend and dashboard. Built before either app.
├── pnpm-workspace.yaml pnpm workspace declaration.
└── package.json        Root scripts (dev, build, test, etc).
```

There is no `apps/ops` in this repo — the ops mission-control surface
lives in a separate repo (`Beacon-ops` on GitHub) and deploys to its
own Vercel project. We share the backend; ops calls a few read-only
endpoints to render its dashboard.

## When you'd touch each one

### `apps/backend/`

The Express API + the BullMQ worker live here. Inside:

```
apps/backend/
├── src/
│   ├── prisma/
│   │   ├── schema.prisma     The single source of truth for the data model.
│   │   └── seed.ts           Demo seed data for local + the public demo.
│   ├── routes/               One file per top-level URL prefix.
│   │   ├── auth.routes.ts
│   │   ├── portfolio.routes.ts
│   │   ├── snaptrade.routes.ts
│   │   ├── csv.routes.ts
│   │   ├── demo.routes.ts
│   │   └── ...
│   ├── services/             Business logic. Routes are thin; logic lives here.
│   │   ├── csvImportService.ts
│   │   ├── snaptradeService.ts
│   │   ├── portfolioService.ts
│   │   ├── activityClassifier.ts
│   │   ├── optionSymbolParser.ts
│   │   ├── tradierClient.ts
│   │   └── ...
│   ├── jobs/                 BullMQ job definitions + the post-sync option-quote refresh.
│   ├── utils/                Errors, crypto, generic helpers.
│   └── server.ts             Express bootstrap.
├── test/                     Vitest suite. Unit + integration in the same dir;
│                             integration tests skip when no Postgres is reachable.
├── docker-entrypoint.sh      Runs prisma db push + seed-if-empty + node dist/server.js.
└── Dockerfile                Multi-stage Node build for Render.
```

Touch `routes/` for new endpoints, `services/` for new business logic,
`prisma/schema.prisma` for new tables. Always pair backend changes with
test updates in `test/`.

### `apps/dashboard/`

The customer-facing SPA at `vesly-dashboard.vercel.app`. Inside:

```
apps/dashboard/
├── src/
│   ├── pages/                One file per route. Routing is handled
│   │                         by APP_ROUTES in App.tsx; new pages just
│   │                         get added to that array and they auto-mount
│   │                         under both /app/* and /demo/*.
│   │   ├── OverviewPage.tsx
│   │   ├── HoldingsPage.tsx
│   │   ├── stocks/StocksPage.tsx
│   │   ├── OptionsPage.tsx
│   │   ├── ...
│   ├── components/           Reusable building blocks. ConnectButton,
│   │                         CsvImport, MiniSparkline, ui/sidebar, etc.
│   ├── lib/                  Auth provider, apiFetch, hooks.
│   ├── App.tsx               Routes + guards (RequireAuth / RequireDemo).
│   └── main.tsx              React mount.
└── vite.config.ts            Dev proxy to backend, build config.
```

Touch `pages/` for new routes, `components/` for shared UI, `lib/` for
hooks or utils.

### `apps/docs/`

This site. Adding a new page is just dropping an MD or MDX file into
`src/content/docs/<section>/`; the sidebar autogenerates from the file
tree. Section order is defined in `astro.config.mjs`.

### `apps/link-ui/`

A mock SnapTrade Link iframe used by the demo flow. Real users hit
SnapTrade's hosted Link directly via `snaptrade-react`. You almost
never touch this.

### `packages/shared/`

Zod schemas + TypeScript types that both backend and dashboard consume.
Anything that crosses the wire (request bodies, response shapes) should
live here so a schema change in one place breaks the other at compile
time. Built first in the workspace `build` order — `pnpm -r run build`
respects the dependency graph.

## What's not in this repo

- **Production secrets**: env vars on Vercel and Render. Never check
  in `.env` files.
- **The Postgres data**: lives on Neon. Local dev uses Docker (see
  [Local setup](/onboarding/local-setup/)).
- **Test fixtures with real account numbers**: stripped before
  committing — see [Testing → Fixtures](/testing/fixtures/).
- **The ops surface**: separate repo (`Beacon-ops`).
