const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

/**
 * Global refresh hook installed by AuthProvider on mount. apiFetch
 * calls this when it sees a 401 to swap the expired access token for
 * a fresh one and replay the request transparently. If the refresh
 * itself fails, the user is signed out and asked to log in again —
 * we never silently serve stale "empty" data because the token aged
 * out (which previously looked exactly like "your CSV import was
 * lost", since both produce empty arrays from the API).
 */
let globalAuthRefresh:
  | (() => Promise<{ accessToken: string | null }>)
  | null = null;
let globalAuthSignOut: (() => void) | null = null;
let inflightRefresh: Promise<{ accessToken: string | null }> | null = null;

export function installAuthRefresh(opts: {
  refresh: () => Promise<{ accessToken: string | null }>;
  signOut: () => void;
}) {
  globalAuthRefresh = opts.refresh;
  globalAuthSignOut = opts.signOut;
}

async function tryRefresh(): Promise<string | null> {
  if (!globalAuthRefresh) return null;
  if (!inflightRefresh) {
    inflightRefresh = globalAuthRefresh().finally(() => {
      // Clear after a tick so a burst of parallel 401s share one refresh.
      setTimeout(() => { inflightRefresh = null; }, 0);
    });
  }
  const { accessToken } = await inflightRefresh;
  return accessToken;
}

async function fetchWithAuth(
  path: string,
  init: RequestInit,
  token: string | null,
  retryOn401: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401 && retryOn401) {
    const fresh = await tryRefresh().catch(() => null);
    if (fresh) {
      return fetchWithAuth(path, init, fresh, false);
    }
    if (globalAuthSignOut) globalAuthSignOut();
  }
  return res;
}

export function apiFetch(getToken: () => string | null) {
  return async function <T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();
    const res = await fetchWithAuth(path, init ?? {}, token, true);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body?.error_message ?? "Request failed"), {
        status: res.status,
        body,
      });
    }
    return (await res.json()) as T;
  };
}

export function unauthedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return fetch(`${API}${path}`, init).then(async (res) => {
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw Object.assign(new Error(b?.error_message ?? "Request failed"), { status: res.status, body: b });
    }
    return (await res.json()) as T;
  });
}

export function itemFetch(accessToken: string) {
  return async function <T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw Object.assign(new Error(b?.error_message ?? "Request failed"), { status: res.status, body: b });
    }
    return (await res.json()) as T;
  };
}
