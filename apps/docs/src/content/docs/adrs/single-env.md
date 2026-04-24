---
title: Single environment (no staging)
description: ADR — main is prod. No separate staging deploys. The trade-offs and the migration path.
sidebar:
  order: 9
---

## Context

Beacon has one environment: production. Every push to main on GitHub
deploys to vesly-dashboard.vercel.app + vesly-backend.onrender.com.
There is no staging environment.

## Decision

Stay single-environment for now. Add staging when the operational pain
hits the threshold described in "Revisit when."

## Trade-offs

**Why single environment**:

- **Speed of iteration**: PR → merge → live in ~5 minutes. No
  promotion step, no environment-specific bugs.
- **Lower infrastructure cost**: one Render service ($7/mo), one Neon
  Postgres (free tier, single project).
- **No env-config drift**: all env vars live in one place per
  service. No "this works in staging but breaks in prod" debugging.
- **Aligned with user count**: at < 100 users a 5-min revert is a
  rounding error.

**What we give up**:

- **No safety net for risky changes**: schema changes, auth changes,
  external-API integrations all go straight to prod. Mitigated by
  unit tests + the ops self-test, but real users see real bugs
  occasionally.
- **No way to test prod-like load before deploy**: the local stack
  uses a tiny seed database; some bugs only show up under real
  data shapes (e.g. the SnapTrade per-account-filter bug only
  appeared with real Robinhood activity rows).
- **Risky deploys at off-hours are riskier**: no chance to verify
  in staging first means a bad deploy at 11pm sits broken until
  someone notices.

**Alternatives rejected at this stage**:

- **Full staging environment**: separate Render service, separate
  Vercel project, separate Neon database. ~$20/mo extra and the
  workflow tax of remembering to deploy through staging.
- **Preview deploys for PRs**: Vercel does this automatically for
  the dashboard. Useful for UI review. The backend doesn't have
  preview deploys (Render charges for preview branches).
- **Feature flags everywhere**: degrades to "every feature is
  half-shipped behind a flag" which is its own complexity tax.

## Mitigations we DO have

- **Unit-test gate**: backend tests must pass before merge (manual
  for now; would be CI in a more mature setup).
- **TypeScript strict everywhere**: catches a class of bugs at
  build time that a staging environment would also catch.
- **Ops self-test page**: 11-test battery that hits the deployed
  backend on demand. Can be run before AND after a deploy to
  confirm nothing broke.
- **Vercel Preview deploys for the dashboard**: every PR gets a
  unique URL, viewable by anyone with the link. Good for UI changes.
- **Render keeps the previous deploy "deactivated"**: rollback is a
  click + 3 minutes for the backend; ~10 seconds for Vercel.

## Revisit when

The decision flips when **any of these** is true:

1. **More than one engineer ships regularly.** Two engineers merging
   to main simultaneously without staging is asking for "your
   change broke my change in prod" days.
2. **Customers paying enough that an incident has financial impact.**
   A free-tier user noticing a bug for 30 minutes is fine; a paying
   user is not.
3. **Schema changes start breaking prod regularly.** Three incidents
   in a quarter is the rough threshold.
4. **A regulatory or compliance requirement** (audit logs, separation
   of duties, etc) forces the issue.

## Migration path

When we cross the threshold, the steps:

1. **Branch model**: introduce a `staging` branch alongside `main`.
   PRs merge into `staging`. A separate "promote" PR merges
   `staging` → `main`.
2. **Render**: spin up `vesly-backend-staging` deploying from the
   `staging` branch. Wire its `DATABASE_URL` to a Neon "staging"
   branch (Neon supports zero-cost branching of the prod data).
3. **Vercel**: a `vesly-dashboard-staging` project deploying from
   `staging`. Or use Vercel preview branches if we're OK with the
   automatic per-PR URL behavior.
4. **Cron jobs**: any scheduled jobs (the option-quotes cron, when
   we add it) need to be present in staging too.
5. **Documentation**: update [Onboarding → Local setup](/onboarding/local-setup/)
   and this ADR with the new flow.

Total effort: ~1 day setup + ongoing workflow tax.
