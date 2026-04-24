---
title: Portfolio endpoints
description: Holdings, transactions, dividends, allocation, and per-symbol detail.
sidebar:
  order: 2
---

All endpoints require `Authorization: Bearer <accessToken>`. Responses
are scoped to the authenticated developer.

## `GET /api/portfolio/summary`

Net worth tile data for the Overview page.

**Response 200**:

```json
{
  "total_value": 123456.78,
  "cost_basis": 100000.00,
  "unrealized_pl": 23456.78,
  "unrealized_pl_pct": 23.46,
  "day_change": -245.67,
  "day_change_pct": -0.20,
  "connected_count": 3,
  "holdings_count": 47,
  "tx_count_30d": 12,
  "ytd_dividends": 1234.56
}
```

`day_change` is a deterministic sine-wave-ish derivation from
`total_value` (placeholder until we have real previous-close data per
holding); it's intentionally not flaky-zero.

## `GET /api/portfolio/holdings`

Consolidated holdings across all the user's brokerages.

**Response 200**:

```json
{
  "holdings": [
    {
      "ticker_symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "equity",
      "exchange": "NASDAQ",
      "quantity": 50,
      "avg_cost": 145.20,
      "close_price": 178.45,
      "market_value": 8922.50,
      "cost_basis": 7260.00,
      "unrealized_pl": 1662.50,
      "unrealized_pl_pct": 22.90,
      "weight_pct": 7.23,
      "option": null,
      "locations": [
        {
          "institution": "Charles Schwab",
          "institution_color": "#00a0e0",
          "account_name": "Brokerage",
          "quantity": 30,
          "value": 5353.50
        },
        ...
      ]
    },
    {
      "ticker_symbol": "AAPL  260117C00200000",
      "name": "AAPL Jan 17 2026 $200 Call",
      "type": "option",
      "quantity": 1,
      "avg_cost": 8.50,
      "close_price": 9.45,
      "market_value": 945.00,
      "cost_basis": 850.00,
      "unrealized_pl": 95.00,
      "weight_pct": 0.77,
      "option": {
        "underlying_ticker": "AAPL",
        "option_type": "call",
        "strike": 200,
        "expiry": "2026-01-17",
        "multiplier": 100,
        "days_to_expiry": 268
      },
      "locations": [...]
    }
  ],
  "total_value": 123456.78
}
```

**Notes**:
- `option` is non-null when `type === "option"`. UI uses this as the
  signal to render an OptionRow instead of the equity row.
- `locations` lists every brokerage account the user holds this
  security in. Used for the expand-row detail.
- `total_value` includes the [cash sleeve](/epics/cash-sleeve/).
  The synthetic CASH row (when present) uses `ticker_symbol: "CASH"`
  + `type: "cash"`.

## `GET /api/portfolio/transactions`

Paginated transaction history.

**Query params**:
- `type` — filter by ActivityType. `dividend` matches both `dividend`
  and `dividend_reinvested` for filter-parity with the Dividends page.
- `ticker` — filter by ticker symbol (case-insensitive).
- `count` — page size, default 100, max 500.
- `offset` — pagination offset.

**Response 200**:

```json
{
  "transactions": [
    {
      "id": "...",
      "date": "2026-04-15",
      "type": "dividend",
      "ticker_symbol": "AAPL",
      "security_name": "Apple Inc.",
      "quantity": 0,
      "price": 0,
      "amount": 12.00,
      "fees": 0,
      "institution": "Charles Schwab",
      "institution_color": "#00a0e0",
      "account_name": "Brokerage"
    },
    ...
  ],
  "total": 247
}
```

`total` is the count BEFORE pagination but AFTER filters.

## `GET /api/portfolio/dividends`

Aggregated dividend reporting.

**Response 200**:

```json
{
  "by_month": [
    { "month": "2025-05", "amount": 123.45 },
    ...
  ],
  "by_ticker": [
    {
      "ticker_symbol": "JEPI",
      "name": "JPMorgan Equity Premium Income ETF",
      "total": 456.78,
      "payments": 6
    },
    ...
  ],
  "ytd_total": 1234.56,
  "lifetime_total": 4567.89
}
```

Includes both `dividend` and `dividend_reinvested` types via the
shared `DIVIDEND_INCOME_TYPES` constant. See
[Architecture → Activity classifier](/architecture/activity-classifier/).

## `GET /api/portfolio/allocation`

Pies for the Allocation page.

**Query params**:
- `rollupOptions=true|false` — default `true`. When `true`, options
  contribute delta-equivalent share value to the underlying ticker
  (rolls up). When `false`, options keep their own ticker slice
  valued at premium × multiplier × contracts.

**Response 200**:

```json
{
  "by_ticker": [
    { "label": "AAPL", "value": 8922.50, "weight_pct": 7.23, "color": "#..." },
    ...
  ],
  "by_institution": [
    { "label": "Charles Schwab", "value": 67890.12, "weight_pct": 55.00, "color": "#..." },
    ...
  ],
  "by_type": [
    { "label": "equity", "value": 80000.00, "weight_pct": 64.81, "color": "#..." },
    { "label": "etf", "value": 25000.00, "weight_pct": 20.25, "color": "#..." },
    { "label": "cash", "value": 10000.00, "weight_pct": 8.10, "color": "#..." },
    { "label": "option", "value": 8456.78, "weight_pct": 6.85, "color": "#..." }
  ],
  "total_value": 123456.78,
  "rollup_options": true
}
```

When `rollup_options: true`, the `option` slice in `by_type` is
absent because options are folded into their underlying.

## `GET /api/portfolio/by-symbol/:symbol`

Per-symbol portfolio detail. Used by StockDetail.

**Path param**: `:symbol` — ticker (case-insensitive). For options,
the canonical OCC symbol (URL-encoded, padded form).

**Response 200**:

```json
{
  "symbol": "AAPL",
  "securityId": "...",
  "securityName": "Apple Inc.",
  "exchange": "NASDAQ",
  "closePrice": 178.45,
  "empty": false,
  "option": null,
  "position": {
    "sharesHeld": 50,
    "avgCostPerShare": 145.20,
    "marketValue": 8922.50,
    "costBasis": 7260.00,
    "unrealizedPl": 1662.50,
    "unrealizedPlPct": 22.90,
    "openLotsCount": 2
  },
  "realized": {
    "lifetime": 234.56,
    "ytd": 100.00,
    "closedLotsCount": 3,
    "avgHoldDays": 178,
    "byMonth": [...]
  },
  "lots": {
    "open": [...],
    "closed": [...]
  },
  "winStats": {...},
  "portfolioWeight": {...},
  "dividends": {...},
  "heldIn": [...],
  "activity": [...]
}
```

For an option symbol, the response also includes:

```json
{
  "option": {
    "underlying_ticker": "AAPL",
    "underlying_name": "Apple Inc.",
    "underlying_price": 178.45,
    "option_type": "call",
    "strike": 200,
    "expiry": "2026-01-17",
    "multiplier": 100,
    "days_to_expiry": 268,
    "intrinsic_per_contract": 0,
    "intrinsic_total": 0,
    "extrinsic_total": 945.00,
    "delta": 0.42,
    "gamma": 0.011,
    "theta": -0.045,
    "vega": 0.32,
    "iv": 0.28,
    "greeks_as_of": "2026-04-25T15:30:00.000Z"
  }
}
```

When the symbol isn't recognized (no Security row exists for it), the
response is `{ symbol, securityId: null, securityName: <symbol>, empty: true }` —
the dashboard still renders a market-only view from the quote
endpoints.

## `GET /api/portfolio/accounts`

Connected brokerage accounts.

**Response 200**:

```json
{
  "accounts": [
    {
      "id": "...",
      "name": "Brokerage",
      "mask": "1234",
      "type": "investment",
      "subtype": "brokerage",
      "current_balance": 12345.67,
      "institution": "Charles Schwab",
      "institution_color": "#00a0e0",
      "institution_id": "ins_charles_schwab",
      "item_id": "...",
      "iso_currency_code": "USD"
    }
  ]
}
```

## `DELETE /api/portfolio/accounts/:itemId`

Disconnect a brokerage. Cascades to all sub-accounts/holdings/
transactions. For SnapTrade-backed Items also revokes the SnapTrade
authorization upstream.

**Response 200**: `{ "removed": true }`.

**Errors**: 404 if the Item doesn't belong to the authenticated
developer.

## `POST /api/portfolio/wipe-demo`

Clears all CSV-sourced (mock) Items for the user. SnapTrade
connections are NOT touched. Used by the dev "Clear sample data"
button in the dashboard footer.

**Response 200**: `{ "removed": <count> }`.
