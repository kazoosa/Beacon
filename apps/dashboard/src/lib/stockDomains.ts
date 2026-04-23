/**
 * Ticker → company website domain, used to render a real brand logo
 * via Clearbit's public logo endpoint (`logo.clearbit.com/<domain>`).
 *
 * Stooq's free CSV doesn't return a website or logoUrl, so we ship a
 * small static lookup for the most commonly-viewed symbols. Anything
 * not in this map falls through to the initials avatar in the
 * StockHeader component — which is fine and still reads clean.
 *
 * Kept in plain TS rather than a JSON file so tree-shaking can drop
 * unused entries if we ever need to split it.
 */
export const TICKER_DOMAIN: Record<string, string> = {
  AAPL:  "apple.com",
  MSFT:  "microsoft.com",
  GOOGL: "abc.xyz",
  GOOG:  "abc.xyz",
  AMZN:  "amazon.com",
  TSLA:  "tesla.com",
  NVDA:  "nvidia.com",
  META:  "meta.com",
  NFLX:  "netflix.com",
  AMD:   "amd.com",
  INTC:  "intel.com",
  ORCL:  "oracle.com",
  IBM:   "ibm.com",
  CRM:   "salesforce.com",
  ADBE:  "adobe.com",
  CSCO:  "cisco.com",
  QCOM:  "qualcomm.com",
  AVGO:  "broadcom.com",
  TXN:   "ti.com",
  MU:    "micron.com",
  INTU:  "intuit.com",
  PYPL:  "paypal.com",
  SQ:    "squareup.com",
  SHOP:  "shopify.com",
  NOW:   "servicenow.com",
  SNOW:  "snowflake.com",
  PLTR:  "palantir.com",
  COIN:  "coinbase.com",
  UBER:  "uber.com",
  LYFT:  "lyft.com",
  SPOT:  "spotify.com",
  ABNB:  "airbnb.com",
  DASH:  "doordash.com",
  SOFI:  "sofi.com",
  DIS:   "disney.com",
  NKE:   "nike.com",
  SBUX:  "starbucks.com",
  MCD:   "mcdonalds.com",
  KO:    "coca-cola.com",
  PEP:   "pepsico.com",
  WMT:   "walmart.com",
  TGT:   "target.com",
  COST:  "costco.com",
  HD:    "homedepot.com",
  LOW:   "lowes.com",
  JPM:   "jpmorganchase.com",
  BAC:   "bankofamerica.com",
  WFC:   "wellsfargo.com",
  C:     "citi.com",
  GS:    "goldmansachs.com",
  MS:    "morganstanley.com",
  V:     "visa.com",
  MA:    "mastercard.com",
  "BRK-B": "berkshirehathaway.com",
  BRKB:  "berkshirehathaway.com",
  JNJ:   "jnj.com",
  PFE:   "pfizer.com",
  MRNA:  "modernatx.com",
  LLY:   "lilly.com",
  UNH:   "unitedhealthgroup.com",
  XOM:   "exxonmobil.com",
  CVX:   "chevron.com",
  COP:   "conocophillips.com",
  BA:    "boeing.com",
  GE:    "ge.com",
  CAT:   "caterpillar.com",
  F:     "ford.com",
  GM:    "gm.com",
  T:     "att.com",
  VZ:    "verizon.com",
  TMUS:  "t-mobile.com",
  VOO:   "vanguard.com",
  SPY:   "ssga.com",
  QQQ:   "invesco.com",
  VTI:   "vanguard.com",
  BND:   "vanguard.com",
  SCHD:  "schwab.com",
  FXAIX: "fidelity.com",
  BTC:   "bitcoin.org",
  ETH:   "ethereum.org",
};

export function logoUrlFor(symbol: string): string | null {
  const domain = TICKER_DOMAIN[symbol.toUpperCase()];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
}
