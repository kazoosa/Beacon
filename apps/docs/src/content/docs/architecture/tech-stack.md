---
title: Tech stack
description: Every framework, library, and runtime in production — and why we picked it.
sidebar:
  order: 2
---

## Runtime

| Layer | Choice | Notes |
|---|---|---|
| Node | 20.x | Pinned in `package.json` engines. Render runs Alpine. |
| Package manager | pnpm 9–10 | Workspace-friendly, faster than npm, better-disk than yarn. Open question whether to move to bun, see [ADR: Bun migration](/adrs/bun-migration/) (placeholder, not decided). |
| TypeScript | 5.5 | Strict mode on across all workspaces. |

## Backend

| Layer | Choice | Why |
|---|---|---|
| HTTP framework | Express 4 | Boring on purpose. Every backend Node engineer knows it. We don't need Fastify's perf headroom or Nest's ceremony. |
| ORM | Prisma 5.17 | Schema-first, generates a typed client, has the best MIG-on-deploy story for our `prisma db push` setup. We do NOT use Prisma Migrate — see ADR. |
| Database | Postgres 16 (Neon) | Default to relational because everything we model is relational (developer→items→accounts→holdings/transactions). Neon's serverless model + free tier matches our scale. |
| Worker / queue | BullMQ on Redis | Single queue (`webhook`) processes outbound webhook deliveries. Fire-and-forget jobs (option-quotes refresh) bypass it to avoid Redis cost. |
| Validation | Zod | At every boundary that accepts user input. |
| Logging | pino + pino-http | JSON logs to stdout; Render captures them. |
| Auth | hand-rolled JWT (jsonwebtoken) | 15-min access + 30-day refresh, stored client-side. See [Epic: Auth](/epics/auth/). |
| Testing | vitest 2 | Fast, ESM-native, vitest-fork pool for our DB-touching tests. |

## Frontend (dashboard)

| Layer | Choice | Why |
|---|---|---|
| Bundler | Vite 5 | Fast dev server, proven prod build, works with React 18 idioms out of box. |
| UI framework | React 18 | TanStack Query is the gold standard for data fetching and it's React-only. |
| Routing | React Router 6 | Hooks-first, matches our preference for component-local concerns. |
| Data fetching | TanStack Query 5 | Cache + dedupe + retry + auto-refetch story is unbeatable. |
| Styling | Tailwind 3 + CSS variables | Tailwind for components, `:root { --fg-primary: ... }` for design tokens (so dashboard + ops can share a palette). |
| Component primitives | Radix + custom shadcn-style | shadcn pattern, copied into the repo (not pulled as a dep). Sidebar uses our hand-built version on top of Radix Slot. |
| Charts | Recharts | Most React-friendly chart lib for our needs (sparklines, donuts, line charts). Not as fast as victory-native or visx but easier to style. |
| Animation | framer-motion | Used sparingly — sidebar collapse, route transitions. |
| Icons | lucide-react | Consistent stroke-icon set; matches the design language of the app. |
| Date utils | None | Native `Intl.DateTimeFormat` is enough; no date-fns or dayjs. |

## Frontend (docs)

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro 5 | Built for content; .md/.mdx becomes pages with zero ceremony. |
| Theme | Starlight 0.30 | Astro's official docs theme: sidebar, search, dark mode, mobile, lighthouse 100s, all out of the box. |

We considered Docusaurus and Nextra; Astro+Starlight wins for a pure
docs site at our scale. See [ADR: Astro for docs](/adrs/astro-docs/).

## External APIs

| Service | What | Cost |
|---|---|---|
| SnapTrade | Brokerage aggregation | Free <25 connections |
| Tradier sandbox | Option Greeks + chains | Free, rate-limited |
| Yahoo Finance (via Vercel edge) | Stock quotes (primary) | Free, scraped |
| Stooq (via Vercel edge) | Stock quotes (fallback) | Free |
| Finnhub (via Vercel edge) | Stock quotes (last-resort) | Free tier |

## Infrastructure

| Service | What | Cost |
|---|---|---|
| Vercel | All frontends | Hobby (free) |
| Render | Backend + Redis | Standard ($7/mo) + Free Key Value |
| Neon | Postgres | Free |
| GitHub | Source + issues | Free |

Total monthly: ~$7 fixed + per-broker-connection fees on SnapTrade if
we ever cross 25 connections.

## What we deliberately don't use

- **A schema validator like trpc/zod-to-openapi** — we hand-keep the
  dashboard's TypeScript interfaces aligned with the backend's response
  shapes. Considered, rejected for now (complexity > benefit at this
  scale).
- **GraphQL** — REST + TanStack Query covers our caching needs
  without GraphQL's schema-stitching headache.
- **A CSS-in-JS lib** — Tailwind handles 95%, the rest is plain CSS in
  `styles.css`. No emotion / styled-components.
- **Redux / Zustand / Jotai** — TanStack Query handles server state;
  React's `useState` + the auth context handle the rest. Adding a
  global store would be premature.
- **A test runner besides vitest** — no Jest, no Playwright (yet —
  see [Testing → Strategy](/testing/strategy/) for the e2e plan).
- **Storybook** — components are simple enough that we look at them in
  the dashboard. Reconsider if the component count grows past ~50.
- **An IDP / SSO** — JWT for end users, individual GitHub invites for
  internal access. Reconsider when the team passes 5 people.
