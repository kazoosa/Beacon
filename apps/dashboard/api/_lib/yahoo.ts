/**
 * Minimal Yahoo Finance helpers for the Vercel serverless proxy.
 *
 * yahoo-finance2 pulls in cookies + crumb tokens which are finicky
 * inside Vercel cold starts. These helpers hit Yahoo's JSON endpoints
 * directly with a realistic User-Agent — works for quote, history,
 * and news without any auth plumbing.
 *
 * All functions return the shape the frontend expects. Errors are
 * caught and returned as `null` / `[]` so the caller can decide
 * whether to 404 or return a DB-fallback payload.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function yfetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Vercel default fetch, no extra options
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

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

export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  // quoteSummary returns everything in one hit
  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=price,summaryDetail,assetProfile,defaultKeyStatistics`;
  type Resp = {
    quoteSummary?: {
      result?: Array<{
        price?: {
          regularMarketPrice?: { raw?: number };
          regularMarketPreviousClose?: { raw?: number };
          regularMarketChange?: { raw?: number };
          regularMarketChangePercent?: { raw?: number };
          longName?: string;
          shortName?: string;
          symbol?: string;
          exchangeName?: string;
          currency?: string;
          marketCap?: { raw?: number };
          regularMarketVolume?: { raw?: number };
        };
        summaryDetail?: {
          dividendYield?: { raw?: number };
          beta?: { raw?: number };
          fiftyTwoWeekHigh?: { raw?: number };
          fiftyTwoWeekLow?: { raw?: number };
          averageDailyVolume3Month?: { raw?: number };
          trailingPE?: { raw?: number };
        };
        assetProfile?: {
          sector?: string;
          website?: string;
        };
      }>;
    };
  };
  const json = await yfetch<Resp>(url);
  const result = json?.quoteSummary?.result?.[0];
  if (!result?.price) return null;

  const price = result.price.regularMarketPrice?.raw ?? 0;
  const prev = result.price.regularMarketPreviousClose?.raw ?? price;
  const change = result.price.regularMarketChange?.raw ?? price - prev;
  const changePct =
    result.price.regularMarketChangePercent?.raw !== undefined
      ? (result.price.regularMarketChangePercent.raw ?? 0) * 100
      : prev
      ? ((price - prev) / prev) * 100
      : 0;

  const logoUrl = makeLogoUrl(result.assetProfile?.website);

  return {
    symbol: result.price.symbol ?? symbol,
    name: result.price.longName ?? result.price.shortName ?? symbol,
    exchange: result.price.exchangeName ?? null,
    currency: result.price.currency ?? "USD",
    price,
    previousClose: prev,
    change,
    changePct,
    marketCap: result.price.marketCap?.raw ?? null,
    peRatio: result.summaryDetail?.trailingPE?.raw ?? null,
    fiftyTwoWeekHigh: result.summaryDetail?.fiftyTwoWeekHigh?.raw ?? null,
    fiftyTwoWeekLow: result.summaryDetail?.fiftyTwoWeekLow?.raw ?? null,
    volume: result.price.regularMarketVolume?.raw ?? null,
    avgVolume: result.summaryDetail?.averageDailyVolume3Month?.raw ?? null,
    dividendYieldPct:
      result.summaryDetail?.dividendYield?.raw !== undefined
        ? (result.summaryDetail.dividendYield.raw ?? 0) * 100
        : null,
    beta: result.summaryDetail?.beta?.raw ?? null,
    sector: result.assetProfile?.sector ?? null,
    logoUrl,
    isFallback: false,
    asOf: new Date().toISOString(),
  };
}

function makeLogoUrl(website?: string): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return `https://logo.clearbit.com/${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
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

function rangeToParams(range: HistoryRange): { interval: string; range: string } {
  switch (range) {
    case "1d":  return { interval: "5m",  range: "1d"  };
    case "5d":  return { interval: "15m", range: "5d"  };
    case "1mo": return { interval: "1d",  range: "1mo" };
    case "3mo": return { interval: "1d",  range: "3mo" };
    case "1y":  return { interval: "1d",  range: "1y"  };
    case "max": return { interval: "1wk", range: "max" };
  }
}

export async function fetchHistory(
  symbol: string,
  range: HistoryRange,
): Promise<StockHistory> {
  const { interval, range: r } = rangeToParams(range);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&range=${r}&includePrePost=false`;
  type Resp = {
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
  const json = await yfetch<Resp>(url);
  const result = json?.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  if (!q || ts.length === 0) {
    return { symbol, range, candles: [], isFallback: true };
  }
  const candles: StockCandle[] = ts.map((t, i) => ({
    time: new Date(t * 1000).toISOString(),
    open: q.open?.[i] ?? null,
    high: q.high?.[i] ?? null,
    low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? null,
    volume: q.volume?.[i] ?? null,
  }));
  return {
    symbol,
    range,
    candles: candles.filter((c) => c.close !== null),
    isFallback: false,
  };
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  relativeTime: string;
}

export async function fetchNews(symbol: string, limit = 10): Promise<NewsItem[]> {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}` +
    `&quotesCount=0&newsCount=${limit}`;
  type Resp = {
    news?: Array<{
      uuid?: string;
      title?: string;
      link?: string;
      publisher?: string;
      providerPublishTime?: number;
    }>;
  };
  const json = await yfetch<Resp>(url);
  const items = json?.news ?? [];
  return items.slice(0, limit).map((n, i) => {
    const publishedAt = n.providerPublishTime
      ? new Date(n.providerPublishTime * 1000).toISOString()
      : new Date().toISOString();
    return {
      id: n.uuid ?? `${symbol}-${i}`,
      source: (n.publisher ?? "YAHOO").toUpperCase(),
      title: n.title ?? "",
      url: n.link ?? "",
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

/** CORS helper — set on every serverless response. */
export function setCors(headers: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  };
}
