/**
 * Live market data.
 *
 * Layered source strategy, best-first:
 *   1. Finnhub (real-time, 60/min free) — when FINNHUB_API_KEY is set
 *      in the Vercel project env. Real market data with sub-second
 *      latency.
 *   2. Stooq — free, no-auth CSV. ~15 minutes delayed but works from
 *      any IP.
 *
 * History sits outside this chain: Finnhub's candles moved to paid
 * tier, so we still try Yahoo's v8/finance/chart endpoint directly
 * (different rate-limit characteristics than quote endpoints) and
 * accept an empty response if that 429s.
 *
 * File is still called `yahoo.ts` to minimize the blast radius on
 * the serverless handlers that import it.
 */
import { fetchFinnhubQuote, fetchFinnhubNews, hasFinnhubKey } from "./finnhub.js";

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\.(?=[A-Z]$)/, "-");
}

export function isValidSymbol(s: string): boolean {
  return /^[A-Z]{1,6}(?:[-.][A-Z]{1,4})?$/.test(s);
}

export interface StockQuote {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  peRatio: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  avgVolume: number | null;
  dividendYieldPct: number | null;
  beta: number | null;
  sector: string | null;
  logoUrl: string | null;
  isFallback: boolean;
  asOf: string;
}

let lastError: string | null = null;
export function getLastError(): string | null {
  return lastError;
}

/** Stooq uses `.us` suffix for US equities. BRK-B → brk-b.us works. */
function stooqSymbol(sym: string): string {
  return `${sym.toLowerCase()}.us`;
}

async function stooqFetch(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Beacon/1.0)",
        Accept: "text/csv, text/plain, */*",
      },
    });
    if (!r.ok) {
      lastError = `stooq HTTP ${r.status}`;
      return null;
    }
    const text = await r.text();
    if (text.toLowerCase().includes("no data")) {
      lastError = "stooq returned 'no data'";
      return null;
    }
    return text;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  // 1) Finnhub first (real-time) when the env key is present.
  if (hasFinnhubKey()) {
    const fh = await fetchFinnhubQuote(symbol);
    if (fh) {
      const { quote: q, profile: p } = fh;
      return {
        symbol,
        name: p?.name ?? symbol,
        exchange: p?.exchange ?? null,
        currency: p?.currency ?? "USD",
        price: q.c,
        previousClose: q.pc,
        change: q.d,
        changePct: q.dp,
        marketCap: p?.marketCapitalization
          ? p.marketCapitalization * 1_000_000 // Finnhub returns in millions
          : null,
        peRatio: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        volume: null,
        avgVolume: null,
        dividendYieldPct: null,
        beta: null,
        sector: p?.finnhubIndustry ?? null,
        logoUrl: p?.logo ?? null,
        isFallback: false,
        asOf: q.t ? new Date(q.t * 1000).toISOString() : new Date().toISOString(),
      };
    }
    lastError = "finnhub quote: empty, falling back to stooq";
  }

  // 2) Stooq — delayed but free, no key.
  // Fields: Symbol, Date, Time, Open, High, Low, Close, Volume, Name
  const url = `https://stooq.com/q/l/?s=${stooqSymbol(symbol)}&f=sd2t2ohlcvn&h&e=csv`;
  const csv = await stooqFetch(url);
  if (!csv) return null;
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    lastError = "stooq quote: no data row";
    return null;
  }
  const [header, data] = rows;
  const idx = (name: string) =>
    header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const name = data[idx("name")] ?? symbol;
  const open = parseFloat(data[idx("open")]);
  const close = parseFloat(data[idx("close")]);
  const volume = parseInt(data[idx("volume")], 10);

  if (!Number.isFinite(close) || close === 0) {
    lastError = `stooq quote: invalid close (${data[idx("close")]})`;
    return null;
  }

  // Stooq's single-row endpoint doesn't carry previous-close directly.
  // Use open as a cheap proxy for intraday change so the UI has a
  // non-zero delta to render.
  const prev = Number.isFinite(open) && open > 0 ? open : close;
  const change = close - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  return {
    symbol,
    name,
    exchange: null,
    currency: "USD",
    price: close,
    previousClose: prev,
    change,
    changePct,
    marketCap: null,
    peRatio: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    volume: Number.isFinite(volume) ? volume : null,
    avgVolume: null,
    dividendYieldPct: null,
    beta: null,
    sector: null,
    logoUrl: null,
    isFallback: false,
    asOf: new Date().toISOString(),
  };
}

export type HistoryRange = "1d" | "5d" | "1mo" | "3mo" | "1y" | "max";

export interface StockCandle {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface StockHistory {
  symbol: string;
  range: HistoryRange;
  candles: StockCandle[];
  isFallback: boolean;
}

function rangeToYahooParams(range: HistoryRange): { interval: string; range: string } {
  switch (range) {
    case "1d":  return { interval: "5m",  range: "1d"  };
    case "5d":  return { interval: "15m", range: "5d"  };
    case "1mo": return { interval: "1d",  range: "1mo" };
    case "3mo": return { interval: "1d",  range: "3mo" };
    case "1y":  return { interval: "1d",  range: "1y"  };
    case "max": return { interval: "1wk", range: "max" };
  }
}

/**
 * Yahoo's v8 chart endpoint (`query1.finance.yahoo.com/v8/finance/chart`)
 * serves OHLCV candles without the cookie+crumb handshake that the v7
 * quote endpoint requires, and does not aggressively rate-limit
 * datacenter IPs the way v7 quote does. Using it direct via fetch
 * avoids the 429s yahoo-finance2 runs into on Vercel.
 */
export async function fetchHistory(
  symbol: string,
  range: HistoryRange,
): Promise<StockHistory> {
  try {
    const { interval, range: r } = rangeToYahooParams(range);
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${interval}&range=${r}&includePrePost=false`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    if (!resp.ok) {
      lastError = `yahoo chart HTTP ${resp.status}`;
      return { symbol, range, candles: [], isFallback: true };
    }
    type ChartResp = {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const body = (await resp.json()) as ChartResp;
    const result = body?.chart?.result?.[0];
    const ts = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0];
    if (!q || ts.length === 0) {
      lastError = "yahoo chart: empty result";
      return { symbol, range, candles: [], isFallback: true };
    }
    const candles: StockCandle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = q.close?.[i] ?? null;
      if (close === null) continue;
      candles.push({
        time: new Date(ts[i] * 1000).toISOString(),
        open: q.open?.[i] ?? null,
        high: q.high?.[i] ?? null,
        low: q.low?.[i] ?? null,
        close,
        volume: q.volume?.[i] ?? null,
      });
    }
    return { symbol, range, candles, isFallback: candles.length === 0 };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { symbol, range, candles: [], isFallback: true };
  }
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  relativeTime: string;
}

/**
 * News via Finnhub /company-news when a key is configured, otherwise
 * empty. The UI renders an honest "Live news feed coming soon"
 * message on empty arrays.
 */
export async function fetchNews(
  symbol: string,
  limit = 10,
): Promise<NewsItem[]> {
  if (!hasFinnhubKey()) return [];
  const raw = await fetchFinnhubNews(symbol);
  if (!raw) return [];
  // Most recent first (Finnhub returns newest-first already, but be safe).
  return raw
    .slice()
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, limit)
    .map((n, i) => {
      const publishedAt = n.datetime
        ? new Date(n.datetime * 1000).toISOString()
        : new Date().toISOString();
      return {
        id: n.id ? String(n.id) : `${symbol}-${i}`,
        source: (n.source ?? "").toUpperCase() || "FINNHUB",
        title: n.headline ?? "",
        url: n.url ?? "",
        publishedAt,
        relativeTime: relativeTimeFrom(publishedAt),
      };
    });
}

function relativeTimeFrom(iso: string): string {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function setCors(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  };
}
