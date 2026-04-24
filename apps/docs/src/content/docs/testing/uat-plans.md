---
title: UAT plans
description: Manual user-acceptance test scripts. Run before any release that touches user-visible behavior.
sidebar:
  order: 2
---

These are the scripts an engineer runs by hand, in a real browser,
against the staging-or-prod URL. Each plan has explicit steps and
expected outcomes — no "it should mostly work" judgment calls.

## How to use this section

Pick the plan that matches the area your change touched. Run all
steps. If any step's actual outcome differs from the expected, the
release is not ready.

When you ship a new feature, add a UAT plan here for it.

## UAT-1: Sign-in and demo flow

**Touches**: Auth provider, RequireAuth/RequireDemo guards, route
mirroring under `/app` and `/demo`.

**Pre-conditions**: Clean browser (incognito works). Production URL.

| Step | Action | Expected |
|---|---|---|
| 1 | Visit `/` | Redirects to `/landing` |
| 2 | Click "Try the demo" on the landing page | Lands on `/demo` (Overview), populated with demo data |
| 3 | URL bar shows `/demo/...`, sidebar header shows "Demo" indicator | ✓ |
| 4 | Click Holdings, Stocks, Transactions, Dividends, Options, Allocation, Accounts in turn | Each page loads with data; URL bar always shows `/demo/...` not `/app/...` |
| 5 | Open a second tab, navigate to `/login` | Login page renders, NOT redirected to /app or /demo |
| 6 | Sign in with a real account in tab 2 | Lands on `/app/` (Overview), populated with that account's data |
| 7 | Reload tab 1 (the demo tab) | Still shows demo data, URL still `/demo/...` |
| 8 | Reload tab 2 (the real tab) | Still shows real data, URL still `/app/...` |
| 9 | In tab 2, click Sign Out | Redirects to landing |
| 10 | Reload tab 1 | Demo session still alive in this tab; demo data still shows |

If step 7 or 8 swaps account, the [session isolation](/adrs/session-isolation/)
is broken — block the release.

## UAT-2: SnapTrade brokerage connect

**Touches**: SnapTrade connect URL endpoint, the embedded Connection
Portal, post-connect sync, sync result banner.

**Pre-conditions**: Real account (not demo). At least one SnapTrade
test brokerage available (we use Alpaca paper for this).

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in to a real account; go to Accounts page | Page loads; "Connect a Brokerage" CTA visible |
| 2 | Click Connect | SnapTrade Connection Portal iframe opens |
| 3 | Complete OAuth in the Portal | Portal closes |
| 4 | Banner appears below the Connect button | "Sync complete · X accounts, Y holdings, Z transactions pulled" |
| 5 | Note the counts; check `raw_activities` and `skipped_unknown` if shown | If `skipped_unknown > 0`, copy the labels; we may need a classifier extension |
| 6 | Navigate to Holdings page | Newly-imported holdings appear with non-zero values |
| 7 | Navigate to Transactions page | Recent transactions appear; type column shows recognized values (no "OTHER" rows) |
| 8 | Navigate to Dividends page | If the broker has paid dividends in the lookback window, Dividends totals are non-zero |
| 9 | If any imported holdings are options: navigate to Options page | Each contract shows strike, expiry, days-to-expiry |
| 10 | Click Refresh on Accounts page | Banner reappears with same shape; counts may be slightly different (new transactions since last sync) |
| 11 | Click Disconnect on the connection card | Confirmation dialog; click Disconnect | After ~3 seconds the row shows "Disconnected" |
| 12 | Reload | The disconnected brokerage's holdings + transactions are gone everywhere |

## UAT-3: CSV import (positions snapshot)

**Touches**: CSV detect endpoint, parser per broker, importer write
path, "Add another CSV" button.

**Pre-conditions**: A real account, a Fidelity Portfolio_Positions
CSV (any export will do).

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in; go to Accounts page | CSV import card visible |
| 2 | Drop the CSV in the dropzone | Auto-detects as Fidelity, kind = positions; preview shows accounts + holdings counts |
| 3 | Click Import | Banner: "Import complete · Fidelity · X accounts · Y holdings" |
| 4 | Holdings page reflects the new data | New tickers appear; account totals match the CSV's "Total" rows within $1 |
| 5 | If the CSV has options (negative quantity, leading-space ticker like ` -AMAT260424C400`): Holdings page shows them with the formatted "AMAT $400 CALL · ..." display | ✓ |
| 6 | If the CSV has SPAXX or other money market: Holdings page shows a CASH-type row reflecting the sweep balance | ✓ |
| 7 | Click "+ Add another CSV" on the success banner | The dropzone re-opens for a second file |
| 8 | Drop a different broker's CSV (Schwab, IBKR, etc) | Detects correctly, imports cleanly |

## UAT-4: CSV import (activity history)

**Touches**: Activity parser, replay loop, classifier, derived
holdings, auto-sweep for expired options.

**Pre-conditions**: A real account, a Fidelity Accounts_History CSV
that includes at least one of: a dividend, a reinvested dividend, an
expired option, an option assignment.

| Step | Action | Expected |
|---|---|---|
| 1 | Drop the activity CSV | Auto-detects as Fidelity, kind = activity |
| 2 | Click Import | Banner: "X accounts · Y holdings · Z transactions · N dividends" |
| 3 | Transactions page populates | Recent transactions appear |
| 4 | Filter by Type: Dividend | Only dividend rows shown; counts match the CSV's DIVIDEND-action rows |
| 5 | If CSV has reinvested dividends: those are visible in the Dividends filter (NOT just under buys) | ✓ |
| 6 | Dividends page shows YTD/Lifetime totals consistent with the CSV's dividend amounts | ✓ |
| 7 | If CSV has expired options: those tickers are NOT shown in Holdings | The auto-sweep cleared them |
| 8 | If CSV has expired options: a transaction of type "option_expired" is visible in Transactions | ✓ |
| 9 | If CSV has option assignments: the underlying stock position changed accordingly (short put assigned → underlying shares appear; short call assigned → underlying shares decrease) | ✓ |
| 10 | Account balance on Accounts page is non-zero (cash sleeve from the running cash flow) | ✓ |
| 11 | Net Worth on Overview = Holdings page total | ✓ |

## UAT-5: Options end-to-end

**Touches**: Option symbol parser, OptionContract upsert, multiplier
math, lifecycle replay, Tradier Greeks, OptionsPage UI, StockDetail
option mode, Allocation rollup toggle.

**Pre-conditions**: Demo account (which has options seeded) OR a real
account with at least one option position.

| Step | Action | Expected |
|---|---|---|
| 1 | Open the Options page (`/app/options` or `/demo/options`) | Page loads; at least one contract visible |
| 2 | Each contract row shows: SHORT/LONG side label, strike, type (CALL/PUT), contracts, market value, P/L | ✓ |
| 3 | Days-to-expiry color-coded: green > 30, amber 7-30, red < 7 | ✓ |
| 4 | If any contract is < 7 days to expiry: header banner shows "N expiring within 7 days" | ✓ |
| 5 | Click "By underlying" toggle | Layout switches; contracts grouped by underlying ticker |
| 6 | Click "By expiry" toggle back | Returns to chronological view |
| 7 | Click any contract's row | Lands on StockDetail in option mode |
| 8 | Option contract card shows: strike, type, multiplier, expiry, days-to-expiry, intrinsic, extrinsic, IV, delta, gamma, theta, vega | If TRADIER_TOKEN is set: Greeks populate within ~30 seconds. If unset: Greeks show "—" with "Greeks pending" footer |
| 9 | Click the underlying ticker link in the option header | Navigates to the equity StockDetail for that underlying |
| 10 | Go to Holdings page; click "Options" filter | Only option holdings shown |
| 11 | Go to Allocation page; click "Roll up" toggle | Pie shows underlying tickers with option exposure rolled in |
| 12 | Click "Premium" toggle | Pie shows options as their own slice valued at premium × multiplier |

## UAT-6: Empty state copy

**Pre-conditions**: A brand-new real account (no brokerages connected,
no CSVs imported).

| Step | Action | Expected |
|---|---|---|
| 1 | Go to Holdings | Empty state explains how to add data; CTA to connect or import |
| 2 | Go to Transactions | Empty state explicitly distinguishes positions snapshot vs activity history |
| 3 | Go to Dividends | Empty state mentions activity import and brokerage connect, doesn't promise impossible auto-fetch |
| 4 | Go to Options | Empty state honest about coverage variance (Robinhood works, Vanguard mostly doesn't) |
| 5 | Go to Allocation | Empty state matches the others — connect or import |

If any empty state reads as "the feature is broken" instead of "you
have no data yet," update the copy.

## When to add a new UAT

Whenever a feature ships that has a happy-path you'd want a human to
walk through before letting users see it. Don't try to UAT every
edge case — that's what the unit tests are for. UAT is for the
through-line: "from clicking the button to seeing the data, the
right things happen in the right order."
