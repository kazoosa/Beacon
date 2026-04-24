---
title: Test fixtures
description: Where the test data lives, what's in it, and how to add new fixtures without leaking real account info.
sidebar:
  order: 3
---

## Where fixtures live

| Location | What's in it | Used by |
|---|---|---|
| `apps/backend/src/prisma/seed.ts` | Demo developer + accounts + holdings + transactions | The demo flow + ops self-test |
| Inline in test files | Per-test minimal CSV strings, broker activity payloads | Unit tests |
| `apps/backend/test/__fixtures__/` (when needed) | Larger sample files that don't fit inline | Currently empty — create when first needed |

We don't have a separate fixtures directory yet because every fixture
to date has been small enough to inline. Keep that bias.

## The seed data

`seed.ts` builds a deterministic demo developer (`demo@finlink.dev`)
with:

- **Items**: Robinhood, Charles Schwab, Vanguard, Fidelity (mocked
  brokers; not actual SnapTrade connections)
- **Accounts**: 12+ across the 4 items
- **Holdings**: 50+ spanning equities, ETFs, mutual funds, options,
  cash sweeps
- **Transactions**: 1 year of realistic activity including buys,
  sells, dividends (some reinvested), interest, transfers
- **OptionContracts**: half a dozen contracts in various
  long/short/expiry configurations

The seed is **idempotent**: re-running doesn't duplicate. Used by:

- The local entrypoint script (`docker-entrypoint.sh` calls
  `seedIfEmpty`)
- The deployed entrypoint (same script — only fills if the demo
  developer doesn't already exist)
- The `seedIfEmpty` script's check is "does the demo developer have
  >0 items," so partial seeds aren't accidentally extended

## Inline test fixtures

Every parser/classifier test file builds the minimum CSV string it
needs to exercise the case under test:

```typescript
// example from csv-fidelity-positions.test.ts
const FIDELITY_FIXTURE =
  "﻿Account Number,Account Name,Symbol,Description,...\n" +
  'X77787572,Individual - TOD,AMAT,APPLIED MATERIALS INC,100,$402.93,...\n' +
  'X77787572,Individual - TOD, -AMAT260424C400,AMAT APR 24 2026 $400 CALL,-1,...\n' +
  // ... etc
```

This pattern is intentional:

- **Self-contained** — each test reads on its own without flipping
  to a fixtures file
- **Minimal** — only the rows needed for the assertions
- **Pinned shape** — every awkward row from a real broker export
  is represented at least once across the test files (BOM,
  leading-space option ticker, money market sweep, footer disclaimer,
  quoted account names with commas, etc)

When a real-world bug shows a CSV shape we don't have a test for, the
fix lands in the same PR as a new fixture row exercising it.

## Adding a fixture from real-world data

If you have a real broker CSV that's exposing a parser bug:

**SCRUB IT FIRST.** Replace:

- Real account numbers with `X12345` or similar fake IDs
- Real ticker positions with adjusted values (round numbers,
  not the user's actual quantities)
- Real dollar amounts with adjusted figures
- Anything that could re-identify the user

Then either:

- Inline the minimum-rows-needed version into a test
- If it needs to be ~1000+ lines and inlining is unwieldy, drop it
  in `apps/backend/test/__fixtures__/<broker>-<scenario>.csv` and
  load it via `fs.readFileSync` in the test

The sanity check: would you be comfortable if the fixture file went
public on GitHub? If not, scrub more.

## Mock data for HTTP-based services

Tradier client tests use `vi.spyOn(globalThis, 'fetch')` to stub
HTTP responses. See `apps/backend/test/tradier-client.test.ts` for
the pattern. Don't use real Tradier credentials in tests — the
client returns null-greek placeholders when no token is set, which
is testable without any HTTP.

For SnapTrade, we don't have a comprehensive SDK mock. The pieces
that interact with SnapTrade (`extractPositionSymbol`,
`extractSnapTradeSymbol`, the activity classifier delegation) are
unit-tested in isolation; the full sync function isn't.

## Demo data refresh policy

The seed data is fixed. We don't currently rotate it (e.g. shifting
all dates so "this year" stays "this year" forever). After a year
the demo's "YTD dividends" tile will look slightly stale. Open
question whether to add a date-shift on seed.

If you need to regenerate seed data with new shapes:

1. Edit `apps/backend/src/prisma/seed.ts`
2. Test locally: `pnpm --filter @finlink/backend run seed`
3. To force a re-seed of an existing local DB, drop the demo
   developer first: `DELETE FROM "Developer" WHERE email = 'demo@finlink.dev'`
   then re-run seed
4. PR + deploy. Render's `seedIfEmpty` will only run on a fresh DB,
   so prod's seed data persists across deploys
