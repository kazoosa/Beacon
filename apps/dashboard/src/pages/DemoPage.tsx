import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";
import { useAuth } from "../lib/auth";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";

/**
 * /demo — auto-signs the visitor in as the demo account, makes sure
 * their portfolio is seeded with realistic mock data, and then drops
 * them into the dashboard.
 *
 * The per-developer seed lives server-side behind
 * POST /api/portfolio/seed-demo. It's idempotent: if the demo account
 * already has items, it returns `{ created: false }` immediately;
 * otherwise it creates four mock brokerages with holdings,
 * transactions, and dividends. We call it on every demo login so the
 * flow is resilient to a fresh database that's never been seeded
 * (exactly what was happening in production).
 */

const DEMO_EMAIL = "demo@finlink.dev";
const DEMO_PASSWORD = "demo1234";
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

type Stage = "logging-in" | "seeding" | "error";

export function DemoPage() {
  const { accessToken, login } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("logging-in");
  const [message, setMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      // 1) Log in as the demo account (unless we already have a session).
      if (!accessToken) {
        try {
          setStage("logging-in");
          await login(DEMO_EMAIL, DEMO_PASSWORD);
        } catch (err) {
          if (cancelled) return;
          const msg =
            err instanceof Error && err.message
              ? err.message
              : "Couldn't sign into the demo account.";
          setMessage(msg);
          setStage("error");
          return;
        }
      }

      if (cancelled) return;
      setStage("seeding");

      // 2) Always run seed-demo — idempotent, and this fixes returning
      //    visitors whose demo accounts were created before the seed
      //    flow existed. The token the AuthProvider just set isn't
      //    returned from login(), so grab it out of localStorage.
      let freshToken: string | null = accessToken;
      if (!freshToken) {
        try {
          const raw = localStorage.getItem("finlink_auth");
          if (raw) freshToken = (JSON.parse(raw) as { accessToken: string | null }).accessToken;
        } catch { /* fall through */ }
      }

      try {
        const res = await fetch(`${API}/api/portfolio/seed-demo`, {
          method: "POST",
          headers: {
            ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}),
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        if (!res.ok) {
          console.warn("[demo] seed-demo returned", res.status);
        }
      } catch (err) {
        console.warn("[demo] seed-demo fetch failed", err);
      }

      if (cancelled) return;
      navigate("/app", { replace: true });
    })();

    return () => { cancelled = true; };
  // Intentionally one-shot on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stripe-shell min-h-screen flex flex-col">
      <div aria-hidden className="fixed inset-0 pointer-events-none stripe-hero-bg" />

      <header className="relative z-10 border-b border-[var(--stripe-hairline)] bg-white/90">
        <div className="max-w-[1111px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[var(--stripe-ink)]">
            <BeaconMark size={22} />
            <span className="font-semibold tracking-tight text-[15px]">{APP_NAME}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--stripe-ink-muted)] hover:text-[var(--stripe-ink)] transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[440px] text-center">
          {stage !== "error" ? (
            <>
              <div className="stripe-chip mb-6 mx-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--stripe-accent)] animate-pulse" />
                {stage === "logging-in" ? "Signing in" : "Loading portfolio"}
              </div>
              <h1 className="text-[32px] sm:text-[40px] font-bold tracking-[-0.02em] leading-[1.08] text-[var(--stripe-ink)]">
                {stage === "logging-in"
                  ? "Opening the demo…"
                  : "Warming up a portfolio for you."}
              </h1>
              <p className="mt-4 text-[15px] leading-[1.55] text-[var(--stripe-ink-muted)]">
                {stage === "logging-in"
                  ? "One second while we open your read-only demo session."
                  : "Loading four seeded brokerages with a realistic stack of holdings, dividends, and transactions. First run takes a moment; subsequent visits are instant."}
              </p>
              <div className="mt-8 flex justify-center">
                <Spinner />
              </div>
              <p className="mt-8 text-[12px] text-[var(--stripe-ink-faint)]">
                Read-only account. You can kick the tyres, nothing you do here touches real money.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] leading-[1.08] text-[var(--stripe-ink)]">
                Couldn't open the demo.
              </h1>
              <p className="mt-3 text-[14px] leading-[1.55] text-[var(--stripe-ink-muted)]">
                {message ?? "The demo service may be warming up from a cold start. Give it a moment and try again."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="stripe-btn-primary inline-flex items-center gap-1.5 text-[14px]"
                >
                  Try again
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <Link to="/" className="stripe-btn-ghost inline-flex items-center gap-1.5 text-[14px]">
                  Back to site
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width={36}
      height={36}
      viewBox="0 0 36 36"
      aria-hidden
      className="animate-spin text-[var(--stripe-accent)]"
      style={{ animationDuration: "900ms" }}
    >
      <circle cx={18} cy={18} r={14} stroke="currentColor" strokeOpacity={0.15} strokeWidth={3} fill="none" />
      <path
        d="M18 4 A14 14 0 0 1 32 18"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
