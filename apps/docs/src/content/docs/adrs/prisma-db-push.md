---
title: Prisma db push, no migrations
description: ADR — we use prisma db push at deploy time instead of prisma migrate.
sidebar:
  order: 1
---

## Context

Prisma offers two ways to keep production schema in sync with
`schema.prisma`:

1. **`prisma migrate`** — generates a SQL migration file per change,
   commits to repo, applies in order on deploy. The "right" answer for
   most production teams.
2. **`prisma db push`** — diffs the schema against the live DB and
   applies the diff directly. No migration files. Documented as
   "for prototyping."

## Decision

We use `prisma db push --accept-data-loss --skip-generate` on the
backend's docker-entrypoint. Schema changes deploy automatically.
There are no migration files in the repo.

## Trade-offs

**Why `db push`**:

- **One source of truth**: `schema.prisma` is the only file that
  describes the schema. No drift between schema and migrations.
- **Zero migration-management overhead**: no `prisma migrate dev`,
  no naming migrations, no resolving merge conflicts in
  migration files, no "this migration was applied locally but not in
  prod" debugging.
- **Speed of iteration**: at our scale (one engineer, < 100 users),
  the cost of "this one column rename was destructive" is much lower
  than the cost of migration file maintenance.
- **Render's deploy model fits**: the Docker entrypoint runs
  `prisma db push` on every deploy. Schema is always current at
  startup time.

**What we give up**:

- **Audit trail in code**: a renamed column doesn't leave a paper
  trail of "renamed from X to Y on date Z." Git history of
  `schema.prisma` is the only record.
- **Safe destructive changes**: `db push --accept-data-loss` will
  silently drop a renamed column's data. Renames must be done as a
  multi-step deploy (add new column, dual-write, backfill, switch
  reads, drop old column).
- **Rollback story**: rolling back a deploy doesn't roll back the
  schema. If we drop a column then need to roll back, the data is
  gone.

**Alternatives rejected**:

- **`prisma migrate`**: the right call for a real production setup
  with multiple engineers and high uptime requirements. Premature
  for our scale today.
- **Hand-written SQL migrations + `psql` invocation in entrypoint**:
  more control than `db push`, way more management overhead than
  Prisma migrate.

## Revisit when

- We have more than one engineer touching the schema regularly (merge
  conflicts in `schema.prisma` start happening).
- We have customers paying enough that a column-drop incident has
  meaningful blast radius.
- We need point-in-time schema rollback as part of a deploy.

When that happens, the migration path is:

1. Run `prisma migrate dev --name baseline` against a clean local DB
   to generate the initial baseline migration covering everything in
   `schema.prisma`.
2. On Render, run `prisma migrate resolve --applied baseline` to mark
   the baseline as already-applied (it is).
3. Replace `prisma db push` with `prisma migrate deploy` in the
   entrypoint.
4. Adopt the `prisma migrate dev` workflow for future schema changes.
