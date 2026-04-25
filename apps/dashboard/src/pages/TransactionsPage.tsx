import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { fmtUsd } from "../components/money";
import { useTo } from "../lib/basePath";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { useToast } from "../components/Toast";

interface Tx {
  id: string;
  account_id: string;
  date: string;
  type: string;
  ticker_symbol: string;
  security_name: string;
  quantity: number;
  price: number;
  amount: number;
  fees?: number;
  institution: string;
  institution_color: string;
  account_name: string;
}

const TYPES = ["all", "buy", "sell", "dividend", "interest", "transfer", "fee"] as const;

export function TransactionsPage() {
  const { accessToken } = useAuth();
  const f = apiFetch(() => accessToken);
  const to = useTo();
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [ticker, setTicker] = useState("");
  const [inst, setInst] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const q = useQuery({
    queryKey: ["tx", type, ticker],
    queryFn: () => {
      const params = new URLSearchParams({ count: "300" });
      if (type !== "all") params.set("type", type);
      if (ticker) params.set("ticker", ticker);
      return f<{ transactions: Tx[]; total: number }>(`/api/portfolio/transactions?${params}`);
    },
  });

  const institutions = useMemo(() => {
    const set = new Set<string>();
    q.data?.transactions.forEach((t) => set.add(t.institution));
    return [...set];
  }, [q.data]);

  const rows = (q.data?.transactions ?? []).filter(
    (t) => inst === "all" || t.institution === inst,
  );

  // Monthly summary for sidebar
  const summary = useMemo(() => {
    const byType: Record<string, number> = { buy: 0, sell: 0, dividend: 0 };
    for (const t of rows) {
      byType[t.type] = (byType[t.type] ?? 0) + t.amount;
    }
    return byType;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Transactions</h1>
          <p className="text-xs text-fg-muted mt-1">{rows.length} transactions</p>
        </div>
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => setAddOpen(true)}
        >
          + Add transaction
        </button>
      </div>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Buys (shown)" value={summary.buy ?? 0} />
        <SummaryCard label="Sells (shown)" value={summary.sell ?? 0} color="pos" />
        <SummaryCard label="Dividends (shown)" value={summary.dividend ?? 0} color="pos" />
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[10px] text-fg-muted uppercase mb-1">Type</div>
          <div className="flex gap-1 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`btn-ghost text-xs ${type === t ? "bg-bg-hover text-fg-primary" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] text-fg-muted uppercase mb-1">Ticker</div>
          <input
            className="input"
            placeholder="AAPL, SPY, ..."
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <div className="text-[10px] text-fg-muted uppercase mb-1">Brokerage</div>
          <select
            className="input"
            value={inst}
            onChange={(e) => setInst(e.target.value)}
          >
            <option value="all">All</option>
            {institutions.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {q.isError && (
        <div className="card p-6 text-center">
          <div className="text-sm text-rose-400">
            Couldn't load your transactions.
          </div>
          <div className="text-xs text-fg-muted mt-1">
            {(q.error as Error)?.message ?? "The transactions endpoint returned an error."}
          </div>
          <button
            type="button"
            className="btn-ghost text-xs mt-3"
            onClick={() => q.refetch()}
          >
            Try again
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Security</th>
              <th>Brokerage</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Amount</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="text-xs text-fg-secondary font-num">{t.date}</td>
                <td>
                  <TxBadge type={t.type} />
                </td>
                <td>
                  {t.ticker_symbol ? (
                    <Link
                      to={`${to("stocks")}?symbol=${encodeURIComponent(t.ticker_symbol)}`}
                      className="font-num text-fg-primary text-sm hover:underline underline-offset-2 decoration-fg-muted"
                      title={`Open ${t.ticker_symbol} details`}
                    >
                      {t.ticker_symbol}
                    </Link>
                  ) : (
                    <div className="font-num text-fg-primary text-sm">—</div>
                  )}
                  <div className="text-[10px] text-fg-muted truncate max-w-[180px]">
                    {t.security_name}
                  </div>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: t.institution_color }}
                    />
                    {t.institution}
                  </span>
                  <div className="text-[10px] text-fg-muted">{t.account_name}</div>
                </td>
                <td className="text-right font-num text-fg-secondary">
                  {t.quantity ? t.quantity.toFixed(4) : "—"}
                </td>
                <td className="text-right font-num text-fg-secondary">
                  {t.price ? fmtUsd(t.price) : "—"}
                </td>
                <td className="text-right font-num">
                  {t.type === "dividend" || t.type === "interest" || t.type === "sell" ? (
                    <span className="pos">+{fmtUsd(t.amount)}</span>
                  ) : (
                    <span className="text-fg-secondary">{fmtUsd(t.amount)}</span>
                  )}
                </td>
                <td className="text-right">
                  <DeleteTxButton tx={t} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && !q.isError && (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  {(q.data?.transactions.length ?? 0) === 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm text-fg-primary font-medium">
                        No transactions yet
                      </div>
                      <div className="text-xs text-fg-muted max-w-md mx-auto leading-relaxed">
                        Transactions come from your broker's <strong>activity</strong> export
                        (buys, sells, dividends, fees) — not from the positions snapshot.
                        If you've only uploaded a positions CSV, your holdings will show up
                        but your trade history won't.
                      </div>
                      <div className="pt-2">
                        <Link
                          to={to("accounts")}
                          className="btn-primary text-xs inline-flex"
                        >
                          Import an activity CSV
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <span className="text-fg-muted">No transactions match your filters.</span>
                  )}
                </td>
              </tr>
            )}
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="text-center text-fg-muted py-10">
                  Loading transactions…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: "pos" }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] text-fg-muted uppercase tracking-wider">{label}</div>
      <div className={`font-num text-xl mt-1 ${color === "pos" ? "pos" : "text-fg-primary"}`}>
        {fmtUsd(value)}
      </div>
    </div>
  );
}

function TxBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    buy: "badge-blue",
    sell: "badge-amber",
    dividend: "badge-green",
    interest: "badge-green",
    transfer: "badge-gray",
    fee: "badge-red",
  };
  return <span className={map[type] ?? "badge-gray"}>{type.toUpperCase()}</span>;
}

/**
 * Delete affordance per row. One click → toast with Undo.
 *
 * Flow:
 *   1. User clicks ×
 *   2. We snapshot the row, optimistically remove it (via cache
 *      invalidate), and call DELETE on the server.
 *   3. Show a 10-second toast: "Transaction deleted. Undo".
 *   4a. If user clicks Undo, POST manual-add with the snapshot →
 *       row reappears (with a new id, but identical fields).
 *   4b. If the toast times out, the delete is committed; we don't
 *       store the snapshot beyond that.
 *
 * Note: the restored transaction has a *new* id. From the user's
 * perspective the row is back; from a database-audit perspective the
 * original id is gone. Acceptable for v1 — see "Approach A" in plan.
 */
function DeleteTxButton({ tx }: { tx: Tx }) {
  const { accessToken } = useAuth();
  const f = apiFetch(() => accessToken);
  const qc = useQueryClient();
  const toast = useToast();

  const del = useMutation({
    mutationFn: () =>
      f<{ deleted: { id: string }; holdings_recomputed: number }>(
        `/api/portfolio/transactions/${tx.id}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      // Refetch immediately so the row disappears from the table.
      qc.invalidateQueries({ queryKey: ["tx"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["dividends"] });
      qc.invalidateQueries({ queryKey: ["allocation"] });

      toast.show({
        message: `Deleted ${tx.ticker_symbol || tx.type}.`,
        actionLabel: "Undo",
        durationMs: 10_000,
        onAction: async () => {
          try {
            // Re-create from the snapshot. For dividend/buy/sell the
            // server expects positive quantity + price; we already
            // have those on the row. For interest/fee/transfer the
            // server interprets `price` as the dollar amount, so we
            // pass abs(amount) there.
            const isCashOnly = ["interest", "fee", "transfer"].includes(tx.type);
            await f("/api/portfolio/transactions/manual", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accountId: tx.account_id,
                ticker: tx.ticker_symbol || "CASH",
                date: tx.date,
                type: tx.type,
                quantity: isCashOnly ? 0 : Math.abs(tx.quantity ?? 0),
                price: isCashOnly ? Math.abs(tx.amount ?? 0) : tx.price,
                fees: tx.fees ?? 0,
              }),
            });
            qc.invalidateQueries({ queryKey: ["tx"] });
            qc.invalidateQueries({ queryKey: ["holdings"] });
            qc.invalidateQueries({ queryKey: ["summary"] });
            qc.invalidateQueries({ queryKey: ["dividends"] });
            qc.invalidateQueries({ queryKey: ["allocation"] });
            toast.show({
              message: `Restored ${tx.ticker_symbol || tx.type}.`,
              durationMs: 3_000,
            });
          } catch (err) {
            toast.show({
              message: `Couldn't undo: ${(err as Error).message}`,
              durationMs: 6_000,
            });
          }
        },
      });
    },
    onError: (err) => {
      toast.show({
        message: `Couldn't delete: ${(err as Error).message}`,
        durationMs: 6_000,
      });
    },
  });

  return (
    <button
      type="button"
      onClick={() => del.mutate()}
      disabled={del.isPending}
      className="text-fg-muted hover:text-rose-400 text-sm"
      title="Delete transaction"
      aria-label="Delete transaction"
    >
      ×
    </button>
  );
}
