/**
 * Finnhub helpers. Finnhub's free tier gives 60 calls/minute, real-time
 * US equity quotes, and real company news via /company-news. We use it
 * whenever `process.env.FINNHUB_API_KEY` is set in the Vercel project;
 * if not, callers fall back to Stooq (for quote) or empty (for news).
 *
 * Key lives in the Vercel project env: Settings → Environment Variables
 * → add `FINNHUB_API_KEY`, value = the token from finnhub.io → Redeploy.
 */

export function hasFinnhubKey(): boolean {
  return !!process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.length > 5;
}

function key(): string {
  return process.env.FINNHUB_API_KEY ?? "";
}

async function fh<T>(path: string): Promise<T | null> {
  if (!hasFinnhubKey()) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const url = `https://finnhub.io/api/v1${path}${sep}token=${encodeURIComponent(key())}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------ Quote (real-time) */

export interface FinnhubQuote {
  c: number; // current
  d: number; // change
  dp: number; // percent change
  h: number; // day high
  l: number; // day low
  o: number; // day open
  pc: number; // previous close
  t: number; // unix timestamp
}

export interface FinnhubProfile {
  country?: string;
  currency?: string;
  exchange?: string;
  name?: string;
  ticker?: string;
  ipo?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  logo?: string;
  phone?: string;
  weburl?: string;
  finnhubIndustry?: string;
}

export async function fetchFinnhubQuote(symbol: string): Promise<{
  quote: FinnhubQuote;
  profile: FinnhubProfile | null;
} | null> {
  const [q, p] = await Promise.all([
    fh<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(symbol)}`),
    fh<FinnhubProfile>(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`),
  ]);
  if (!q || !Number.isFinite(q.c) || q.c === 0) return null;
  return { quote: q, profile: p };
}

/* ------------------------------------------------------- Company news */

export interface FinnhubNews {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

export async function fetchFinnhubNews(symbol: string): Promise<FinnhubNews[] | null> {
  // Finnhub wants a date range for company-news, max 7 days back for free tier.
  const now = new Date();
  const from = new Date(now.getTime() - 14 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const items = await fh<FinnhubNews[]>(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(now)}`,
  );
  return items;
}
