---
title: Single shared activity classifier
description: ADR — both CSV import and SnapTrade sync delegate to one classifyActivity function so they can't drift.
sidebar:
  order: 8
---

## Context

Both the CSV importer and the SnapTrade sync need to map raw broker
activity labels (`YOU BOUGHT`, `OPTIONEXPIRATION`, `DIVIDEND_REINVESTED`,
`DRIP`, `RETURN OF CAPITAL`, etc) onto Beacon's normalized
`ActivityType` vocabulary.

Originally each importer had its own allow-list:

- The CSV importer had a switch statement covering Fidelity-style
  labels.
- The SnapTrade sync had a separate switch covering SnapTrade enum
  values.

This drifted. A bug fix to one (e.g. handling `DIVIDEND_REINVESTED`
correctly) didn't propagate to the other. We had cases where the same
event was treated as a buy in one path and a dividend in the other —
producing different totals depending on whether the user imported via
CSV or sync.

## Decision

Single `classifyActivity()` function in
`apps/backend/src/services/activityClassifier.ts`. Both importers
delegate.

The classifier upper-cases the input (or accepts pre-uppered) and
runs through an ordered chain of branches, returning one of:

```
buy | sell | dividend | dividend_reinvested
| interest | fee | transfer
| option_expired | option_assigned | option_exercised
```

or `null` for unknown labels (callers log + skip; never throw).

## Trade-offs

**Why single classifier**:

- **No drift**: a new label only needs to be added once. Both
  importers benefit immediately.
- **One test surface**: `test/activity-classifier.test.ts` is the
  single place every recognized label is pinned. 68 cases as of the
  latest expansion.
- **Decision-order is documented in one place**: the order of branches
  matters (option lifecycle before dividend, dividend+reinvest
  before plain dividend, etc). One file makes the order obvious.
- **Easier to reason about**: when triaging "why did this row get
  classified as X?", there's exactly one function to read.

**What we give up**:

- **No broker-specific quirks at the classifier layer**: every
  branch is broker-agnostic. If two brokers ever use the same label
  to mean different things, we'd need to handle it differently
  (introducing a `(label, broker) => type` shape or splitting the
  classifier). Hasn't happened yet.
- **Classifier is a long if-chain**: not as elegant as a Map
  or a regex table. The if-chain is intentional — it makes the
  decision order visible. We considered a Map and rejected it on
  readability grounds.

**Alternatives rejected**:

- **Per-broker classifier**: drift problem returns. Bad.
- **Regex table** (`{ regex: /OPT.*EXPIR/, type: "option_expired" }`):
  more elegant but harder to debug ("why did my label match this
  pattern?") and the order-matters semantics are less obvious in
  array form.
- **A table of `(rawLabel, type)` pairs**: explicit but doesn't
  handle substring matching, and broker labels have too many
  variants to enumerate exhaustively.

## Implementation notes

**Decision order** matters and is documented inline:

1. Option lifecycle first (substring "ASSIGNMENT" would otherwise
   match later branches)
2. DIVIDEND + REINVEST together → `dividend_reinvested`
3. Plain REINVEST (no dividend keyword) → `buy`
4. Capital gain → `dividend`
5. Dividend umbrella (qualified, non-qualified, DIS, DISTRIBUTION,
   ROC, RETURN OF CAPITAL)
6. BUY / SELL / INTEREST / FEE / TRANSFER

**Adding a new label** (the one process new contributors hit):

1. Capture the raw label from Render logs (`unrecognised activity type`
   warnings).
2. Decide which existing `ActivityType` it maps to, or propose a new
   type (rare).
3. Add the branch to `activityClassifier.ts` in the right place
   relative to the order rules.
4. Add a test case to `activity-classifier.test.ts`.
5. PR. After merge + deploy, re-running the user's sync picks up
   the previously-skipped rows.

## Revisit when

- We hit a real broker-disambiguation case where the same label
  means different things at different brokers. Then we'd refactor
  to `classifyActivity(label, broker)`.
- The classifier grows past ~200 LOC (it's at ~120 today). At that
  point a regex table or a state machine becomes worth the
  complexity cost.
