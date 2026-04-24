---
title: Tradier sandbox for option Greeks
description: ADR — we use Tradier's free sandbox tier for option Greeks, with a path to upgrade to production later.
sidebar:
  order: 4
---

## Context

The options feature ([Epic: Options](/epics/options/)) needs live
mark prices + Greeks (delta/gamma/theta/vega) + IV per option
contract. Choices:

- **Tradier sandbox** — free for personal/non-commercial use,
  rate-limited at ~120 req/min.
- **Polygon.io options** — $29/mo for the entry tier, no rate-limit
  anxiety, better historical coverage.
- **Skip Greeks**: compute intrinsic + extrinsic + days-to-expiry from
  strike + expiry alone (no provider needed). Show "Greeks: requires
  data feed" placeholder.
- **Alpha Vantage** — free tier exists but options coverage is weak.

## Decision

Tradier sandbox. The user's stated preference ("only free options")
made paid tiers a non-starter for v1; sandbox is rich enough.

## Trade-offs

**Why Tradier sandbox**:

- **Free** — sandbox doesn't expire, doesn't need a credit card.
- **Full Greeks**: delta, gamma, theta, vega, rho, IV in a single
  call.
- **Batched**: up to ~50 symbols per call, so refreshing 200
  contracts is 4 calls.
- **Rate limit is plenty for our use**: ~120 req/min × 50 symbols
  per call = 6,000 contracts/min. We'll never approach that.
- **Single-call quote + Greeks**: don't need to chain two endpoints.

**What we give up**:

- **Sandbox vs production** — sandbox is a separate dataset that
  may have minor delays vs production. Acceptable for portfolio
  tracking; not for trading.
- **No historical Greeks** — Tradier's quotes endpoint is point-in-
  time. We don't compute "your delta last week" because we don't
  store snapshots; only the latest.
- **No IV surface or chains** — the chains endpoint exists but we
  don't currently use it (we look up specific contracts by their
  OCC symbol, not by underlying). Future feature.
- **Rate limit isn't dynamic** — if we ever do approach 120/min
  during volatility, we'd need to slow down or upgrade.

**Alternatives rejected**:

- **Polygon options ($29/mo)**: best-in-class but the user
  explicitly wanted free.
- **Skip Greeks**: a degraded experience, acceptable as a fallback
  but not the right default. We do skip gracefully when
  `TRADIER_TOKEN` is unset.
- **Alpha Vantage**: weak options coverage, frequent gaps.

## Implementation notes

- **Sandbox URL**: `https://sandbox.tradier.com/v1` (default).
  Override via `TRADIER_BASE_URL` to swap to production
  (`https://api.tradier.com/v1`) when ready.
- **Symbol format**: Tradier uses unpadded OCC strings
  (`AAPL250117C00200000`). Beacon's canonical form is padded
  (`AAPL  250117C00200000`); the client strips padding before sending
  and remaps the response.
- **Refresh trigger**: post-sync fire-and-forget. NOT a separate
  BullMQ queue (avoids Redis cost).
- **No-token behavior**: returns null-greek placeholders, doesn't
  crash. So an operator can deploy without `TRADIER_TOKEN` and
  Beacon still works for everything else.

## Revisit when

- We add a chain explorer or IV-surface UI (Tradier sandbox has
  these endpoints; we just don't call them yet — same cost).
- Rate-limit becomes painful (we hit 429s repeatedly).
- We add paying users at scale and Tradier's TOS for non-commercial
  use becomes a problem.
