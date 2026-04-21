# Landing page screenshots

Drop 4 PNG files here — the landing page references them by these exact filenames.

| Filename | What to capture |
|---|---|
| `overview.png` | The **Overview** page (`/app`) of the demo account — shows the big portfolio value, KPIs, top holdings list, recent transactions. |
| `holdings.png` | The **Holdings** page (`/app/holdings`) — full positions table with ticker, qty, P/L. |
| `dividends.png` | The **Dividends** page (`/app/dividends`) — monthly bar chart + top payers list. |
| `allocation.png` | The **Allocation** page (`/app/allocation`) — three donut charts. |

## How to capture them

1. Log in as `demo@finlink.dev` (it has the mock portfolio pre-loaded).
2. Use **light mode** (click the sun icon in the sidebar) — the landing page is light by default, so dark-mode screenshots would feel out of place on the marketing site.
3. Make your browser window ~1400px wide. Zoom at 100%.
4. On each page:
   - Scroll to the top.
   - **macOS**: `Cmd + Shift + 4`, drag the region that shows just the main content area (not the sidebar — or include it, your call). Or use `Cmd + Shift + 4` → `Space` → click window.
   - **Better**: Chrome DevTools → `Cmd + Shift + P` → type "screenshot" → pick "Capture full size screenshot" (gets the whole page including scroll).
5. Save as PNG with the exact filename above.
6. Drop the PNGs into this folder.
7. Commit + push — Vercel redeploys automatically.

## What the landing page does with them

- `overview.png` is the big hero image below the CTAs.
- `holdings.png` / `dividends.png` / `allocation.png` fill the three Showcase rows further down the page (alternating left/right).

Until these files exist, the landing page will show a gray placeholder with a "Screenshot needed" hint so you know what's missing.

## Tips for a polished look

- Crop any scrollbars before saving.
- If a screenshot has a lot of empty space at the bottom, crop it tight — the landing page already has plenty of whitespace.
- Retina: 2x screenshots look sharper. Optional but worth it.
