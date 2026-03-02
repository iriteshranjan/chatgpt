# Stock Directory Website (A–Z)

This project provides a local website to browse stock/company names from **A to Z** and view latest prices from both **NSE** and **BSE**.

## What it does

- Fetches and aggregates stock data for all letters `A` to `Z` from CNBC TV18 companies API.
- Stores the aggregated A–Z stock directory in `data/stocks-by-letter.json` on the server.
- Shows a UI directory where each letter lists stocks.
- On stock click, uses `moneycontrolCompanyCode` to fetch latest prices from both NSE and BSE.

## Run

```bash
node server.js
```

Then open: <http://localhost:8000>

## API endpoints served locally

- `GET /api/stocks` → returns cached A–Z stock directory.
- `GET /api/stocks?refresh=1` → refreshes from remote and overwrites local cache.
- `GET /api/price?id=<moneycontrolCompanyCode>` → returns latest NSE + BSE payloads.
