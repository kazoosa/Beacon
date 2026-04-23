import { useLocation } from "react-router-dom";

/**
 * The URL prefix the user is currently browsing under. Real accounts
 * live at `/app/*`; the shared demo lives at `/demo/*` so the URL
 * always announces "this is demo". The same Shell + page components
 * mount under both prefixes — only the prefix differs.
 */
export type BasePath = "/app" | "/demo";

export function useBasePath(): BasePath {
  const { pathname } = useLocation();
  return pathname === "/demo" || pathname.startsWith("/demo/") ? "/demo" : "/app";
}

/**
 * Build a route under the current prefix. `to("/holdings")` becomes
 * `/app/holdings` for real users and `/demo/holdings` while browsing
 * the demo. Pass an empty string for the index route.
 */
export function useTo(): (sub: string) => string {
  const base = useBasePath();
  return (sub: string) => {
    if (!sub || sub === "/") return base;
    const clean = sub.startsWith("/") ? sub : `/${sub}`;
    return `${base}${clean}`;
  };
}
