---
title: SnapTrade over Plaid
description: ADR — we picked SnapTrade for brokerage aggregation despite Plaid being more well-known.
sidebar:
  order: 3
---

## Context

Beacon needed a brokerage aggregation API. Two real choices in the
US market:

- **Plaid Investments** — well-known, large customer base, the
  default for fintech.
- **SnapTrade** — smaller, focused specifically on brokerage data
  (Plaid's investments product is one of many).

We need: read-only access to positions + transactions across
~20 brokerages including international (Wealthsimple, Questrade,
DEGIRO, Trading212), plus crypto (Coinbase, Kraken, Binance).

## Decision

We use SnapTrade.

## Trade-offs

**Why SnapTrade**:

- **Pricing fits our scale**: free for the first 25 simultaneous
  connections, then ~$0.50/connection/month. For an indie product
  that's ~$5/mo at 35 users, scaling linearly. Plaid's investments
  product has a $500/mo minimum.
- **Broader broker coverage**: Plaid covers the US big four well;
  SnapTrade covers the same plus 15+ smaller brokers + Wealthsimple
  + Questrade + DEGIRO + Trading212 + crypto exchanges.
- **Crypto in-band**: SnapTrade returns Coinbase/Kraken/Binance
  positions through the same API surface as Robinhood. Plaid would
  need a separate crypto integration.
- **Per-account `userSecret` model**: maps cleanly to our
  Developer.snaptradeUserSecret column; no custodial token rotation
  to manage.

**What we give up**:

- **Brand recognition**: "we use Plaid" is more reassuring to users
  than "we use SnapTrade." Some power users specifically ask. We
  surface SnapTrade in our security docs so it's not hidden.
- **Coverage gaps for non-brokerage**: SnapTrade doesn't do checking
  / savings accounts. If we ever add total-net-worth (including
  banking), we'd need Plaid Auth + Balance for those.
- **Smaller community**: fewer Stack Overflow answers, fewer reference
  implementations. Their Discord is responsive.
- **Some brokers expose holdings but not activities** (Robinhood
  occasionally; Vanguard mostly). The CSV import path is the
  workaround for those gaps.

**Alternatives rejected**:

- **Plaid Investments**: $500/mo minimum is prohibitive at our scale.
  Best-in-class for US-only fintech with paid users.
- **Hand-rolled scrapers per broker**: tried briefly; broker-side
  changes break scrapers without warning, and it's a TOS gray area.
- **Yodlee**: legacy, expensive, primarily B2B.

## Revisit when

- We need bank-account aggregation alongside brokerage. Plaid Auth +
  Balance starts to make sense in that bundle.
- We pass ~50 simultaneous connections (where SnapTrade's per-
  connection fee starts to add up vs Plaid's flat fee).
- A user-trust issue requires us to surface a brand-name aggregator.
- SnapTrade has a service incident that costs us multiple days. The
  switching cost is significant; we wouldn't move on a single bad
  day.
