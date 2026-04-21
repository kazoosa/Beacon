import { UserPlus, Link2, LayoutDashboard, Coins, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatedHero } from "../components/ui/animated-hero";
import { AuroraBackground } from "../components/ui/aurora-background";
import RadialOrbitalTimeline, { type TimelineItem } from "../components/ui/radial-orbital-timeline";

/**
 * PREVIEW route — not wired into the live landing yet.
 *
 * Issue fixes applied:
 *   - LAG: removed scroll-expansion-hero (scroll-hijacking + wheel events
 *     + constant state updates = jank). Aurora reworked to use cheap GPU
 *     gradients instead of filter:blur(10px) + mix-blend-difference.
 *     Orbital timeline uses rAF (paused off-screen + on hover) instead
 *     of setInterval.
 *   - UGLY BACKGROUND: removed entirely. No more Unsplash stock.
 *   - PHONECALL ICON on demo link: replaced with Play icon.
 *   - ORBITAL DATA: reordered to match the real onboarding flow, given
 *     explicit step numbers (1–5) so order is always obvious, linked
 *     only to logical neighbors (prev/next), better icons, clearer copy.
 */
const timelineData: TimelineItem[] = [
  {
    id: 1,
    title: "Sign up",
    date: "30 seconds",
    content: "Email + password. No card, no phone, no onboarding quiz.",
    category: "Start",
    icon: UserPlus,
    relatedIds: [2],
    status: "completed",
    energy: 100,
  },
  {
    id: 2,
    title: "Connect brokerage",
    date: "2 minutes",
    content: "Auto-sync via OAuth or upload a CSV. 20+ brokerages supported.",
    category: "Connect",
    icon: Link2,
    relatedIds: [1, 3],
    status: "completed",
    energy: 80,
  },
  {
    id: 3,
    title: "See holdings",
    date: "Instant",
    content: "Consolidated view across every account you connected. Deduped by ticker.",
    category: "View",
    icon: LayoutDashboard,
    relatedIds: [2, 4],
    status: "in-progress",
    energy: 65,
  },
  {
    id: 4,
    title: "Track dividends",
    date: "Automatic",
    content: "YTD totals, 12-month chart, and forward forecast of incoming income.",
    category: "Income",
    icon: Coins,
    relatedIds: [3, 5],
    status: "pending",
    energy: 40,
  },
  {
    id: 5,
    title: "Rebalance",
    date: "Any time",
    content: "See allocation drift. Know exactly what to sell and what to buy.",
    category: "Optimize",
    icon: Scale,
    relatedIds: [4],
    status: "pending",
    energy: 20,
  },
];

export function PreviewLandingPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      {/* Preview banner */}
      <div className="bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-100 text-xs text-center py-2 px-4">
        <strong>PREVIEW ROUTE</strong> — visual evaluation. Live landing is at{" "}
        <Link to="/" className="underline font-medium">/</Link>.
      </div>

      {/* Hero — animated rotating words inside the refined aurora.
          The scroll-expansion-hero + ugly stock photo are OUT. */}
      <AuroraBackground className="min-h-[90vh]">
        <AnimatedHero />
      </AuroraBackground>

      {/* Orbital timeline — the 5 Beacon steps, in order, with numbers */}
      <section className="py-24 bg-bg-base">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted mb-3">
              How it works
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-fg-primary max-w-3xl mx-auto">
              Five steps. One portfolio.
            </h2>
            <p className="text-fg-secondary mt-4 max-w-xl mx-auto">
              Click any numbered node to see what happens at that stage.
            </p>
          </div>
          <RadialOrbitalTimeline timelineData={timelineData} />
        </div>
      </section>

      {/* Sign-in preview link */}
      <section className="py-24 bg-bg-overlay border-t border-border-subtle">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted mb-3">
            Sign-in preview
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-fg-primary mb-4">
            Three.js shader sign-in
          </h2>
          <p className="text-fg-secondary mb-6">
            Separate full-screen route. Includes sign-in + sign-up toggle.
          </p>
          <Link
            to="/preview-signin"
            className="inline-flex items-center justify-center rounded-md bg-fg-primary text-bg-base h-11 px-8 font-medium hover:bg-fg-primary/90 transition-colors"
          >
            Open /preview-signin →
          </Link>
        </div>
      </section>
    </div>
  );
}
