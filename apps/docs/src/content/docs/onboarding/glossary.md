---
title: Glossary
description: Beacon-specific and finance-specific terms used across the codebase and docs.
sidebar:
  order: 5
---

## Beacon-specific

**Application** — A Beacon-internal abstraction borrowed from Plaid. Each
Developer owns one Application; Items hang off it. Mostly a vestigial
layer at this point but kept because removing it would mean migrating
production rows.

**Item** — One brokerage connection. A user with Fidelity + Schwab has
two Items. Each Item has many Accounts (e.g. Fidelity Roth IRA + Fidelity
HSA = two Accounts under one Item).

**Developer** — The user account. Confusingly named because the
codebase started as a Plaid clone for developers; now Developers are
end-users.

**Demo developer** — The shared `demo@finlink.dev` account. Anyone can
mint a session for it via `POST /api/demo/session` (no password). Used
for the public demo and for the ops self-test. Real sessions and demo
sessions live in separate browser storage to avoid cross-contamination
(see [ADR: sessionStorage isolation](/adrs/session-isolation/)).

**Cash sleeve** — The residual cash balance Beacon synthesizes from
`Account.currentBalance - sum(holdings)` so accounts with money-market
sweeps or activity-CSV-derived cash flows don't render as $0 net worth.
See [Epic: Cash sleeve](/epics/cash-sleeve/).

## Finance terms used in the data model

**Holding** — A current position. One row per (account, security). Stored
as `InvestmentHolding`.

**Position** — Same as holding, but used in conversation about options
("short put position") more than equities. The schema only has Holdings.

**Cost basis** — Total dollars spent acquiring a position. Used to
compute unrealized P/L. Average-cost method everywhere; we don't model
specific-lot accounting.

**Activity** — Anything that happened on the account: BUY, SELL,
DIVIDEND, INTEREST, FEE, TRANSFER, plus option lifecycle (EXPIRED,
ASSIGNED, EXERCISED). Stored as `InvestmentTransaction`. The
[activity classifier](/architecture/activity-classifier/) maps broker-
specific labels onto our normalized type vocabulary.

**Reinvested dividend** — A dividend the broker immediately spent on
more shares (DRIP). We model these as their own type
(`dividend_reinvested`) so the share-count replay adds shares correctly
AND the dividend reports still count them as income.

## Options-specific

**Strike** — The price at which the contract can be exercised.

**Expiry** — The date after which the contract is worthless (or
exercises automatically if ITM at a US broker). Stored as a UTC midnight
Date in `OptionContract.expiry`.

**Multiplier** — Shares-per-contract. 100 for standard equity options;
10 for mini options. Stored in `OptionContract.multiplier`. Every
dollar value computation that touches an option position MUST multiply
by this. Forgetting it produces 100x-too-small values everywhere.

**OCC symbol** — The Options Clearing Corporation's canonical 21-char
contract identifier: `AAPL  240419C00200000` for "AAPL Apr 19 2024 $200
call". Beacon uses this as the cross-broker identity key on
`OptionContract.occSymbol`.

**Greeks** — Sensitivity measures.
- *Delta*: per-$1 move in the underlying, how much the option price
  moves. Range [-1, 1]. ~0.5 for ATM options.
- *Gamma*: rate of change of delta per $1 underlying move.
- *Theta*: per-day decay (typically negative for long positions).
- *Vega*: sensitivity to a 1% IV change.

**IV (Implied Volatility)** — The market's expectation of future
underlying volatility, expressed as an annualized standard deviation in
decimal form (0.30 = 30% IV).

**Intrinsic value** — `max(0, S - K)` for a call, `max(0, K - S)` for a
put, where S is the underlying price and K is the strike. Always ≥ 0.

**Extrinsic value** — Total premium minus intrinsic. Time value +
volatility premium. Approaches 0 as expiry nears.

**ITM / ATM / OTM** — In / At / Out of the money. ATM is usually
defined as within ~5% of strike.

**DRIP** — Dividend Reinvestment Plan. The broker automatically uses
dividend cash to buy more shares.

**Assignment** — The counterparty exercises a short option against you.
For a short call: you deliver shares at the strike. Short put: you
receive shares at the strike.

**Exercise** — You exercise a long option. Long call: receive shares at
strike. Long put: deliver shares at strike.

## Project / process terms

**ADR** — Architecture Decision Record. One short doc per meaningful
technical choice we made. See [ADRs](/adrs/).

**Epic** — A user-visible feature large enough to span multiple PRs.
See [Epics](/epics/).

**Story** — A single PR-sized slice of an epic. Stories live within
epic pages on this site, not as separate files.

**Runbook** — An incident playbook. "When X breaks, do Y." See
[Runbooks](/runbooks/).

**UAT** — User Acceptance Test. Manual scenarios a human runs end-to-end
to validate a release. See [Testing → UAT plans](/testing/uat-plans/).

**Smoke test** — The 11-test battery in `ops/api/ops.ts:getSelfTest`
that the ops surface runs against the deployed backend on demand. Does
not replace UATs — it's a heartbeat, not coverage.
