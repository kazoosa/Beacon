---
title: Architecture overview
description: How a request flows from browser click to database write and back.
sidebar:
  order: 1
---

## The big picture

Beacon is a classic three-tier app with two unusual wrinkles:

1. **Two import paths reach the same data model.** SnapTrade auto-sync
   and CSV import both write to the same `Account` / `InvestmentHolding`
   / `InvestmentTransaction` tables. The classifier and the option
   symbol parser are shared between paths.
2. **The Greeks/quote refresh is a fire-and-forget job triggered by the
   sync, not a separate scheduled cron.** Avoids a second BullMQ queue
   (which would mean more Redis cost) at the price of slight latency on
   the first page render after a sync.

## Request lifecycle

A typical "user clicks Holdings page" flow:

```
1. Browser
   └── React Router renders HoldingsPage
       └── useQuery("holdings") fires GET /api/portfolio/holdings via apiFetch
           └── apiFetch attaches Authorization: Bearer <accessToken>
               └── If 401, the global auth-refresh hook swaps for a fresh token
                   and replays the request transparently. (See Epic: Auth)

2. Vercel
   └── Static asset for /assets/index-*.js served from edge cache
       └── XHR to /api/* routed to apps/backend on Render

3. Render (vesly-backend)
   └── Express middleware
       ├── CORS (origin allowlist for vesly-dashboard.vercel.app)
       ├── JSON body parser
       ├── pino-http request logger
       └── requireDeveloper guard (decodes JWT → sets req.developerId)
   └── portfolio.routes.ts /holdings handler
       └── getPortfolioHoldings(developerId)
           ├── prisma.account.findMany (with item -> institution include)
           ├── prisma.investmentHolding.findMany (with security -> optionContract include)
           ├── Group by ticker, compute weights
           ├── Synthesize cash sleeve from currentBalance - sum(holdings)
           └── Add synthetic CASH row when cash > 0

4. Postgres (Neon)
   └── Two SELECTs above; one prepared statement each.

5. Response
   └── { holdings: [...], total_value: 12345.67 }

6. Browser
   └── TanStack Query stores in cache, HoldingsPage renders.
```

For a SnapTrade sync, substitute steps 3–5 with `syncDeveloper(dev)`
which:
- Lists brokerage authorizations and accounts via the SnapTrade SDK
- Per account: pulls positions (write `InvestmentHolding` rows) and
  activities (write `InvestmentTransaction` rows)
- Auto-sweeps any expired option holdings (writes synthetic
  `option_expired` ledger entries, zeros the holding)
- Fire-and-forget: refresh Tradier Greeks for any option contracts
  this user holds

## Where logic lives

| Concern | File | Notes |
|---|---|---|
| HTTP routing + guards | `apps/backend/src/routes/*.routes.ts` | Routes are thin; one file per URL prefix. |
| Business logic | `apps/backend/src/services/*.ts` | The interesting code lives here. |
| Data model | `apps/backend/src/prisma/schema.prisma` | Single source of truth. `prisma db push` syncs to Neon on deploy. |
| Auth + JWT | `apps/backend/src/utils/jwt.ts`, `apps/backend/src/middleware/auth.ts`, `apps/dashboard/src/lib/auth.tsx`, `apps/dashboard/src/lib/api.ts` | Refresh token flow split across both apps. |
| Activity classification | `apps/backend/src/services/activityClassifier.ts` | Shared by CSV and SnapTrade — single source for normalizing broker activity labels. |
| Option symbol parsing | `apps/backend/src/services/optionSymbolParser.ts` | Pure regex, no DB. Resolves Fidelity/OCC/SnapTrade shapes to canonical OCC. |

## Two import paths, one write surface

```
                       ┌──────────────────────────┐
   POST /csv/import ──►│  csvImportService.ts     │
                       │  importPositionsCsv ─────┼──┐
                       │  importActivityCsv  ─────┤  │
                       └──────────────────────────┘  │
                                                     ▼
                                          ┌──────────────────────────┐
                                          │  Postgres                │
                                          │   - Account              │
                                          │   - InvestmentHolding    │
                                          │   - InvestmentTransaction│
                                          │   - OptionContract       │
                                          └──────────────────────────┘
                                                     ▲
                       ┌──────────────────────────┐  │
   POST /snaptrade/   │  snaptradeService.ts     │  │
   sync ────────────► │  syncDeveloper ──────────┼──┘
                       └──────────────────────────┘
```

Both paths share:

- **`activityClassifier.ts`** for normalizing broker activity labels
  (`YOU BOUGHT`, `OPTIONEXPIRATION`, `DIVIDEND_REINVESTED`, etc) onto our
  ActivityType vocabulary.
- **`optionSymbolParser.ts`** for resolving Fidelity-style
  `-AMAT260424C400`, OCC-padded `AMAT  260424C00400000`, and
  SnapTrade structured `{ option_symbol, strike_price, ... }` to the
  same canonical OCC string. Cross-broker identity is preserved — two
  brokers reporting the same contract converge on one Security row.
- **`upsertSecurityWithTx` / `upsertSecurity`** for the option-aware
  Security + OptionContract upsert dance. CSV path uses the tx variant;
  SnapTrade uses the standalone variant.

## What the dashboard knows about the backend

Almost nothing schema-wise. The `apps/dashboard/src/lib/hooks/` and
page files contain hand-typed `interface` definitions that mirror the
JSON the backend returns. There's no shared TypeScript SDK at the wire
level — when you change a response shape, search for the field name in
the dashboard and update the matching interface.

We've considered moving these to `packages/shared/` with Zod schemas
that both produce the response (backend) and validate it (dashboard),
but the cost of the indirection has never beaten the simplicity of
"just keep the two interfaces in sync." See the open question in
[ADR: Shared types boundary](/adrs/shared-types/) (placeholder).

## What the ops surface knows

The ops mission-control deploy hits a few read-only endpoints (the
self-test runs ~11 calls) and renders the result. It does NOT have
credentials to mutate state in the backend; the worst it can do via the
API is read.
