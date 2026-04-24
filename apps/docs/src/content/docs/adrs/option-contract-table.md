---
title: OptionContract as separate table
description: ADR — option metadata lives in its own table, not as nullable columns on Security.
sidebar:
  order: 7
---

## Context

When designing the [options epic](/epics/options/), we needed a
home for option-specific metadata: strike, expiry, type (call/put),
underlying ticker, contract multiplier, plus Greeks/IV from Tradier.

Two choices:

- **Nullable columns on `Security`**: add `strike`, `expiry`,
  `optionType`, `underlyingId`, `multiplier`, `delta`, etc. as
  optional columns on the existing Security table. Smaller migration.
- **New `OptionContract` table 1:1 with `Security`**: every option
  Security has a matching OptionContract row pointing at it.

## Decision

New `OptionContract` table, 1:1 with `Security`. Two FKs into
Security via named relations: `OptionSecurity` (the contract itself)
and `OptionUnderlying` (the stock the option is on).

## Trade-offs

**Why a separate table**:

- **Equity queries stay clean**: `prisma.security.findMany()` for
  the holdings page doesn't have to remember "if it's an option,
  these 8 columns are populated; otherwise they're null." The
  optional include is explicit.
- **Underlying linkage**: a separate FK to the underlying Security is
  cleaner than a nullable `underlyingId` on Security itself.
- **Greeks columns are option-only**: stored on `OptionContract` they
  don't pollute the equity Security row.
- **Cascade story**: `securityId` on OptionContract is unique, with
  `onDelete: Cascade`. Deleting an option Security automatically
  cleans up its contract row. The reverse (deleting an OptionContract
  without dropping the Security) isn't supported — we wouldn't want
  to anyway.
- **Future-proofing**: if we ever model futures, ETF leverage
  factors, or other derivative-type metadata, separate tables let us
  add them without making Security bloated.

**What we give up**:

- **An extra JOIN on every option-touching query**: the read path
  uses `include: { security: { include: { optionContract: { include: { underlying: true } } } } }`.
  Verbose, but consistent.
- **Slightly more code at the upsert site**: the option-aware
  branch in `upsertSecurityWithTx` has to upsert three rows
  (underlying Security, option Security, OptionContract) instead
  of one. Encapsulated cleanly though.

**Alternatives rejected**:

- **Nullable columns on Security**: smaller migration but every
  query that reads Security has to remember the columns may be null
  and act accordingly. Equity-only queries (the majority) carry
  null-checking they don't need.
- **A polymorphic `metadata` JSON column on Security**: would
  duck-type anything (futures, options, structured products). Lose
  type safety. Lose the ability to query "all options expiring this
  week" with a SQL index.

## Implementation

```prisma
model Security {
  // ... existing fields ...
  optionContract    OptionContract? @relation("OptionSecurity")
  derivedOptions    OptionContract[] @relation("OptionUnderlying")
}

model OptionContract {
  id            String   @id @default(cuid())
  securityId    String   @unique
  security      Security @relation("OptionSecurity", fields: [securityId], references: [id], onDelete: Cascade)
  underlyingId  String
  underlying    Security @relation("OptionUnderlying", fields: [underlyingId], references: [id])
  optionType    String   // "call" | "put"
  strike        Float
  expiry        DateTime
  multiplier    Int      @default(100)
  occSymbol     String?  @unique
  delta         Float?
  gamma         Float?
  theta         Float?
  vega          Float?
  iv            Float?
  greeksAsOf    DateTime?
  // ... timestamps ...
  @@index([underlyingId])
  @@index([expiry])
}
```

Two indexes worth highlighting:

- `@@index([underlyingId])` — supports "find all options on AAPL"
  for the upcoming Allocation rollup feature.
- `@@index([expiry])` — supports the auto-sweep for expired
  contracts (`WHERE expiry < now`).

## Revisit when

- We start modeling futures or structured products. The current
  shape extends to those naturally; if a more general "Derivative"
  abstraction emerges, we'd refactor.
- Storage cost on OptionContract becomes a concern (won't, options
  are a few hundred rows per active user).
