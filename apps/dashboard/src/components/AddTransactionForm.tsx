import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

interface Account {
  id: string;
  name: string;
  mask: string;
  institution: string;
  type: string;
  iso_currency_code: string;
}

const TX_TYPES = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "dividend", label: "Dividend" },
  { value: "interest", label: "Interest" },
  { value: "fee", label: "Fee" },
  { value: "transfer", label: "Transfer" },
] as const;

type TxType = (typeof TX_TYPES)[number]["value"];

const SHARE_TYPES: TxType[] = ["buy", "sell", "dividend"];

interface Props {
  /** Called after a successful submit. Modal closes via this hook;
   *  page navigates back to the list. */
  onSuccess?: (created: { id: string; ticker_symbol: string }) => void;
  /** Pre-fill the ticker (e.g. when opened from a stock detail page).
   *  Optional — most opens will leave this blank. */
  initialTicker?: string;
}

export function AddTransactionForm({ onSuccess, initialTicker }: Props) {
  const { accessToken } = useAuth();
  const f = apiFetch(() => accessToken);
  const qc = useQueryClient();

  const [accountId, setAccountId] = useState("");
  const [ticker, setTicker] = useState(initialTicker ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TxType>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const accountsQ = useQuery({
    queryKey: ["accounts", "for-add-tx"],
    queryFn: () => f<{ accounts: Account[] }>("/api/portfolio/accounts"),
    staleTime: 60_000,
  });

  // Default account = first investment account in the list. Stable across
  // re-mounts since the query is cached.
  useEffect(() => {
    if (!accountId && accountsQ.data?.accounts.length) {
      setAccountId(accountsQ.data.accounts[0]!.id);
    }
  }, [accountsQ.data, accountId]);

  const grouped = useMemo(() => {
    const accounts = accountsQ.data?.accounts ?? [];
    const byInst = new Map<string, Account[]>();
    for (const a of accounts) {
      const arr = byInst.get(a.institution) ?? [];
      arr.push(a);
      byInst.set(a.institution, arr);
    }
    return [...byInst.entries()];
  }, [accountsQ.data]);

  const showQuantity = SHARE_TYPES.includes(type);
  const priceLabel =
    type === "buy" || type === "sell"
      ? "Price per share"
      : type === "dividend"
      ? "Per-share dividend"
      : "Amount ($)";

  const submit = useMutation({
    mutationFn: async () => {
      const payload = {
        accountId,
        ticker: ticker.trim().toUpperCase(),
        date,
        type,
        quantity: showQuantity ? Number(quantity) || 0 : 0,
        price: Number(price) || 0,
        fees: Number(fees) || 0,
        notes: notes.trim() || undefined,
      };
      return f<{ transaction: { id: string; ticker_symbol: string } }>(
        "/api/portfolio/transactions/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["tx"] });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["dividends"] });
      qc.invalidateQueries({ queryKey: ["allocation"] });
      onSuccess?.(resp.transaction);
    },
    onError: (err) => {
      setError((err as Error).message);
    },
  });

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) return setError("Pick an account.");
    if (!ticker.trim() && SHARE_TYPES.includes(type)) {
      return setError("Ticker is required for share-affecting transactions.");
    }
    submit.mutate();
  }

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      <Field label="Account" required>
        <select
          className="input w-full"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={accountsQ.isLoading}
        >
          {accountsQ.isLoading && <option>Loading accounts…</option>}
          {!accountsQ.isLoading && grouped.length === 0 && (
            <option value="">No connected accounts</option>
          )}
          {grouped.map(([inst, accs]) => (
            <optgroup key={inst} label={inst}>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · ····{a.mask}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Type" required>
        <div className="flex flex-wrap gap-1">
          {TX_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`btn-ghost text-xs ${
                type === t.value ? "bg-bg-hover text-fg-primary" : ""
              }`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ticker" required={showQuantity}>
          <input
            className="input w-full font-num"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Date" required>
          <input
            className="input w-full"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {showQuantity && (
          <Field label="Quantity" required>
            <input
              className="input w-full font-num"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}
        <Field label={priceLabel} required>
          <input
            className="input w-full font-num"
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>

      {(type === "buy" || type === "sell") && (
        <Field label="Fees (optional)">
          <input
            className="input w-full font-num"
            type="number"
            step="any"
            min="0"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      )}

      <Field label="Notes (optional)">
        <textarea
          className="input w-full text-sm"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you'll want to remember about this entry."
        />
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          className="btn-primary"
          disabled={submit.isPending || accountsQ.isLoading}
        >
          {submit.isPending ? "Saving…" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-fg-muted mb-1">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </div>
      {children}
    </label>
  );
}
