import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";
import { useAuth } from "../lib/auth";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";

/**
 * /demo — auto-signs the visitor in as the demo account and drops them
 * into the dashboard. The credentials live here, not in the UI, so the
 * sign-in page can stop showing them.
 *
 * If the user is already logged in, just forward straight to /app
 * instead of overwriting their session with the demo account.
 */

const DEMO_EMAIL = "demo@finlink.dev";
const DEMO_PASSWORD = "demo1234";

type Status = "idle" | "loading" | "ready" | "error";

export function DemoPage() {
  const { accessToken, login } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        await login(DEMO_EMAIL, DEMO_PASSWORD);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't open the demo right now.";
        setMessage(msg);
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  // Demo login is a one-shot effect on mount. Re-running on token change
  // would fight the Navigate below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (accessToken) return <Navigate to="/app" replace />;

  return (
    <div className="stripe-shell min-h-screen flex flex-col">
      {/* Soft corner wash so it matches the landing aesthetic */}
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
          {status !== "error" ? (
            <>
              <div className="stripe-chip mb-6 mx-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--stripe-accent)] animate-pulse" />
                Opening demo
              </div>
              <h1 className="text-[32px] sm:text-[40px] font-bold tracking-[-0.02em] leading-[1.08] text-[var(--stripe-ink)]">
                Warming up a portfolio for you.
              </h1>
              <p className="mt-4 text-[15px] leading-[1.55] text-[var(--stripe-ink-muted)]">
                Logging in, loading two seeded brokerages, and pulling in a realistic stack of
                holdings, dividends, and transactions. Give it a second.
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
