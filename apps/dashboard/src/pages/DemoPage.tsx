import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";
import { useAuth } from "../lib/auth";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";

/**
 * /demo — auto-signs the visitor in as the demo account and drops
 * them into the dashboard.
 *
 * The backend's POST /api/auth/login detects demo@finlink.dev and
 * runs seed-guarantee synchronously before returning tokens, so by
 * the time login resolves here the portfolio data is already in
 * place. No client-side seed call, no timeouts, no empty dashboards.
 */

const DEMO_EMAIL = "demo@finlink.dev";
const DEMO_PASSWORD = "demo1234";

type Stage = "logging-in" | "error";

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
      // Backend handles seeding synchronously inside the demo login
      // route, so by the time this returns the portfolio is populated.
      // No separate seed call, no timeouts, no races.
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
      navigate("/app", { replace: true });
    })();

    return () => { cancelled = true; };
  // Intentionally one-shot on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stripe-shell min-h-screen flex flex-col">
      <header className="relative z-10 border-b border-[var(--stripe-hairline)]" style={{ backgroundColor: "rgba(249, 248, 246, 0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
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
                Opening your demo
              </div>
              <h1 className="stripe-display text-[36px] sm:text-[48px] leading-[1.04] tracking-[-0.018em] text-[var(--stripe-ink)]">
                Warming up a portfolio for you.
              </h1>
              <p className="mt-5 text-[15px] leading-[1.6] text-[var(--stripe-ink-muted)]">
                Signing in, preparing four seeded brokerages with holdings, dividends, and
                transactions. First visit may take up to 30 seconds; repeat visits are instant.
              </p>
              <div className="mt-8 flex justify-center">
                <Spinner />
              </div>
              <p className="mt-8 text-[12px] text-[var(--stripe-ink-faint)]">
                Read-only account. Nothing you do here touches real money.
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
