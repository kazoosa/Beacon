---
title: Astro + Starlight for docs
description: ADR — we picked Astro + Starlight over Docusaurus, Nextra, and a custom React app.
sidebar:
  order: 5
---

## Context

We needed a technical documentation site to host onboarding material,
ADRs, runbooks, epics, testing strategy, and the auto-generated
test↔feature traceability matrix. Choices:

- **Astro 5 + Starlight** — Astro is built for content sites,
  Starlight is its docs theme.
- **Docusaurus 3** — Meta's docs framework, React-based.
- **Nextra** — Next.js-based docs framework.
- **Custom Vite + React app** — match the dashboard's exact styling.

## Decision

Astro + Starlight in a new `apps/docs` workspace, deployed to its own
Vercel project.

## Trade-offs

**Why Astro + Starlight**:

- **Zero-ceremony content authoring**: drop a `.md` file in
  `src/content/docs/<section>/`, it shows up in the sidebar
  automatically.
- **Smallest bundle by far**: Astro ships zero JS by default. Starlight
  adds a tiny client runtime for the search + theme toggle. Lighthouse
  scores 100 across the board out of the box.
- **Built-in features we need**: full-text search (pagefind),
  responsive sidebar, dark mode, edit-on-GitHub links, last-updated
  timestamps — all ship with Starlight, no plugins.
- **MDX support** for the few pages that need React components
  (the homepage uses `<CardGrid>` from Starlight).
- **Active maintenance** — Starlight is the recommended docs
  framework on the Astro team's official roadmap.

**What we give up**:

- **No React-component-heavy pages**: if we wanted interactive API
  explorers or live-editable code samples, Docusaurus's React-first
  model would be easier. We don't.
- **Smaller community than Docusaurus**: fewer Stack Overflow
  answers; the gap is closing.

**Alternatives rejected**:

- **Docusaurus 3**: heavier bundle, more JS overhead. Better if we
  wanted React components throughout. Overkill for our pure-content
  needs.
- **Nextra**: solid alternative; we'd be locking into Next.js for a
  pure-static docs site. No reason to incur the Next.js complexity.
- **Custom Vite + React app**: significantly more code to write and
  maintain. We'd be building the framework instead of using one.
  Not worth it for visual consistency with the dashboard — docs +
  product can have different visual languages.

## Implementation notes

- **Sidebar autogeneration**: each top-level section uses
  `autogenerate: { directory: "<section>" }`. New MD files appear
  in the right place automatically. Page order within a section is
  controlled by `sidebar.order` in the page frontmatter.
- **Theming**: `src/styles/custom.css` overrides Starlight's
  accent-color tokens to match the dashboard's deep-ink accent.
- **Search**: Starlight's pagefind integration is on by default —
  zero config.
- **Edit-on-GitHub**: `editLink.baseUrl` in `astro.config.mjs` points
  at the docs directory in the main repo.

## Revisit when

- We need interactive API explorers or runnable code samples
  (Docusaurus + MDX is friendlier for that).
- Astro/Starlight stops being actively maintained (no signs of this
  today).
- We start hosting docs for paying customers and need a
  paid-tier docs platform with analytics, search analytics, etc
  (Mintlify or ReadMe).
