---
title: ADRs
description: Architecture Decision Records — meaningful technical choices and the trade-offs we accepted.
sidebar:
  order: 0
---

An Architecture Decision Record (ADR) is a one-page document that
captures a meaningful technical decision: what we picked, what we
rejected, why, and what we'd revisit if circumstances change.

We don't write an ADR for every choice — only for the ones that
**future-you would otherwise relitigate** by reading code and guessing.

## Format

Each ADR has four sections:

- **Context** — the problem at the time of the decision
- **Decision** — what we picked
- **Trade-offs** — what we gave up, and the alternatives we
  rejected (with brief reasoning)
- **Revisit when** — the condition that would prompt us to reopen
  the decision

If a decision later gets reversed, the original ADR stays put and
gains a "Superseded by ..." note at the top. We don't delete history.

## Index

- [Prisma db push, no migrations](/adrs/prisma-db-push/)
- [Demo sessions in sessionStorage, real in localStorage](/adrs/session-isolation/)
- [SnapTrade over Plaid](/adrs/snaptrade-vs-plaid/)
- [Tradier sandbox for option Greeks](/adrs/tradier-sandbox/)
- [Astro + Starlight for docs](/adrs/astro-docs/)
- [Redis on Render Key Value (not Upstash)](/adrs/redis-render/)
- [OptionContract as separate table](/adrs/option-contract-table/)
- [Single shared activity classifier](/adrs/shared-classifier/)
- [Single environment (no staging)](/adrs/single-env/)
