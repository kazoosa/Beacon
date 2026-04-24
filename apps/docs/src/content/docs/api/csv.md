---
title: CSV import endpoints
description: Auto-detect, preview, and import CSV files from supported brokers.
sidebar:
  order: 4
---

All require `Authorization: Bearer <accessToken>`.

## `GET /api/csv/brokers`

List supported brokers + their human labels.

**Response 200**:

```json
{
  "brokers": [
    { "id": "fidelity", "label": "Fidelity" },
    { "id": "schwab", "label": "Charles Schwab" },
    { "id": "vanguard", "label": "Vanguard" },
    { "id": "robinhood", "label": "Robinhood" },
    { "id": "td_ameritrade", "label": "TD Ameritrade" },
    { "id": "webull", "label": "Webull" },
    { "id": "ibkr", "label": "Interactive Brokers" }
  ]
}
```

## `POST /api/csv/detect`

Detect broker + kind from a CSV body. Used by the dashboard's import
flow before showing the preview.

**Request body**:

```json
{ "csv": "Account Number,Account Name,Symbol,..." }
```

**Response 200**:

```json
{
  "broker": "fidelity",
  "broker_label": "Fidelity",
  "kind": "positions"
}
```

`kind` is `"positions"` or `"activity"`.

**Response 400** when no broker matches:

```json
{
  "error_type": "VALIDATION_ERROR",
  "error_code": "BROKER_NOT_DETECTED",
  "error_message": "Couldn't detect broker from this CSV..."
}
```

## `POST /api/csv/preview`

Parse a CSV and return the structured preview without writing to
the DB.

**Request body**:

```json
{
  "csv": "...",
  "broker": "fidelity"  // optional; falls back to detect
}
```

**Response 200** (positions):

```json
{
  "kind": "positions",
  "broker": "fidelity",
  "broker_label": "Fidelity",
  "accounts": [
    {
      "accountName": "Individual - TOD",
      "accountMask": "1234",
      "positions": [
        {
          "ticker": "AAPL",
          "name": "Apple Inc.",
          "quantity": 50,
          "price": 178.45,
          "avgCost": 145.20,
          "type": "Margin",
          "option": null
        },
        ...
      ]
    }
  ],
  "total_accounts": 4,
  "total_holdings": 47
}
```

**Response 200** (activity):

```json
{
  "kind": "activity",
  "broker": "fidelity",
  "broker_label": "Fidelity",
  "total_transactions": 156,
  "activities": [
    {
      "accountNumber": "X12345",
      "accountName": "Brokerage",
      "runDate": "2026-04-15T00:00:00.000Z",
      "action": "DIVIDEND RECEIVED",
      "type": "dividend",
      "ticker": "AAPL",
      "description": "AAPL DIVIDEND",
      "quantity": 0,
      "price": 0,
      "amount": 12.00,
      "fees": 0
    },
    ...
  ]
}
```

## `POST /api/csv/import`

Parse + write to DB.

**Request body**: same as preview.

**Response 200** (positions):

```json
{
  "itemId": "...",
  "accounts": 4,
  "holdings": 47,
  "transactions": 0,
  "dividends": 0,
  "kind": "positions",
  "broker": "fidelity",
  "broker_label": "Fidelity"
}
```

**Response 200** (activity):

```json
{
  "itemId": "...",
  "accounts": 1,
  "holdings": 12,        // derived from the activity replay
  "transactions": 134,
  "dividends": 22,
  "kind": "activity",
  "broker": "fidelity",
  "broker_label": "Fidelity"
}
```

**Errors**:

- 400 with `BROKER_REQUIRED` if `broker` was omitted and detect failed
- 400 with the misleading-but-accurate "duplicate rows for accountId,
  securityId" if a P2002 collision sneaks past the merge step (should
  not happen in practice; file a bug if observed). See
  [Runbook: CSV import errors](/runbooks/csv-errors/).
- 5xx for unexpected failures; the route handler also has a guard
  against double-firing the response if a downstream side effect
  throws after the JSON was already sent.

## Idempotence

Running the same import twice is safe:

- **Positions**: `upsert` keyed on `(accountId, securityId)` — second
  run overwrites with the same values
- **Activity**: deterministic external ID per row
  (`csv_${developerId}_${broker}_${runDateKey}_${actionKey}_${ticker}_${amount}_${i}`)
  unique-constrained as `snaptradeOrderId` in the InvestmentTransaction
  table

Re-importing the same activity CSV produces the same counts and
doesn't duplicate.
