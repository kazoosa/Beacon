import { useEffect, useState, useCallback } from "react";
import { Widget } from "./components/Widget";

type OpsPayload = {
  ok: boolean;
  timestamp: string;
  services: Record<string, ServiceData>;
};

type ServiceData = {
  status: "ok" | "warn" | "error" | "unconfigured";
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
};

const AUTH_KEY = "beacon_ops_auth";
const REFRESH_MS = 30_000;

export function App() {
  const [password, setPassword] = useState<string>(
    () => localStorage.getItem(AUTH_KEY) ?? "",
  );
  const [authed, setAuthed] = useState<boolean>(
    () => Boolean(localStorage.getItem(AUTH_KEY)),
  );
  const [loginValue, setLoginValue] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [data, setData] = useState<OpsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchOps = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ops", {
        headers: { "x-ops-password": password },
      });
      if (res.status === 401) {
        localStorage.removeItem(AUTH_KEY);
        setAuthed(false);
        setPassword("");
        setErr("Wrong password");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as OpsPayload;
      setData(payload);
      setLastFetched(new Date());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    if (!authed) return;
    fetchOps();
    const t = setInterval(fetchOps, REFRESH_MS);
    return () => clearInterval(t);
  }, [authed, fetchOps]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/ops", {
        headers: { "x-ops-password": loginValue },
      });
      if (res.status === 401) {
        setLoginError("Wrong password");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      localStorage.setItem(AUTH_KEY, loginValue);
      setPassword(loginValue);
      setAuthed(true);
    } catch (e) {
      setLoginError((e as Error).message);
    }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    setPassword("");
    setAuthed(false);
    setData(null);
    setLoginValue("");
  }

  if (!authed) {
    return (
      <div className="login">
        <h2>Beacon Ops</h2>
        <p>Enter the ops password to continue.</p>
        <form onSubmit={doLogin}>
          <input
            type="password"
            placeholder="ops password"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoFocus
          />
          {loginError && <div className="error">{loginError}</div>}
          <button className="btn btn-primary" type="submit">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>
          <span className="logo">B</span>
          Beacon Ops
        </h1>
        <div className="actions">
          {lastFetched && (
            <span className="last-refresh">
              refreshed {fmtRelative(lastFetched)}
            </span>
          )}
          <button className="btn" onClick={fetchOps} disabled={loading}>
            {loading ? <span className="spin">↻</span> : "↻"} Refresh
          </button>
          <button className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {err && <div className="error">{err}</div>}

      {!data && loading && <div className="loading">Loading…</div>}

      {data && (
        <div className="grid">
          <Widget
            title="Backend · Render"
            status={data.services.render?.status}
            extLink="https://dashboard.render.com"
            data={data.services.render}
          />
          <Widget
            title="Frontend · Vercel"
            status={data.services.vercel?.status}
            extLink="https://vercel.com/dashboard"
            data={data.services.vercel}
          />
          <Widget
            title="Database · Neon"
            status={data.services.neon?.status}
            extLink="https://console.neon.tech"
            data={data.services.neon}
          />
          <Widget
            title="Redis · Upstash"
            status={data.services.upstash?.status}
            extLink="https://console.upstash.com"
            data={data.services.upstash}
          />
          <Widget
            title="Code · GitHub"
            status={data.services.github?.status}
            extLink="https://github.com/kazoosa/Beacon"
            data={data.services.github}
          />
          <Widget
            title="Health Check · Backend"
            status={data.services.health?.status}
            extLink="https://vesly-backend.onrender.com/health"
            data={data.services.health}
          />
        </div>
      )}

      <div className="footer">
        Auto-refreshes every 30s · Beacon Ops v0.1.0
      </div>
    </div>
  );
}

function fmtRelative(d: Date): string {
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleString();
}
