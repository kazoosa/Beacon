---
title: Testing strategy
description: What we test, where, why, and the philosophy behind the choices.
sidebar:
  order: 1
---

## The shape

Beacon's testing pyramid:

```
                 ┌──────────────────────┐
                 │   Manual UAT (you)   │  ← pre-release smoke
                 └──────────────────────┘
                 ┌──────────────────────┐
                 │ Ops self-test (live) │  ← post-deploy heartbeat
                 └──────────────────────┘
                 ┌──────────────────────┐
                 │  Integration (vitest) │  ← need Postgres
                 └──────────────────────┘
   ┌─────────────────────────────────────────────────┐
   │            Unit (vitest, no DB)                 │  ← the bedrock
   └─────────────────────────────────────────────────┘
```

We deliberately have:

- **Lots of unit tests** for the parsers, classifiers, and pure
  business logic
- **A handful of integration tests** for the auth flow + the things
  that genuinely need Postgres
- **A live smoke test** in the ops surface that hits production after
  every deploy
- **No e2e browser tests** yet (Playwright on the roadmap)

## Unit tests (the bedrock)

**Where**: `apps/backend/test/*.test.ts`

**Run**: `pnpm --filter @finlink/backend test`

**What's covered**:

| Area | File | Cases |
|---|---|---|
| Activity classifier | `activity-classifier.test.ts` | 68+ |
| Option symbol parser | `option-symbol-parser.test.ts` | 21 |
| Tradier client | `tradier-client.test.ts` | 13 |
| CSV detection | `csv-detection.test.ts` | 20 |
| Fidelity positions parser | `csv-fidelity-positions.test.ts` | 10 |
| Activity replay handoff | `csv-fidelity-activity-replay.test.ts` | 5 |
| Option lifecycle | `option-lifecycle-replay.test.ts` | 5 |
| CSV import error paths | `csv-import-errors.test.ts` | 2 |

Total: 140+ unit cases, all under 2 seconds.

**Philosophy**: pure functions get tested exhaustively. Every branch
of the activity classifier has at least one pinned label. Every shape
the option symbol parser handles has a round-trip test. The point
is to stop a refactor from silently breaking a code path the
classifier handled.

## Integration tests

**Where**: `apps/backend/test/*.test.ts` (intermixed with unit tests;
they self-skip when no Postgres reachable)

**What's covered**: auth flow (register / login / refresh / logout),
applications creation, link-flow happy path, sandbox demo session.

**Run**: same command — `pnpm --filter @finlink/backend test`. With
`DATABASE_URL` pointing at a real Postgres they execute; without
they print `[test setup] prisma migrate deploy failed — is postgres
running?` and skip.

**Why few**: Beacon's hot paths are mostly in service files that
take Prisma as a dependency-injected client. We mock Prisma where
it makes sense and lean on integration tests only where the SQL
itself is the thing being verified.

## Ops self-test (production heartbeat)

**Where**: `ops/api/ops.ts` `getSelfTest()` — runs in the ops surface
on demand from the UI.

**What it does**: 11-test battery against the live deployed backend:

1. Backend `/health` reachable
2. `POST /api/demo/session` mints a token
3. `POST /api/auth/login` refuses the demo email
4. `POST /api/auth/refresh` swaps tokens
5. `GET /api/portfolio/holdings` returns demo data
6. `GET /api/portfolio/transactions` returns demo data
7. `GET /api/portfolio/dividends` returns demo data
8. `GET /api/portfolio/accounts` returns demo data
9. `GET /api/csv/brokers` lists the 7 expected brokers
10. `POST /api/csv/detect` identifies a Fidelity CSV
11. `POST /api/csv/detect` identifies an IBKR CSV

Each test reports pass/fail + duration. Failures roll up as `warn`
on the master banner so they don't masquerade as a hard outage.

**When to run**: after every deploy, or when triaging a production
report. The ops UI has a Re-run button.

**What it's NOT**: it's a heartbeat, not coverage. It doesn't
exercise option lifecycle, dividend reinvestment, the cash sleeve,
SnapTrade-specific paths, or anything that needs a real broker
connection. Those are tested via UAT.

## UAT (user acceptance tests)

**Where**: [Testing → UAT plans](/testing/uat-plans/)

**When**: before any release the touches user-visible behavior in a
non-trivial way (auth flow, sync, import, options lifecycle, etc).

**Who runs it**: the engineer who wrote the change. Following the
written script, manually, in the dashboard.

**Why we don't automate it (yet)**: Playwright would be the right
answer once the feature surface stabilizes. Today the feature
surface still moves enough that a brittle e2e suite would cost more
than it saves. UAT is good enough until ~5x the current code velocity
slows.

## What we don't test (and why)

- **The dashboard React components** — no Jest, no Vitest UI suite,
  no Storybook. We render them in the dashboard manually. The
  components are mostly thin wrappers over `useQuery` + JSX; the
  business logic that's worth testing already lives in the backend.
- **Edge function quote endpoints** (Yahoo / Stooq / Finnhub
  fallback) — they're scrapers; their behavior changes when the
  upstream changes. Test would be flaky.
- **Tradier production behavior** — sandbox is what we use; testing
  against production would require real-time market hours.

## Test data

The seed script (`apps/backend/src/prisma/seed.ts`) builds a
realistic demo developer with:

- 4 brokerage Items
- 12+ Accounts across them
- 50+ holdings spanning equities, ETFs, options, cash
- A year of transaction history
- Dividend payments + reinvestments

This is the data the ops self-test exercises. Tests that need
specific edge cases (SPAXX money market, options with leading-space
tickers, Schwab activity-CSV quirks) include their own inline
fixtures. See [Testing → Fixtures](/testing/fixtures/).

## Adding tests when you ship a feature

The minimum:

- Any pure-function service code → at least one happy-path case + at
  least one edge case
- Any new branch in the classifier → a pinned case in the classifier
  test
- Any new symbol shape in the option parser → a pinned case + a
  round-trip identity case
- A new endpoint → a manual UAT step in the relevant UAT doc; an
  integration test only if it's load-bearing

Failing to add a test is a code smell, not a hard block. The reviewer
should ask "what's covering this?" — sometimes the answer is "the
existing classifier test, this is a one-line behavior change in the
same area" and that's fine.
