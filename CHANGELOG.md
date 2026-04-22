# Changelog

All notable changes to Beacon are noted here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

The **[Unreleased]** section is the rolling work-in-progress on `main`.
When we cut a tagged release, those items move into a new dated
section and the entry is published to
[GitHub Releases](https://github.com/kazoosa/Beacon/releases) as the
single source of truth for "what's new".

---

## [Unreleased]

### Added
- `/demo` route that auto-signs visitors in as the seeded demo account,
  so the landing's "Try the demo" button works without ever exposing
  credentials in the UI.
- Open Graph and Twitter card meta tags with a 1200×630 SVG preview
  image. Shared links now render a real card instead of a blank page.
- `robots.txt` and `sitemap.xml` for the marketing pages.
- Mobile hamburger menu on the landing nav.

### Changed
- Removed the "Try the demo account" button from the sign-in page.
  Demo credentials are no longer displayed anywhere in the UI — the
  landing's demo button is the only entry point.
- `CHANGELOG.md` (this file) is the canonical "what's new" surface.
  The README points here; the landing footer links to it.

---

## [0.1.0] — 2026-04-22

First public preview. The site at `https://vesly-dashboard.vercel.app`
renders the marketing landing, the shader-backed sign-in flow, and the
authenticated dashboard.

### Added — marketing landing
- Refined hero with soft corner gradient wash (top-right violet/pink
  only, not an all-over rainbow mesh).
- 3D floating card stack: holdings table, dividend forecast bar chart,
  allocation donut — each tilted in CSS perspective with independent
  drift animations. Honours `prefers-reduced-motion`.
- Broker logo marquee: 17 broker wordmarks with colored initial dots,
  infinite horizontal scroll with an edge fade-mask. Pauses on hover.
- Manifesto, features grid, differentiators, and security sections
  with scroll-reveal animations and a single restrained violet accent
  (`#635bff`).
- Pricing section: Free (default), Pro (featured with gradient border),
  Elite (translucent "coming soon" overlay with an X).
- FAQ with smooth grid-row expand/collapse.
- Final CTA card with dark navy radial gradient wash.
- Footer with status page link, Terms, Privacy, and changelog pointer.

### Added — product
- Three.js dot-matrix shader sign-in and sign-up flow, wired to the
  real `AuthProvider` (email + password). Inline error surfacing,
  reverse-reveal shader animation plays only after a successful login.
- Legal pages: `/terms` and `/privacy` with plain-English prose, shared
  layout, back-to-site nav.
- Radial orbital timeline for the "Beacon flow" section with reliable
  auto-rotate, hover-pause, idle-resume, and a hard-cap safety timer —
  no more spinning freezes.
- Responsive orbit radius via `ResizeObserver` so nodes stay in-frame
  on phones.

### Changed
- Promoted the preview routes (`/preview-landing`, `/preview-signin`)
  to live routes (`/`, `/login`, `/register`). Old URLs redirect.
- `/landing` now always shows the marketing page, even when logged in,
  so it can be previewed without signing out.
- Copy humanised across the landing, FAQ, and legal pages — removed
  rule-of-three bursts, em-dash sales-punch, promotional adjectives,
  and copula avoidance.

### Removed
- Old `LandingPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, and the
  legacy `styles/landing.css` file, now that the new marketing and
  sign-in pages are the real routes.
- Fake email → 6-digit-code sign-in flow, which never talked to the
  backend and dead-ended anyone trying to log in.

### Fixed
- Top-of-page CTAs (nav + hero) now route through `/login` and
  `/register` correctly. Previously some pointed at `/preview-signin`.
- Sign-in page: demo account can actually log in now.

---

[Unreleased]: https://github.com/kazoosa/Beacon/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kazoosa/Beacon/releases/tag/v0.1.0
