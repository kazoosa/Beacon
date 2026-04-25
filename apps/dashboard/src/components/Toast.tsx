import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Single-toast system. One toast at a time is enough for the
 * delete-undo flow (Gmail-style). When a new toast arrives while one
 * is showing, the old one is committed (its onCommit fires) so the
 * action it represented isn't left in limbo.
 *
 * No third-party dep, no portal — the toast renders inside the
 * provider's tree via fixed positioning.
 */

interface Toast {
  id: number;
  message: string;
  /** Label on the action button (e.g. "Undo"). Hides the button if omitted. */
  actionLabel?: string;
  /** Called when the user clicks the action button. */
  onAction?: () => void;
  /** Called when the toast auto-dismisses or is replaced WITHOUT the user
   *  clicking the action. Use this to permanently commit the change. */
  onCommit?: () => void;
  /** Auto-dismiss timeout in ms. Defaults to 10s. */
  durationMs?: number;
}

interface ToastApi {
  show: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const idRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the *current* committed toast so when we replace it we can
  // call its onCommit exactly once. Refs avoid stale closures.
  const currentRef = useRef<Toast | null>(null);

  const dismiss = useCallback((mode: "commit" | "action") => {
    const t = currentRef.current;
    if (!t) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mode === "commit") t.onCommit?.();
    else t.onAction?.();
    currentRef.current = null;
    setToast(null);
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (t) => {
      // Replacing: commit the existing one before showing the new one.
      if (currentRef.current) dismiss("commit");
      const id = ++idRef.current;
      const next: Toast = { ...t, id };
      currentRef.current = next;
      setToast(next);
      timeoutRef.current = setTimeout(
        () => dismiss("commit"),
        t.durationMs ?? 10_000,
      );
    },
    [dismiss],
  );

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] card flex items-center gap-3 px-4 py-2.5 shadow-lg max-w-md"
        >
          <div className="text-sm text-fg-primary">{toast.message}</div>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={() => dismiss("action")}
              className="text-sm font-semibold text-fg-primary hover:underline"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss("commit")}
            className="text-fg-muted hover:text-fg-primary text-base leading-none ml-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback: if some part of the app forgets to mount the
    // provider, fall back to console.log instead of crashing. That way
    // a missing provider is a logged warning, not a white-screen.
    return {
      show: (t) =>
        // eslint-disable-next-line no-console
        console.warn("[toast] no provider mounted, dropping:", t.message),
    };
  }
  return ctx;
}
