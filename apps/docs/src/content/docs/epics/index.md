---
title: Epics & Stories
description: The major user-visible features Beacon ships, why they exist, and the PR-sized stories that built them.
sidebar:
  order: 0
---

Each epic page covers one user-visible feature large enough to span
multiple PRs. The page narrates the feature end-to-end (what the user
sees, what the system does, why we made the architectural choices we
did) and links to the stories — each story is a real merged PR.

## The epics

| Epic | What it solves |
|---|---|
| [Auth & sessions](/epics/auth/) | Sign in, sign out, demo mode, refresh-token flow. |
| [SnapTrade sync](/epics/snaptrade-sync/) | Read-only OAuth into 20+ brokerages, holdings + activity sync, post-sync option-quote refresh. |
| [CSV import](/epics/csv-import/) | Hand-uploaded broker exports for both positions and activity, across 7 broker formats. |
| [Dividend reporting](/epics/dividends/) | Cash + reinvested dividend tracking, monthly chart, top payers, YTD income. |
| [Cash sleeve](/epics/cash-sleeve/) | Account currentBalance vs sum-of-holdings; synthetic CASH row in Holdings + Net Worth. |
| [Options](/epics/options/) | Strike/expiry/Greeks-aware option positions, lifecycle handling, allocation rollup. |

## How to use this section

If you're new: read [Auth](/epics/auth/) first (it's the simplest end-to-end
story and it's the entry-point flow), then [SnapTrade sync](/epics/snaptrade-sync/)
and [CSV import](/epics/csv-import/) (those two are the data-pipeline
foundations). Then pick whichever feature area you'll work on.

If you're triaging a bug: find the matching epic, read the "Failure modes"
section, then jump to the matching [Runbook](/runbooks/).
