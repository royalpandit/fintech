# Hidden features

Things that are built and working but deliberately not reachable from the UI.

Nothing here is deleted. Every route still builds, every API still responds, and
every one of these can be brought back by uncommenting the lines listed under
it. That is the point of the convention: hiding a feature should cost one line
to undo, not a re-implementation.

Two things are worth knowing before you use this file:

- **Hidden ≠ disabled.** A hidden page is still served if you type the URL, and
  its API routes still answer authenticated requests. If something must be
  genuinely unavailable, hiding it from the nav is not enough — it needs an
  auth or feature check as well.
- **Restore every line for a feature, not just the nav entry.** Most of these
  are commented in two or three places (the module list, the sidebar group, and
  the route map). Restoring one and missing another usually produces a link that
  renders but goes nowhere.

Line numbers were accurate when written; search for the quoted text if they have
drifted.

---

## Competition

Prediction contests: weekly index picks, stock-vs-stock, IPO prediction.

Hidden from all three panels. Six competitions exist in the database, all with
status `completed`, and most look like test data (`Test`, `Testing Super-admin`,
`Sample 1 VS Sample 2`).

| Panel | File | Lines |
|---|---|---|
| Investor sidebar | `components/user-shell.tsx` | 89 |
| Investor bottom bar (mobile) | `components/user-shell.tsx` | 105 |
| Advisor module list | `lib/advisor-nav.ts` | 18 |
| Advisor sidebar group | `lib/advisor-nav.ts` | 44 |
| Super-admin module list | `lib/super-admin.ts` | 19 |
| Super-admin route map | `lib/super-admin.ts` | 43 |
| Super-admin sidebar group | `lib/super-admin.ts` | 63 |

Still live by URL: `/user/competition`, `/advisor/competition`,
`/super-admin/competition/list`. All of `components/competition/*`, the
`/api/v1/competitions` routes, and the `competitions` cron job are untouched —
the cron still sweeps competition statuses every 15 minutes.

## Virtual Trading (paper trading)

Hidden from the investor and advisor navs.

| Panel | File | Lines |
|---|---|---|
| Investor sidebar | `components/user-shell.tsx` | 93 |
| Advisor module list | `lib/advisor-nav.ts` | 12 |
| Advisor sidebar group | `lib/advisor-nav.ts` | 42 |

Still live by URL: `/user/virtual-trading`, `/advisor/paper`.

**The engine is not hidden and is still in active use.** Buy/Sell buttons across
Markets, the Watchlist and Mutual Funds place real paper orders through
`lib/paper-order-engine.ts`. Hiding the page removed the full order form, not
the ability to trade. Paper holdings still appear on the Portfolio page via
`components/paper/paper-portfolio-section.tsx`.

## Wallet

Hidden from the investor nav, along with everything that displayed the virtual
cash balance — a balance you cannot see or top up is worse than no balance at
all.

| What | File | Lines |
|---|---|---|
| Investor sidebar | `components/user-shell.tsx` | 94 |
| "Buying Power" KPI card | `app/user/home/page.tsx` | 476–510 |
| Wallet balance read | `app/user/home/page.tsx` | 92 |
| "Cash" card in paper portfolio | `components/paper/paper-portfolio-section.tsx` | 136 |
| "Set up paper wallet" CTA | `components/paper/paper-portfolio-section.tsx` | 53 |
| Wallet link in paper section | `components/paper/paper-portfolio-section.tsx` | 120 |

Still live by URL: `/user/wallet`.

Note the KPI row's CSS class changes with the card count — `user-stat-grid` vs
`user-stat-grid-5`. Restore the class and the card together or the grid will be
one column short.

## Markets tabs: Crypto, Currencies, Global

All in `components/trading/markets-overview.tsx`. Four places each:

| What | Lines |
|---|---|
| Imports | 9, 10, 13 |
| `MarketTab` union members | 65–67 |
| `TABS` entries | 85–87 |
| Render lines | 229, 230, 240 |

Uncomment the union member as well as the tab: with the member commented,
`tab === "crypto"` is a type error, so TypeScript will point at any render line
you missed.

Untouched and still working: `/api/v1/market/crypto`, `/crypto/stream`,
`/api/v1/market/currencies`, `lib/global-indices.ts`, `lib/forex.ts`. They cost
nothing while the tabs are hidden — the polling and the crypto SSE stream only
run while their component is mounted.

Markets now shows: All · Stocks & Indices · Mutual Funds · ETFs · Commodities · IPO.

## Stock Basket / AI Stock Picks — retired

Not hidden pending a decision; **superseded by Finuer Basket**. Treat this as
removed rather than paused.

| What | File | Lines |
|---|---|---|
| Investor sidebar | `components/user-shell.tsx` | 85 |
| Dashboard section + import | `app/user/home/page.tsx` | 8, 316 |
| Super-admin module list | `lib/super-admin.ts` | 16 |
| Super-admin route map | `lib/super-admin.ts` | 41 |

The API routes under `/api/v1/stock-picks/*` and
`/api/v1/admin/stock-pick-groups/*` are stubbed: each returns a "retired" response
with its original implementation kept underneath in a comment block.

---

## Removed, not hidden

One entry, listed separately because it is **not** coming back and should not be
restored by uncommenting anything.

### Fabricated holdings on the investor dashboard

`app/user/home/page.tsx` used to render four invented positions whenever the
user held nothing — 50 AAPL, 100 RELIANCE, 75 TCS, 80 HDFCBANK — with made-up
average prices, cost basis and a green `+12.87%` gain, under a comment reading
*"Fallback rows so the screen is never empty"*.

On an investor dashboard that is indistinguishable from a real portfolio. It has
been replaced with an empty state pointing at broker connection. The code is
gone rather than commented, deliberately: nobody should be able to restore
fabricated positions with a keystroke.

### Still fabricated elsewhere on the same page — not yet addressed

Two neighbours of the block above invent data the same way and are **still
live**:

- **Watchlist rows** (`app/user/home/page.tsx` ~239–270) derive a price from a
  hash of the symbol's characters — `1000 + (seed % 3000)` — and a change
  between −2% and +2%, then render them as prices. When the user has no
  watchlist it falls back to a hardcoded list (AAPL ₹169.30, RELIANCE ₹2280, …).
- **Holdings donut** (~220–235) falls back to post counts per symbol. Less
  misleading — the tooltip says "posts" — but it is still a portfolio chart
  drawn from something that is not a portfolio.

Both should get the same treatment. Flagged, not fixed.

---

## Adding to this file

When you hide something:

1. Comment, don't delete — and say in the comment where the other halves are.
2. Add a row here with the file and line of every place you commented.
3. Say what stays live by URL, and whether any cron or API keeps running.
