---
title: Data model
description: Every Prisma model, what it represents, and how the relations work.
sidebar:
  order: 3
---

The full schema lives in
[`apps/backend/src/prisma/schema.prisma`](https://github.com/kazoosa/Beacon/blob/main/apps/backend/src/prisma/schema.prisma).
This page summarizes the models you'll touch most.

## Entity-relationship diagram

```
Developer ──┬── Application ── Item ── Account ──┬── InvestmentHolding ── Security
            │                                     │                            └── OptionContract ── Security (underlying)
            └── refreshTokens                     └── InvestmentTransaction ── Security
```

## Models

### `Developer`

The user account. Email + bcrypt password hash. The demo user is just
a regular Developer row with a fixed email (`demo@finlink.dev`). Refresh
tokens hang off this in a separate table; see [Epic: Auth](/epics/auth/).

### `Application`

A vestigial layer from the Plaid-clone era. Each Developer owns exactly
one Application; Items hang off it. Could be removed but the migration
isn't worth it.

### `Item`

One brokerage connection. CSV-imported brokerages and SnapTrade-connected
brokerages both produce Items. Distinguished by:

- `snaptradeConnectionId` is set for SnapTrade Items, null for CSV.
- `clientUserId` follows the pattern `csv_<developerId>` for CSV Items.

`onDelete: Cascade` from Item → Account → InvestmentHolding /
InvestmentTransaction. So `prisma.item.delete()` wipes the entire
brokerage's data atomically. (This was load-bearing for the disconnect
flow — see [Epic: SnapTrade sync](/epics/snaptrade-sync/).)

### `Account`

A sub-account under an Item. A user with Fidelity Roth + Fidelity HSA
gets two Account rows under one Fidelity Item. Has `currentBalance` and
`availableBalance` (we don't currently distinguish them; same value).

### `Security`

The thing being held. One row per ticker globally (cross-developer
shared). `tickerSymbol` is unique. `type` is one of:

- `equity` — common stock
- `etf` — ETF
- `mutual_fund` — mutual fund
- `fixed_income` — bond / Treasury / CD
- `cash` — money market sweep, FDIC-insured deposit
- `option` — option contract (links to `OptionContract` for metadata)

`closePrice` is updated by SnapTrade syncs (positions endpoint) and
the Tradier refresh job (option marks). For equities the price is also
re-cached by the dashboard's per-ticker quote endpoint, but only on
the Security if there's an active sync touching it.

### `OptionContract`

1:1 with a Security row of `type === "option"`. Carries strike, expiry,
multiplier, and an OCC symbol used as cross-broker identity. Two FKs
into Security: `securityId` (the contract itself, named relation
`OptionSecurity`) and `underlyingId` (the stock the option is on, named
relation `OptionUnderlying`). Last-known Greeks live here too — filled
by the Tradier refresh job.

See [Epic: Options](/epics/options/) for the full lifecycle.

### `InvestmentHolding`

A current position. Unique on `(accountId, securityId)` — you cannot
have two holdings of the same security in the same account; lots get
merged by the importer. Stores:

- `quantity` — signed; negative means short (covered calls, naked puts)
- `institutionPrice` — per-contract premium for options, per-share for equities
- `institutionValue` — full dollar exposure (premium × multiplier × qty for options)
- `costBasis` — total dollars spent acquiring (also × multiplier for options)

The unique constraint protects us from broker-export quirks (Fidelity's
margin/cash sub-account split for the same ticker would otherwise insert
twice). Importers `upsert` rather than `insert` to be idempotent.

### `InvestmentTransaction`

An activity row. The `type` column is a string, not an enum, but the
classifier emits one of:

```
buy | sell | dividend | dividend_reinvested | interest | fee | transfer
| option_expired | option_assigned | option_exercised
```

The unique constraint on `snaptradeOrderId` (which we abuse for both
SnapTrade IDs and CSV-derived deterministic IDs) makes upserts
idempotent — re-running a sync or re-importing the same CSV does not
duplicate transactions.

### Other models

- `Identity` — name/email/phone/address pulled by SnapTrade for KYC-ish
  purposes. We don't use it in the UI yet but the column is there.
- `Webhook` + `WebhookEvent` — outbound webhooks the BullMQ worker
  delivers. Currently only fired on `transactions.historical_update`
  after a sync.

## Conventions

**No enum columns.** `Security.type`, `InvestmentTransaction.type`, and
`Item.status` are all `String`. We considered Prisma enums but the
deploy-time impact of changing an enum value (requires a migration in
strict-mode setups) doesn't pay for the type safety we'd gain. The
classifier and `classifySecurityType` are the gatekeepers.

**Timestamps on every row.** `createdAt` defaults to now, `updatedAt`
auto-updates. Useful for "when did Beacon first see this?" forensics.

**`onDelete: Cascade` on every parent→child relation.** Item delete →
Account delete → Holding/Transaction delete. Verified by reading the
schema; if you add a new child relation, add the cascade or ops
won't be able to disconnect a brokerage cleanly.

## Schema migration policy

We use `prisma db push --accept-data-loss --skip-generate` on the
backend's docker-entrypoint. There are NO migration files. See
[ADR: Prisma db push, no migrations](/adrs/prisma-db-push/) for the
trade-offs.

Practically:

- Adding a new column with a default → safe, deploys cleanly.
- Adding a new model → safe.
- Renaming a column → DESTRUCTIVE, will silently drop data. Don't.
- Dropping a column → use a multi-step deploy: stop reading it, deploy,
  then remove from schema.
