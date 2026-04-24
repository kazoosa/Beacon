---
title: Redis quota exceeded (historical)
description: We're not on Upstash anymore but the runbook is here in case Render Key Value ever introduces a quota.
sidebar:
  order: 6
---

## When to use this

- Render logs show `ReplyError: ERR max requests limit exceeded`
- Auth-refresh or sync endpoints return 500
- Symptoms started suddenly without a deploy or traffic spike

This shouldn't happen on **Render Key Value** — we migrated off
Upstash specifically because their per-command quota was the issue.
If it happens again, it'd be a new Render Key Value pricing change
(unlikely) or a different per-instance limit kicking in.

## Triage

```bash
# Confirm Redis is the issue and not something else returning a similar error
# Render logs for the backend should clearly show the Redis client error.

# Check the current Redis usage:
# Render dashboard → Key Value service → Metrics tab.
# Look at memory + connection count.
```

## Fix

### Short-term: stop the worker bleeding

Set `WEBHOOK_WORKER_ENABLED=false` in Render's environment for the
backend service. This stops BullMQ from polling Redis without
needing a code deploy. The worker code respects this kill switch.

After setting:

1. Restart the service (env-var change usually triggers; force via
   manual deploy if not).
2. Confirm Render logs no longer show the Redis errors.
3. Auth, sync, and other Redis-touching endpoints should recover.

### Longer-term: change the underlying issue

If Render Key Value introduced a real quota:

1. Check the [Render pricing page](https://render.com/pricing) for
   Key Value tiers.
2. Upgrade to a paid tier if our usage genuinely exceeds free
   capacity.
3. If the cost feels excessive, evaluate alternatives: see
   [ADR: Redis on Render Key Value](/adrs/redis-render/) for the
   options we considered.

## Verify

After re-enabling the worker:

```bash
# Worker logs should resume
# Render logs for `WEBHOOK_WORKER_ENABLED=false` warning should go away
# (because the env is now true again)

# A test webhook delivery should work
# (currently we don't have a great way to trigger one outside a sync;
# triggering a sync that produces a webhook event is the workaround)
```

## Why this still has a runbook

Even though we're off Upstash, the failure shape ("Redis is
non-functional → backend can't refresh tokens or process queue jobs")
is generic. If we ever hit it again from a different cause, the
triage and the kill-switch fix are the same.
