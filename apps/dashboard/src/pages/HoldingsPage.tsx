import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { fmtUsd, fmtPct } from "../components/money";

interface Holding {
  ticker_symbol: string;
  name: string;
  type: string;
  exchange: string | null;
  quantity: number;
  avg_cost: number;
  close_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  weight_pct: number;
  // Present only when type === "option". The Holdings table renders
  // a friendlier inline format ("AMAT $400 CALL · 2 days left")
  // instead of the raw "-AMAT260424C400" ticker when this is set.
  option?: {
    underlying_ticker: string;
    option_type: "call" | "put";
    strike: number;
    expiry: string;
    multiplier: number;
    days_to_expiry: number;
  };
  locations: Array<{
    institution: string;
    institution_color: string;
    account_name: string;
    quantity: number;
    value: number;
  }>;
}

/**
 * Pretty-format an option holding's display text:
 *   "AMAT $400 CALL · Apr 24 · 2d left"
 * Days-to-expiry color: green > 30, amber 7-30, red < 7. Kept inline
 * here rather than in a shared component because it's the only spot
 * the table needs it (OptionsPage uses a richer layout).
 */
function formatOptionHeader(o: NonNullable<Holding["option"]>): {
  text: string;
  expiryClass: string;
} {
  const expDate = new Date(o.expiry + "T00:00:00Z");
  const monthDay = expDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const dte = o.days_to_expiry;
  const dteText =
    dte < 0
      ? `expired ${Math.abs(dte)}d ago`
      : dte === 0
        ? "expires today"
        : `${dte}d left`;
  const expiryClass =
    dte < 0
      ? "text-fg-fainter"
      : dte < 7
        ? "text-rose-400"
        : dte < 30
          ? "text-amber-400"
          : "text-emerald-400";
  return {
    text: `${o.underlying_ticker} $${o.strike} ${o.option_type.toUpperCase()} · ${monthDay} · ${dteText}`,
    expiryClass,
  };
}

const HOLDING_KINDS = ["all", "stocks", "etfs", "options", "cash"] as const;
type HoldingKind = (typeof HOLDING_KINDS)[number];

function holdingMatchesKind(h: Holding, kind: HoldingKind): boolean {
  if (kind === "all") return true;
  if (kind === "options") return h.type === "option";
  if (kind === "cash") return h.type === "cash";
  if (kind === "etfs") return h.type === "etf";
  if (kind === "stocks") {
    // "stocks" = anything that isn't an option, ETF, or cash. Keeps the
    // filter intuitive even for security types we haven't classified
    // explicitly (mutual funds, fixed-income, equity fall in here).
    return h.type !== "option" && h.type !== "etf" && h.type !== "cash";
  }
  return true;
}

export function HoldingsPage() {
  const { accessToken } = useAuth();
  const f = apiFetch(() => accessToken);
  const q = useQuery({
    queryKey: ["holdings"],
    queryFn: () => f<{ holdings: Holding[]; total_value: number }>("/api/portfolio/holdings"),
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<"value" | "pl" | "weight" | "ticker">("value");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<HoldingKind>("all");

  const trimmedQuery = query.trim().toUpperCase();

  const sorted = useMemo(() => {
    const all = q.data?.holdings ?? [];
    const kindFiltered = all.filter((h) => holdingMatchesKind(h, kind));
    const matches = trimmedQuery
      ? kindFiltered.filter(
          (h) =>
            h.ticker_symbol.toUpperCase().includes(trimmedQuery) ||
            h.name.toUpperCase().includes(trimmedQuery) ||
            (h.option?.underlying_ticker.toUpperCase().includes(trimmedQuery) ??
              false),
        )
      : kindFiltered;
    return [...matches].sort((a, b) => {
      if (sort === "value") return b.market_value - a.market_value;
      if (sort === "pl") return b.unrealized_pl_pct - a.unrealized_pl_pct;
      if (sort === "weight") return b.weight_pct - a.weight_pct;
      return a.ticker_symbol.localeCompare(b.ticker_symbol);
    });
  }, [q.data, trimmedQuery, sort, kind]);

  // Count by kind so the filter buttons show how many positions are
  // in each bucket — useful when an Options filter on a stock-heavy
  // portfolio would otherwise look broken (zero matches).
  const kindCounts = useMemo(() => {
    const all = q.data?.holdings ?? [];
    const counts: Record<HoldingKind, number> = {
      all: all.length,
      stocks: 0,
      etfs: 0,
      options: 0,
      cash: 0,
    };
    for (const h of all) {
      for (const k of HOLDING_KINDS) {
        if (k === "all") continue;
        if (holdingMatchesKind(h, k)) counts[k]++;
      }
    }
    return counts;
  }, [q.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Holdings</h1>
          <p className="text-xs text-fg-muted mt-1">
            {q.data?.holdings.length ?? 0} positions · Consolidated across all connected brokerages
            {trimmedQuery && (
              <span className="ml-1 text-fg-fainter">
                · {sorted.length} match{sorted.length === 1 ? "" : "es"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <svg
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search holdings"
              className="input text-sm w-44"
              style={{ paddingLeft: "2.25rem" }}
              aria-label="Search holdings"
            />
          </div>
          <div className="flex gap-1 text-xs">
            {(["value", "pl", "weight", "ticker"] as const).map((k) => (
              <button
                key={k}
                className={`btn-ghost ${sort === k ? "bg-bg-hover text-fg-primary" : ""}`}
                onClick={() => setSort(k)}
              >
                {k === "ticker" ? "A–Z" : k === "pl" ? "P/L %" : k === "weight" ? "Weight" : "Value"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kind filter strip — separates stocks/ETFs/options/cash so the
          user can drill into a specific bucket. The all-count and
          per-kind counts are shown so empty buckets are obviously empty
          rather than ambiguously empty. */}
      <div className="flex gap-1 text-xs flex-wrap">
        {HOLDING_KINDS.map((k) => {
          const active = kind === k;
          const count = kindCounts[k];
          return (
            <button
              key={k}
              className={`btn-ghost capitalize ${active ? "bg-bg-hover text-fg-primary" : ""}`}
              onClick={() => setKind(k)}
              disabled={count === 0 && k !== "all"}
              title={count === 0 ? "No holdings of this type" : undefined}
            >
              {k}
              <span className="ml-1.5 text-fg-fainter font-num">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Ticker</th>
              <th>Name</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">Value</th>
              <th className="text-right">Unrealized P/L</th>
              <th className="text-right">Weight</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const plColor = h.unrealized_pl >= 0 ? "pos" : "neg";
              return (
                <>
                  <tr
                    key={h.ticker_symbol}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpanded(expanded === h.ticker_symbol ? null : h.ticker_symbol)
                    }
                  >
                    <td className="text-fg-fainter text-xs">
                      {expanded === h.ticker_symbol ? "▾" : "▸"}
                    </td>
                    <td className="font-num text-fg-primary font-semibold">
                      {h.option ? (
                        // Option rows display the underlying ticker + a
                        // small "OPT" badge so the table reads like
                        // "AMAT (OPT)" instead of the noisy
                        // "-AMAT260424C400" raw OCC string.
                        <Link
                          to={`/app/stocks?symbol=${encodeURIComponent(h.ticker_symbol)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline underline-offset-2 decoration-fg-muted inline-flex items-center gap-1.5"
                          title={`Open ${h.ticker_symbol} details`}
                        >
                          <span>{h.option.underlying_ticker}</span>
                          <span className="text-[9px] uppercase tracking-widest font-mono px-1 py-0.5 rounded bg-bg-overlay text-fg-muted">
                            opt
                          </span>
                        </Link>
                      ) : (
                        <Link
                          to={`/app/stocks?symbol=${encodeURIComponent(h.ticker_symbol)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline underline-offset-2 decoration-fg-muted"
                          title={`Open ${h.ticker_symbol} details`}
                        >
                          {h.ticker_symbol}
                        </Link>
                      )}
                    </td>
                    <td className="text-xs text-fg-secondary max-w-[260px] truncate">
                      {h.option ? (
                        (() => {
                          const fmt = formatOptionHeader(h.option);
                          // Option name shows contract specifics +
                          // expiry month/day + days-to-expiry, with the
                          // dte portion color-coded so a glance tells
                          // you what's about to expire. Format:
                          //   "AMAT $400 CALL · Apr 24 · 2d left"
                          const [specs, monthDay, dte] = fmt.text.split(" · ");
                          return (
                            <span>
                              <span className="text-fg-secondary">{specs}</span>
                              <span className="text-fg-fainter"> · {monthDay} · </span>
                              <span className={fmt.expiryClass}>{dte}</span>
                            </span>
                          );
                        })()
                      ) : (
                        h.name
                      )}
                    </td>
                    <td className="text-right font-num text-fg-secondary">{h.quantity.toFixed(4)}</td>
                    <td className="text-right font-num text-fg-secondary">{fmtUsd(h.avg_cost)}</td>
                    <td className="text-right font-num text-fg-secondary">{fmtUsd(h.close_price)}</td>
                    <td className="text-right font-num text-fg-primary">{fmtUsd(h.market_value)}</td>
                    <td className={`text-right font-num ${plColor}`}>
                      {fmtUsd(h.unrealized_pl, { showSign: true })}
                      <div className="text-xs">{fmtPct(h.unrealized_pl_pct, { showSign: true })}</div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1 bg-bg-overlay rounded-full overflow-hidden">
                          <div
                            className="h-full bg-fg-primary"
                            style={{ width: `${Math.min(100, h.weight_pct * 2)}%` }}
                          />
                        </div>
                        <span className="font-num text-xs text-fg-secondary w-10">
                          {h.weight_pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expanded === h.ticker_symbol && (
                    <tr key={`${h.ticker_symbol}-locations`}>
                      <td></td>
                      <td colSpan={8} className="bg-bg-base/60">
                        <div className="py-2">
                          <div className="text-[10px] text-fg-muted uppercase tracking-wider mb-2">
                            Held across
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {h.locations.map((l, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-3 py-2 bg-bg-overlay rounded-lg"
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: l.institution_color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-fg-primary truncate">{l.institution}</div>
                                  <div className="text-[10px] text-fg-muted truncate">
                                    {l.account_name}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-num text-xs text-fg-secondary">
                                    {l.quantity.toFixed(2)}
                                  </div>
                                  <div className="font-num text-[10px] text-fg-muted">
                                    {fmtUsd(l.value, { decimals: 0 })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {q.isSuccess && sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-fg-muted py-10">
                  {trimmedQuery
                    ? `No holdings match "${query}".`
                    : "No holdings yet. Connect a brokerage to get started."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
