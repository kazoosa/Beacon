---
title: Testing
description: Strategy, UAT plans, fixtures, and the auto-generated test↔feature traceability matrix.
sidebar:
  order: 0
---

Beacon's testing surface in one place.

## What's here

- [Strategy](/testing/strategy/) — what we test, where, why, and the
  tradeoffs we accepted (small unit suite + manual UAT + production
  smoke test, no e2e yet).
- [UAT plans](/testing/uat-plans/) — the manual scripts you run before
  shipping a release.
- [Fixtures](/testing/fixtures/) — where test data lives and how to
  add new fixtures without leaking real account info.
- [Test ↔ feature traceability](/testing/traceability/) — auto-generated
  matrix of every test file and the feature it covers. Regenerated
  on every docs build via `scripts/generateTraceability.mjs`.

## Running tests

```bash
# Backend unit + integration tests (integration self-skips without Postgres)
pnpm --filter @finlink/backend test

# Single file
pnpm --filter @finlink/backend test test/option-symbol-parser.test.ts

# Watch mode
pnpm --filter @finlink/backend test --watch

# TypeScript check (catches a lot of test breakage before vitest ever runs)
pnpm --filter @finlink/backend typecheck
```

The full backend suite runs in under 2 seconds when no Postgres is
reachable (integration tests skip), or about 5 seconds with a live
Postgres.

## Updating the traceability matrix

The matrix at [Test ↔ feature traceability](/testing/traceability/)
is built from the actual `describe()` and `it()` strings in
`apps/backend/test/*.test.ts`. When you add a new test file, the
generator picks it up automatically — but you need to register the
file's feature mapping or the build will warn about an unmapped file.

To register: edit
[`apps/docs/scripts/generateTraceability.mjs`](https://github.com/kazoosa/Beacon/blob/main/apps/docs/scripts/generateTraceability.mjs)
and add an entry to the `FEATURE_BY_FILE` object pointing at the
matching epic + (optional) architecture page.

To regenerate locally without rebuilding the whole site:

```bash
pnpm --filter @finlink/docs regen-traceability
```

The page lives at `src/content/docs/testing/traceability.md` and is
kept in version control so it's reviewable in PRs.
