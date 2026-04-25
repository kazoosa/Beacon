import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTo } from "../lib/basePath";
import { AddTransactionForm } from "./AddTransactionForm";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill ticker (used when launched from a stock-detail page). */
  initialTicker?: string;
}

/**
 * Lightweight overlay modal — no portal, no third-party deps. Pattern
 * matches DisconnectControl in AccountsPage: inline JSX, parent owns the
 * `open` state. Closes on Escape, on background click, or after a
 * successful submit.
 */
export function AddTransactionModal({ open, onClose, initialTicker }: Props) {
  const to = useTo();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add transaction"
    >
      <div
        className="card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-fg-primary">
              Add transaction
            </h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Backfill a missing trade or dividend by hand.
            </p>
          </div>
          <button
            type="button"
            className="text-fg-muted hover:text-fg-primary text-lg leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <AddTransactionForm
          initialTicker={initialTicker}
          onSuccess={() => onClose()}
        />

        <div className="mt-4 text-right">
          <Link
            to={to("transactions/new")}
            onClick={onClose}
            className="text-[11px] text-fg-muted hover:text-fg-primary"
          >
            Open in full page →
          </Link>
        </div>
      </div>
    </div>
  );
}
