import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTo } from "../lib/basePath";
import { AddTransactionForm } from "../components/AddTransactionForm";

/**
 * Full-page mount of the add-transaction form. Lives under the same
 * Shell as the rest of /app/* so the sidebar + auth context come for
 * free. Used for: deep links (e.g. "Add a trade for AAPL" from a stock
 * detail page), mobile (modal is awkward on small screens), and power
 * users who want to add several transactions in a row without opening
 * + closing the modal each time.
 */
export function AddTransactionPage() {
  const to = useTo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTicker = params.get("symbol") ?? undefined;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <Link
          to={to("transactions")}
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to transactions
        </Link>
        <h1 className="text-xl font-semibold text-fg-primary mt-3">
          Add transaction
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Backfill a missing trade or dividend. Holdings refresh automatically.
        </p>
      </div>

      <div className="card p-5">
        <AddTransactionForm
          initialTicker={initialTicker}
          onSuccess={() => navigate(to("transactions"))}
        />
      </div>
    </div>
  );
}
