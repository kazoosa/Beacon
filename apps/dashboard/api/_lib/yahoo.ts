/**
 * Live market data via Stooq.
 *
 * We originally tried to proxy yahoo-finance2 from Vercel, but Yahoo's
 * quote endpoints rate-limit Vercel's datacenter IPs aggressively
 * even with a valid cookie+crumb handshake — known problem for any
 * cloud-hosted scraper. Stooq ships free, auth-less CSV endpoints
 * that are happy to serve from datacenters, which is all we need for
 * quote + OHLCV history. No news feed on Stooq, so that endpoint
 * returns an empty list (the UI already handles that gracefully).
 *
 * File is still called `yahoo.ts` to minimize the blast radius on the
 * serverless handlers that import it.
 */

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
  // Light quote endpoint — just the last trade.
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
  const high = parseFloat(data[idx("high")]);
  const low = parseFloat(data[idx("low")]);
  const close = parseFloat(data[idx("close")]);
  const volume = parseInt(data[idx("volume")], 10);

  if (!Number.isFinite(close) || close === 0) {
    lastError = `stooq quote: invalid close (${data[idx("close")]})`;
    return null;
  }

  // Stooq's single-row endpoint doesn't carry previous-close directly.
  // Use open as a cheap proxy for intraday change so the UI has a
  // non-zero delta to render; the 52w high/low / market cap / sector /
  // etc. fields are left null and the UI degrades gracefully.
  const prev = Number.isFinite(open) && open > 0 ? open : close;
  const change = close - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  void high;
  void low;

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
 * News is intentionally not fetched — Stooq doesn't serve news, and
 * the free Yahoo news endpoint is 429'd from Vercel. The UI handles
 * empty arrays gracefully with an empty-state message.
 */
export async function fetchNews(
  symbol: string,
  _limit = 10,
): Promise<NewsItem[]> {
  void symbol;
  void _limit;
  return [];
}

export function setCors(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  };
}
