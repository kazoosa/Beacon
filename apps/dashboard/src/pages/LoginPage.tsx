import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { APP_NAME } from "../lib/brand";
import { BeaconMark } from "../components/BeaconMark";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Wake the backend as soon as the login page mounts. Render's free tier
  // sleeps after 15min idle and takes 30-50s to cold-start. This fire-and-
  // forget GET /health gets the engine spinning while the user types.
  useEffect(() => {
    fetch(`${API_URL}/health`, { method: "GET", mode: "cors" }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      nav("/app");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-fg-primary">
            <BeaconMark size={28} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-fg-primary">{APP_NAME}</span>
            <span className="text-[10px] text-fg-muted uppercase tracking-wider">Portfolio</span>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-fg-primary mb-1">Sign in</h1>
        <p className="text-sm text-fg-secondary mb-6">Track all your investments in one place</p>
        <label className="block text-xs font-medium text-fg-secondary mb-1">Email</label>
        <input
          className="input mb-3"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="block text-xs font-medium text-fg-secondary mb-1">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          className="input mb-4"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <div className="text-sm text-rose-400 mb-3">{err}</div>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-xs text-fg-muted mt-4 text-center">
          Need an account?{" "}
          <Link to="/register" className="text-fg-primary hover:underline">
            Register
          </Link>
        </div>
        <div className="text-[10px] text-fg-fainter mt-6 text-center border-t border-border-subtle pt-4">
          Demo: demo@finlink.dev / demo1234
        </div>
      </form>
    </div>
  );
}
