import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { ConnectButton } from "./ConnectButton";
import { APP_NAME } from "../lib/brand";

const NAV = [
  { to: "/", label: "Overview", icon: "○" },
  { to: "/holdings", label: "Holdings", icon: "▤" },
  { to: "/transactions", label: "Transactions", icon: "⇅" },
  { to: "/dividends", label: "Dividends", icon: "◈" },
  { to: "/allocation", label: "Allocation", icon: "◐" },
  { to: "/accounts", label: "Accounts", icon: "⊞" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { developer, logout } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  return (
    <div className="min-h-screen flex bg-bg-base">
      <aside className="w-60 bg-bg-raised border-r border-border-subtle flex flex-col">
        <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-white text-xs font-bold shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_4px_12px_-4px_rgba(124,106,255,0.5)]"
              style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #5b8def 100%)" }}
            >
              {APP_NAME[0]}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-fg-primary">{APP_NAME}</span>
              <span className="text-[10px] text-fg-muted uppercase tracking-wider">Portfolio</span>
            </div>
          </div>
          <button
            onClick={toggle}
            className="w-7 h-7 rounded-md flex items-center justify-center text-fg-muted hover:text-fg-primary hover:bg-bg-hover transition-colors"
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <SunIcon />
            ) : (
              <MoonIcon />
            )}
          </button>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                  isActive
                    ? "text-fg-primary font-semibold bg-bg-overlay border-l-2 border-accent-brand -ml-[2px]"
                    : "text-fg-secondary hover:bg-bg-hover hover:text-fg-primary",
                )
              }
            >
              <span className="w-4 text-center text-fg-muted">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border-subtle">
          <ConnectButton />
        </div>
        <div className="px-5 py-3 border-t border-border-subtle">
          <div className="text-xs text-fg-secondary truncate">{developer?.email}</div>
          <button className="mt-1 text-xs text-fg-muted hover:text-fg-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-bg-base">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
