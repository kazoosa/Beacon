// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Beacon technical documentation site.
// Sidebar tree mirrors the on-disk layout under src/content/docs/
// using Starlight's `autogenerate` so adding a new MD file just
// puts it in the right folder and it shows up automatically. The
// only hand-curated section is the top-level order itself.
export default defineConfig({
  site: "https://beacon-docs.vercel.app",
  integrations: [
    starlight({
      title: "Beacon — Technical Docs",
      description:
        "Architecture, ADRs, runbooks, testing strategy, and onboarding for the Beacon portfolio dashboard.",
      // Tagline shown on the homepage hero.
      tagline:
        "Everything an engineer needs to ship to Beacon — from local setup to incident response.",
      social: {
        github: "https://github.com/kazoosa/Beacon",
      },
      // Top-level sidebar — order matters. Each section autogenerates
      // its child pages from the matching subdirectory under
      // src/content/docs/.
      sidebar: [
        {
          label: "Onboarding",
          autogenerate: { directory: "onboarding" },
        },
        {
          label: "Architecture",
          autogenerate: { directory: "architecture" },
        },
        {
          label: "Epics & Stories",
          autogenerate: { directory: "epics" },
        },
        {
          label: "ADRs",
          collapsed: true,
          autogenerate: { directory: "adrs" },
        },
        {
          label: "Runbooks",
          collapsed: true,
          autogenerate: { directory: "runbooks" },
        },
        {
          label: "Testing",
          autogenerate: { directory: "testing" },
        },
        {
          label: "API Reference",
          collapsed: true,
          autogenerate: { directory: "api" },
        },
      ],
      // Lightweight branding consistent with the dashboard's deep-ink
      // accent. Starlight handles dark mode with the same tokens.
      customCss: ["./src/styles/custom.css"],
      lastUpdated: true,
      editLink: {
        baseUrl: "https://github.com/kazoosa/Beacon/edit/main/apps/docs/",
      },
    }),
  ],
});
