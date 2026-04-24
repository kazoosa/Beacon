---
title: Render auto-deploy stuck
description: Code merged to main but production hasn't picked it up.
sidebar:
  order: 2
---

## When to use this

- You merged a PR to main, waited 10+ minutes, and the change isn't
  visible in production
- The Render dashboard shows the latest commit on `main` but the
  "Live" deploy is older
- The production smoke test (#3 in particular — the "login blocks
  demo email" check) confirms an old build is running

## How auto-deploy is supposed to work

1. GitHub fires a webhook to Render on push to main
2. Render queues a deploy
3. Render builds the Docker image (~5 min on cold cache, ~2 min warm)
4. Render runs the entrypoint, swaps the live service to the new
   container

When it works, total time is ~5 min. When the webhook is missed (which
happens), step 1 doesn't fire and Render polls GitHub on a 30-60s
interval. That polling has been observed to skip commits occasionally.

## Triage

```bash
# What commit is prod actually on?
curl -s https://vesly-backend.onrender.com/health | jq .commit
# vs latest commit on main:
git log origin/main -1 --format="%H"
```

If they don't match, prod is stuck.

## Fix

**Manual Deploy from the Render dashboard:**

1. Go to https://dashboard.render.com → `vesly-backend` service
2. Top-right: **Manual Deploy** dropdown → **Deploy latest commit**
3. Watch the build log. ~5 minutes.
4. When the log says `Your service is live 🎉`, re-run the smoke test.

**If the manual deploy itself fails:**

- Check the build log for the actual error. Common ones:
  - `pnpm install` failure → usually a transient npm registry issue,
    re-trigger the deploy.
  - `prisma generate` failure → schema syntax error; revert the
    offending commit.
  - `tsc` build failure → TypeScript error; should have been caught
    locally, revert the offending commit.
  - `prisma db push` failure on entrypoint → usually a destructive
    schema change with `--accept-data-loss` complaining; investigate
    the schema diff.

## Verify

After the deploy goes green:

```bash
# Commit hash matches main
curl -s https://vesly-backend.onrender.com/health | jq .commit

# The change you actually deployed is live
# (specific check depends on the change — pick something distinctive)
```

## If repeated misses become a pattern

Render's auto-deploy reliability has been imperfect for us. Two
mitigations to consider:

1. **GitHub webhook health**: GitHub repo → Settings → Webhooks → find
   the Render webhook → check Recent Deliveries. If many show as
   failed, the webhook URL is stale; remove + re-add via Render's
   "Reconnect repo" flow.
2. **Render → reconnect GitHub**: Render service → Settings → Build &
   Deploy → "Disconnect" GitHub then reconnect. Refreshes the webhook
   subscription.

This has happened to us at least twice. If you're hitting it more
than monthly, the fix is to reconnect the integration.
