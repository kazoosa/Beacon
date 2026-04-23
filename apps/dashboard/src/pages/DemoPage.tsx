import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Home, AlertCircle } from "lucide-react";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";

/**
 * Loading + error UI shown while a `/demo/*` route is provisioning a
 * shared-demo session. Mounted by RequireDemo (App.tsx) — RequireDemo
 * is the one that calls loginDemo(); this page only renders state.
 *
 * It also runs a pre-flight against /api/demo/status so a stale or
 * un-seeded backend surfaces a visible diagnostic instead of silently
 * landing the visitor on an empty dashboard.
 */

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

interface DemoStatus {
  demoDeveloperExists: boolean;
  applicationCount: number;
  itemCount: number;
  investmentHoldingCount: number;
  investmentTransactionCount: number;
  institutionCount: number;
  securityCount: number;
  serverTimeMs: number;
  environment: string;
}

export function DemoPage() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [errorTitle, setErrorTitle] = useState<string>("");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/demo/status`, {
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`Status endpoint returned HTTP ${r.status}`);
        const s = (await r.json()) as DemoStatus;
        if (cancelled) return;
        setStatus(s);
        if (!s.demoDeveloperExists) {
          setErrorTitle("The demo account doesn't exist on this backend.");
          setErrorDetail(
            "This usually means the boot-time seed never ran. Check the backend logs for [seedIfEmpty] output.",
          );
          setHasError(true);
          return;
        }
        if (s.investmentHoldingCount === 0) {
          setErrorTitle("The demo account has no portfolio data.");
          setErrorDetail(
            `The backend is reachable but the demo seed didn't produce any holdings. itemCount=${s.itemCount}, institutionCount=${s.institutionCount}, securityCount=${s.securityCount}.`,
          );
          setHasError(true);
        }
      } catch (err) {
        if (cancelled) return;
        setErrorTitle("Can't reach the backend.");
        setErrorDetail(
          err instanceof Error
            ? err.message
            : "Fetch to /api/demo/status failed with an unknown error.",
        );
        setHasError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="stripe-shell min-h-screen flex flex-col">
      <header
        className="relative z-10 border-b"
        style={{
          borderColor: "var(--stripe-hairline)",
          backgroundColor: "rgba(249, 248, 246, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
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
        <div className="w-full max-w-[560px] text-center">
          {hasError ? (
            <ErrorPanel
              title={errorTitle}
              detail={errorDetail}
              api={API}
              status={status}
            />
          ) : (
            <>
              <div className="stripe-chip mb-6 mx-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--stripe-accent)] animate-pulse" />
                Loading demo
              </div>
              <h1 className="stripe-display text-[36px] sm:text-[48px] leading-[1.04] tracking-[-0.018em] text-[var(--stripe-ink)]">
                Warming up a portfolio for you.
              </h1>
              <p className="mt-5 text-[15px] leading-[1.6] text-[var(--stripe-ink-muted)]">
                Waking up the free-tier backend and signing you in. First visit
                after an idle period can take up to 20s.
              </p>
              <div className="mt-8 flex justify-center">
                <Spinner />
              </div>
              <p className="mt-8 text-[12px] text-[var(--stripe-ink-faint)]">
                Read-only account. Nothing you do here touches real money.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------- Error UI */

function ErrorPanel({
  title, detail, api, status,
}: {
  title: string;
  detail: string;
  api: string;
  status: DemoStatus | null;
}) {
  return (
    <div className="text-left">
      <div
        className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.14em]"
        style={{
          backgroundColor: "#fff2f0",
          color: "#a01818",
          border: "1px solid #f5cac4",
        }}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Demo unavailable
      </div>
      <h1 className="stripe-display text-[28px] sm:text-[36px] leading-[1.08] tracking-[-0.018em] text-[var(--stripe-ink)] mb-3">
        {title}
      </h1>
      <p className="text-[14px] leading-[1.6] text-[var(--stripe-ink-muted)] mb-6">
        {detail}
      </p>

      <div
        className="rounded-xl border p-4 sm:p-5 mb-6 font-mono text-[12px] leading-[1.6] overflow-auto"
        style={{
          backgroundColor: "var(--stripe-surface-raised)",
          borderColor: "var(--stripe-hairline)",
          color: "var(--stripe-ink)",
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--stripe-ink-faint)] mb-2">
          Diagnostics
        </div>
        <div><span className="text-[var(--stripe-ink-faint)]">API:</span> {api}</div>
        {status ? (
          <pre className="mt-2 whitespace-pre-wrap break-words">
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : (
          <div className="mt-2 text-[var(--stripe-ink-faint)]">
            /api/demo/status never responded — likely a CORS issue, a cold-start timeout, or the
            backend is down. Open the Network tab for details.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="stripe-btn-primary inline-flex items-center gap-1.5 text-[14px]"
        >
          Retry
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <a
          href={`${api}/api/demo/status`}
          target="_blank"
          rel="noopener noreferrer"
          className="stripe-btn-ghost inline-flex items-center gap-1.5 text-[14px]"
        >
          Open /api/demo/status
        </a>
        <Link to="/" className="stripe-btn-ghost inline-flex items-center gap-1.5 text-[14px]">
          Back to site
        </Link>
      </div>
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
