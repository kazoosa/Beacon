---
title: Runbooks
description: Incident playbooks. When something breaks in production, the answer is here.
sidebar:
  order: 0
---

A runbook is **specific**: "when symptom X is observed, run command Y,
expect output Z, escalate path A." Not general advice.

Each runbook follows the same structure:

1. **When to use this** — the symptoms that should trigger reaching
   for this page
2. **Triage** — quick checks that narrow down the problem
3. **Fix** — the specific commands or steps
4. **Verify** — how to confirm it's fixed
5. **Escalate** — what to do if the fix didn't work

## Index

- [Production smoke test](/runbooks/prod-smoke-test/) — start here when "is
  prod ok?" is the question
- [Render auto-deploy stuck](/runbooks/render-deploy-stuck/) — code merged,
  prod hasn't updated
- [SnapTrade sync failures](/runbooks/snaptrade-failures/) — sync banner says
  "failed" or returns 0 transactions
- [Tradier rate-limited or down](/runbooks/tradier-down/) — Greeks always
  null
- [CSV import errors](/runbooks/csv-errors/) — duplicate-row error,
  unrecognized broker, missing money market
- [Redis quota exceeded](/runbooks/redis-quota/) — historical, in case
  Render Key Value ever gets quotas

## When to write a new runbook

Every time you triage a prod issue you couldn't have found in 60 seconds
from these docs. Even a one-pager is better than relying on memory.

The template lives at `apps/docs/src/content/docs/runbooks/_template.md`
(create when first needed).
