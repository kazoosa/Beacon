# Beacon Ops

Private operations dashboard. One URL, every service. Not part of the main Beacon app.

## What you see

- **Backend (Render)** — service status, last deploy, recent events, commit hash
- **Frontend (Vercel)** — last deploys per project, state (READY / ERROR / BUILDING)
- **Database (Neon)** — storage used, compute hours, branches
- **Redis (Upstash)** — commands/day, bandwidth, key count, storage
- **Code (GitHub)** — last 5 commits, open PRs, repo stats
- **Health check** — backend `/health` with latency

Auto-refreshes every 30 seconds. Password-gated.

## Deploy

1. **Create a new Vercel project** pointing to `ops/` as root directory.
2. Add these **Environment Variables** in the Vercel project settings
   (never commit any of these — they're secrets):

| Key | Where to get it |
|---|---|
| `OPS_PASSWORD` | Make up any password — this unlocks the dashboard |
| `RENDER_API_KEY` | render.com → Account Settings → API Keys → Create |
| `RENDER_SERVICE_ID` | In the Render URL of your backend: `dashboard.render.com/web/srv-XXXX` → the `srv-XXXX` part |
| `VERCEL_API_TOKEN` | vercel.com → Settings → Tokens → Create (scope: Full Access, or just the team) |
| `VERCEL_TEAM_ID` | *(optional)* Vercel → your team → Settings → Team ID |
| `NEON_API_KEY` | neon.tech → Account Settings → Developer Settings → API Keys → Create |
| `NEON_PROJECT_ID` | In the Neon URL: `console.neon.tech/app/projects/XXXXX` → the `XXXXX` part |
| `UPSTASH_EMAIL` | Your Upstash account email |
| `UPSTASH_API_KEY` | console.upstash.com → Account → Management API → Create |
| `UPSTASH_DATABASE_ID` | In the Upstash URL: `console.upstash.com/redis/XXXXX` → the `XXXXX` part |
| `GITHUB_TOKEN` | *(optional, for higher rate limits)* github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained, read-only on the Beacon repo |
| `GITHUB_REPO` | *(optional, defaults to `kazoosa/Beacon`)* |
| `BACKEND_HEALTH_URL` | *(optional, defaults to the production backend)* |

3. **Deploy.** Widgets with missing API keys show "unconfigured" instead of erroring out — you can add services one at a time.

## Security

- `OPS_PASSWORD` gates the entire dashboard. Keep it strong + private.
- All API keys are server-side only (in the serverless function). Never sent to the browser.
- Recommendation: use **read-only** API keys everywhere you can (Render, Vercel, Neon all support this).
- Rotate any key immediately if you suspect compromise.

## Local dev

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5176. For the `/api/ops` function to work locally, you need `vercel dev` instead of `vite`:

```bash
npm install -g vercel
vercel link
vercel env pull
vercel dev
```
