---
title: Redis on Render Key Value (not Upstash)
description: ADR — we migrated from Upstash to Render Key Value after Upstash's free quota was exhausted by BullMQ polling.
sidebar:
  order: 6
---

## Context

Beacon's backend uses Redis for one thing: BullMQ's `webhook` queue.
The worker delivers outbound webhooks (currently only fired after a
sync), so actual Redis traffic from job processing is minimal.

Originally we ran on **Upstash Redis** (free tier, 500K commands/month).

Within a couple weeks the free quota was exhausted and the backend
started returning 500s on every endpoint that touched Redis (which
includes auth refresh, because the rate-limiter middleware uses Redis
when present).

Root cause: BullMQ's worker polls Redis every few seconds even when
idle, asking "any new jobs?" Each poll costs a command. 24 hours × ~12
polls/min × 30 days = ~518K commands/month from polling alone, before
any actual job processing.

## Decision

Migrated to **Render Key Value** (Render's managed Redis offering).

## Trade-offs

**Why Render Key Value**:

- **No per-command pricing or quota** — pricing is RAM-based. Free
  tier is 25 MB RAM, plenty for our queue (BullMQ jobs are tiny).
- **Same network as the backend** — Render Key Value runs in
  Render's network, so there's near-zero latency vs Upstash's
  serverless cold starts and HTTPS overhead per command.
- **Same Redis API** — drop-in replacement. Migration was: create
  the Key Value service, copy the connection URL, swap `REDIS_URL`
  in the backend env. Zero code change.
- **Operationally simpler** — same Render dashboard for the backend
  and the queue. One set of logs, one set of metrics.

**What we give up**:

- **No HTTP API** — Upstash supports REST-style HTTPS calls; useful
  for serverless environments. Render Key Value is RESP-only. We
  don't use serverless for the backend, so this doesn't matter.
- **No global edge replication** — Upstash can replicate your queue
  across regions. We're single-region (us-east) so irrelevant.
- **Need to add a `WEBHOOK_WORKER_ENABLED=false` kill switch** —
  defensive measure in case we ever need to disable the worker
  during a Redis incident without redeploying. We added this during
  the Upstash quota incident and kept it.

**Alternatives rejected**:

- **Stay on Upstash, upgrade to paid**: $0.20/100K commands. Cheap
  in absolute terms (~$1/mo at our usage) but the quota model
  bothers me — we're paying for polling, not work.
- **Self-host Redis on the backend container**: shares memory with
  the API, OOMs are catastrophic for both, no persistence.
- **Drop BullMQ, deliver webhooks inline**: doable, but loses
  retry-with-backoff for free.

## Revisit when

- BullMQ usage grows enough that 25 MB becomes tight (orders of
  magnitude away).
- We need cross-region replication of queue state (not on roadmap).
- Render Key Value pricing changes.

## Lessons

- **Always test free tier limits with realistic worker patterns**
  before shipping to production. We didn't, and the BullMQ polling
  surprised us.
- **A polling-based queue is a steady stream of work, not bursty.**
  Plan capacity for the floor, not the average.
