---
title: Welcome
description: What Beacon is, who it serves, and what you're about to work on.
sidebar:
  order: 1
---

## What Beacon is

Beacon is a portfolio aggregation dashboard for retail investors. The user
connects one or more brokerage accounts (Fidelity, Schwab, Vanguard,
Robinhood, IBKR, plus crypto exchanges via Coinbase / Kraken / Binance) and
Beacon shows their unified holdings, transactions, dividends, asset
allocation, and option positions in one view.

Two import paths reach the same data model:

1. **SnapTrade auto-sync** — read-only OAuth via the SnapTrade API. The
   user authorizes once; Beacon refreshes positions + activities on a
   schedule and on-demand.
2. **CSV import** — for brokers SnapTrade doesn't cover (or coverage gaps
   for specific data types like options on Vanguard), the user drops the
   broker's positions or activity export and Beacon parses it.

The dashboard is a Vite + React SPA; the API is a Node + Express backend
on Render with a Postgres-on-Neon datastore and Redis-on-Render-Key-Value
for the BullMQ webhook worker.

## Who it serves

- **Active retail investors** with positions across 2+ brokerages who're
  tired of logging into each one to see total net worth.
- **Income-focused investors** (DRIP, dividend-paying ETFs, covered calls)
  who want a real dividend report, not just a "you got paid" line item.
- **Options traders** who want strike/expiry/Greeks/days-to-expiry
  visible alongside their stock positions, not in a separate broker tab.

What Beacon **isn't**: a broker, a robo-advisor, or a tax tool. We're
read-only. Users still execute trades at their broker.

## Tech-stack at a glance

| Layer | What |
|---|---|
| Frontend dashboard | Vite + React 18 + React Router 6 + TanStack Query, deployed to Vercel |
| Frontend ops | A separate Vite + React mission-control deploy (status, deploys, signups, self-test) |
| Backend API | Node 20 + Express + Prisma 5 (Postgres on Neon) |
| Worker | BullMQ on Redis (Render Key Value) — webhook delivery only |
| External: brokerage data | SnapTrade SDK |
| External: option Greeks | Tradier sandbox |
| External: stock quotes | Yahoo / Stooq / Finnhub fallback chain via Vercel edge functions |

## What you'll do here

If you're new, follow these in order:

1. [Repo tour](/onboarding/repo-tour/) — what each directory is for.
2. [Local setup](/onboarding/local-setup/) — Postgres, Redis, env vars, dev servers.
3. [Services map](/onboarding/services-map/) — every external service you'll touch and how to log in.
4. [Architecture overview](/architecture/overview/) — the request lifecycle from user click to DB write.
5. [Testing strategy](/testing/strategy/) — what we test, where, and why.

Then pick an open issue from the [GitHub board](https://github.com/kazoosa/Beacon/issues)
and start a feature branch.

## Conventions

- **Branches**: `feat/<short-description>`, `fix/<short-description>`,
  `docs/<short-description>`. No tickets-in-branch-names — links live in
  the PR body.
- **Commits**: imperative tense, present-day. Body explains "why" not
  "what". See [`CONTRIBUTING.md`](https://github.com/kazoosa/Beacon/blob/main/CONTRIBUTING.md)
  if it exists in repo, otherwise mirror the pattern in recent commits.
- **PRs**: every change goes via PR. Direct push to `main` is enabled
  for emergencies but rarely used; the auto-merge from a green PR is
  the default path.
- **Tests**: backend unit suite must stay green; new features need at
  least one new vitest case. Integration suite (needs Postgres) lives
  in the same `test/` directory but skips at runtime when no DB is
  reachable — see [Testing → Strategy](/testing/strategy/).
