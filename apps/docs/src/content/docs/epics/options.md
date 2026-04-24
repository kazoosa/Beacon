---
title: Options
description: Strike/expiry/Greeks-aware option positions, lifecycle handling, allocation rollup.
sidebar:
  order: 6
---

## What the user sees

- A dedicated **Options page** at `/app/options` with two layouts
  (by-expiry, by-underlying), per-contract row showing side
  (LONG/SHORT, color-coded), strike + type, contracts × per-contract
  premium, market value, P/L. Three stat cards at top: total option
  value, unrealized P/L, cost basis. Header surfaces "N expiring within
  7 days" when applicable.
- The **Holdings page** has a kind filter (All / Stocks / ETFs /
  Options / Cash) with per-kind counts. Option rows render as
  `AMAT (OPT) · AMAT $400 CALL · Apr 24 · 2d left` with the
  days-to-expiry color-coded.
- Clicking an option ticker opens the **StockDetail** page in option
  mode: an OptionContractCard above the equity-style sections shows
  strike, expiry, multiplier, days-to-expiry badge, intrinsic/extrinsic
  split, and Greeks panel (delta/gamma/theta/vega/IV).
- The **Allocation** page has a Roll up / Premium toggle for how
  options affect the pies.

## Why this was a real project

Pre-options-feature, Beacon stored option positions as if they were
stocks: `-AMAT260424C400` became a `Security` row with no strike, no
expiry, no underlying link, and `institutionValue` was computed as
`quantity × price` instead of `quantity × price × 100`. So a short
$9.15 call showed as -$9.15 of exposure instead of -$915.

Plus option-specific events (`OPTIONEXPIRATION`, `OPTIONASSIGNMENT`,
`OPTIONEXERCISE`) were dropped silently — an expired contract lingered
as "still held" forever, an assigned put never converted into the
resulting share purchase.

Four phases shipped over multiple PRs.

## Phase 1: Schema + parser + multiplier math

**What**: Made options first-class objects in the DB with correct
dollar values everywhere.

- New **`OptionContract`** model 1:1 with Security, with two FKs into
  Security via named relations (`OptionSecurity` for the contract,
  `OptionUnderlying` for the underlying stock). Carries strike, expiry,
  multiplier, OCC symbol, plus Phase 3 placeholder columns for Greeks.
- New `Security.type === "option"` value.
- New service `optionSymbolParser.ts` — three strategies tried in
  order, all converging on the canonical OCC symbol:
  - **OCC standard** (8-digit strike with 3 implied decimals):
    `AMAT  260424C00400000`
  - **Fidelity-style** (compact, plain decimal strike):
    `-AMAT260424C400`
  - **SnapTrade structured** ({option_symbol, strike_price, expiration_date, option_type})
- Importer wire-up: option detection runs at the `previewCsv` layer
  after merge, so each broker parser stays focused on column
  extraction. `upsertSecurityWithTx` becomes option-aware: writes
  underlying first, option Security second, OptionContract row tying
  them.
- Multiplier math everywhere: `institutionValue = quantity × price × multiplier`
  on writes; cash-flow estimate uses `multiplier` too.
- Bug fix while in there: short-position drop bug at the activity
  replay's holdings persistence step (`pos.quantity <= 0` was
  silently dropping shorts).

**Tests**: 21 new cases in `option-symbol-parser.test.ts` pinning
every shape, round-trip identity (Fidelity == OCC == SnapTrade for
the same contract), edge cases (sub-dollar strikes, decimal strikes,
LEAPS, BRK.B-style dotted underlyings, the disambiguation rule that
keeps OCC strings from being misread as Fidelity-style).

## Phase 2: Lifecycle (expired / assigned / exercised)

**What**: Stop expired options from lingering forever; convert
assignments into correct underlying-stock mutations + cash-leg
movements.

- **Three new ActivityType values**: `option_expired`,
  `option_assigned`, `option_exercised`. Classifier branches placed
  BEFORE the generic dividend/buy branches so substring collisions
  can't happen.
- **Replay loop extension**: each lifecycle event has distinct cash
  + share legs. Assignments and exercises also mutate the underlying
  position (short put assigned → underlying shares received at strike;
  long call exercised → underlying shares received at strike; etc).
  Metadata (strike, multiplier, underlying) comes from
  `parseOptionSymbol` with a per-ticker cache so the chronological
  loop stays O(N).
- **Auto-sweep**: after every CSV activity import AND after every
  SnapTrade sync, find any non-zero option holding whose contract has
  already expired but for which no EXPIRED activity row arrived.
  Write a synthetic `option_expired` `InvestmentTransaction`
  (idempotent via deterministic externalId) and zero the holding.

The cash leg math:

| Event | Cash flow |
|---|---|
| EXPIRED | 0 (premium already moved at open) |
| Short call ASSIGNED | +strike × \|contracts\| × multiplier |
| Short put ASSIGNED | -strike × \|contracts\| × multiplier |
| Long call EXERCISED | -strike × contracts × multiplier |
| Long put EXERCISED | +strike × contracts × multiplier |

The underlying-mutation math:

| Event | Underlying shares delta | Cost basis |
|---|---|---|
| Short call assigned | deliver shares (-) | reduce at avg cost |
| Short put assigned | receive shares (+) | strike per share |
| Long call exercised | receive shares (+) | strike per share |
| Long put exercised | deliver shares (-) | reduce at avg cost |

## Phase 3: Tradier Greeks + intrinsic/extrinsic

**What**: Pull live mark + Greeks + IV from Tradier sandbox so the
option detail view stops showing static last-trade prices.

- New service `tradierClient.ts` wraps `GET /v1/markets/quotes?symbols=...&greeks=true`.
  Handles every shape Tradier returns (single-quote object, quote
  array, "no quotes" sentinel string, mid_iv vs smv_vol fallback).
  Maps unpadded OCC symbols Tradier uses back to our padded canonical
  form so the caller can match by `occSymbol`.
- New job `refreshOptionQuotes.ts` — pure async function (NOT a new
  BullMQ queue, to avoid Redis cost). Pulls every non-zero option
  holding for the user, batches OCC symbols 50 per call, persists
  Greeks + greeksAsOf to OptionContract + mark to Security.closePrice.
  Mark preference: last trade → bid/ask midpoint → leave unchanged.
- Three call sites: fire-and-forget after every SnapTrade sync,
  fire-and-forget after every CSV option import (Phase 4 wiring),
  external cron (Render Cron) for periodic refresh.
- Read path: `getStockDetail` for an option returns Greeks +
  intrinsic_per_contract (`max(0, S-K)` call / `max(0, K-S)` put) +
  intrinsic_total (× multiplier × |contracts|) + extrinsic_total
  (current marketValue - intrinsic, clamped >=0) + days_to_expiry.

**Configuration**: `TRADIER_TOKEN` env var. Sandbox tokens don't
expire. When unset the client returns null-greek placeholders instead
of crashing — operator can deploy without the token, set it later, and
the next refresh fills in.

**Rate limit**: ~120 req/min. Job aborts remaining batches on a 429
and returns counts so far. Next sync or cron picks up.

## Phase 4: UI

**What**: Expose all of Phase 1–3 in the dashboard.

- **Holdings page**: kind filter (All / Stocks / ETFs / Options / Cash)
  with per-kind counts. Option rows render as `AMAT (OPT)` ticker +
  formatted contract specs in the name cell, days-to-expiry color-coded.
- **OptionsPage** (`/app/options` + `/demo/options`): dedicated view
  with by-expiry / by-underlying toggle. Each contract row shows
  side, strike + type, contracts × premium, market value, P/L.
- **StockDetail option mode**: when `useStockPosition()` returns a
  payload with `option` set, a new `OptionContractCard` renders below
  StockHeader with strike/expiry/days-to-expiry, intrinsic/extrinsic,
  and Greeks panel.
- **Allocation rollup toggle**: Roll up (default) — each option
  contributes delta-equivalent share value to the underlying ticker;
  Premium — options keep their own ticker slice valued at premium ×
  multiplier × contracts. Backend `getPortfolioAllocation` accepts
  `?rollupOptions=true|false`. Without Greeks loaded, the rollup
  delta defaults to 0.5 as a midpoint proxy.

## Failure modes

| Symptom | Cause | Remediation |
|---|---|---|
| Option position dollar value 100x too small | Multiplier not applied at the read or write | Should be applied in `importPositionsCsv` + `getPortfolioOverview` + `getPortfolioHoldings`; verify the multiplier fixture covers the path |
| Option ticker shows as raw `-AMAT260424C400` instead of pretty form | OptionContract row missing for that Security | Check the option import path actually wrote the contract row; check `parseOptionSymbol` returns non-null for the ticker |
| Expired option still showing as held | Auto-sweep didn't run, OR `OptionContract.expiry` is in the future | Run a sync to trigger sweep; verify the contract's expiry is correctly parsed |
| Greeks always null | `TRADIER_TOKEN` unset, OR Tradier rate-limited, OR contract isn't in Tradier's universe | Check env, check Render logs for Tradier 429s, check the OCC symbol is well-formed |
| Allocation rollup gives weird weights | `effectiveDelta` falls back to 0.5 when delta is null — rough proxy | Run a refresh to populate Greeks; the rollup will sharpen |

## Tests

- `apps/backend/test/option-symbol-parser.test.ts` — 21 cases
- `apps/backend/test/option-lifecycle-replay.test.ts` — parser →
  classifier handoff for all four lifecycle flows
- `apps/backend/test/tradier-client.test.ts` — 13 cases (happy path,
  every response shape, every error path, env safety)
- `apps/backend/test/activity-classifier.test.ts` — option lifecycle
  labels pinned

Plus the option-aware fixture rows in `csv-fidelity-positions.test.ts`.

## Open questions

- **Underlying price in the rollup**: today the delta-equivalent rollup
  uses the option's premium-derived multiplier. Threading the
  underlying's current price into the holdings response would let the
  rollup be exact (delta × multiplier × contracts × underlyingPrice
  — what most tools call "notional exposure").
- **Greeks freshness**: The refresh runs after every sync. For
  long-running sessions where the user hasn't synced in hours, Greeks
  can be stale during volatility. Short-term mitigation: also trigger
  on the per-symbol detail page load. Long-term: a Render Cron at
  market open + every 4h during market hours.
- **Margin/short-call cost basis**: When a short call is assigned and
  the user doesn't own the underlying, our replay creates a short
  stock position. We don't currently surface "your short stock
  position has unlimited risk" warnings.
- **Multi-leg strategies**: Each leg is treated as an independent
  position. There's no "iron condor" view that pairs them up. Out of
  scope for now.
