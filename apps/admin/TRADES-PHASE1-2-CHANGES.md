# Trades — Phase 1 & 2 change log

Turns advisor **market posts** into **trades with a lifecycle** (entry range,
exchange, horizon, status, conviction, a timeline of updates, and chart images).
Modeled on the reference "Trades" screens.

Date: 2026-07-24 · Status: implemented, not yet committed/pushed.

---

## Revert plan (in case we back this out)

1. **DB** — run the rollback (destructive; drops the new tables/columns):
   ```powershell
   $env:DATABASE_URL = ((Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim('"')
   npx prisma db execute --file scripts/sql/trades-phase1-2-rollback.sql
   ```
2. **Schema** — revert the `prisma/schema.prisma` block (3 enums, MarketPost
   fields, `MarketPostUpdate` + `MarketPostImage` models), then `npx prisma generate`.
3. **Code** — delete the new files and revert the edited ones (lists below).

Because everything is additive and the new columns are nullable / defaulted,
leaving the migration applied but reverting the UI is also safe.

---

## 🔌 API / external-dependency flags

- **CMP (live price) + Realized P&L — NOT built.** These need AngelOne LTP, which
  is currently down (missing env vars — see `KNOWN-ISSUES.md`). The trade card and
  detail intentionally omit CMP and P&L until AngelOne is configured. When it is,
  the natural follow-up is:
  - show CMP in the trade grid,
  - auto-transition `awaiting_entry → active` when CMP enters the entry range,
  - auto-fire `target_hit` / `sl_hit`.
- **Advisor rating (e.g. "4.9 · 1.2K")** — NOT built. No rating system exists
  (only `CourseReview`). Deferred (Phase 3).
- **Subscription "plans" ("Included in Commodity Plan")** — NOT built. `Subscription`
  is a flat amount with no plan/tier concept. Deferred (Phase 3).
- **Uploads** — chart images reuse the existing `/api/v1/uploads/social` endpoint
  (local filesystem under `public/uploads/`). No new upload infra; same caveat as
  other uploads (won't persist on ephemeral/serverless hosting).

---

## New files

- `prisma/schema.prisma` … (edited) enums + fields + 2 models
- `scripts/sql/trades-phase1-2-migration.sql` — APPLIED to DB
- `scripts/sql/trades-phase1-2-rollback.sql` — revert script
- `lib/trades.ts` — status/timeframe/update-kind constants + helpers
  (side, potential-return, formatting)
- `components/trades/trade-panel.tsx` — shared trade summary (feed + detail)
- `app/api/v1/advisor/posts/[id]/updates/route.ts` — timeline GET/POST (+ status move)
- `app/advisor/(shell)/posts/[id]/trade-update-panel.tsx` — advisor "Update Trade" UI
- `app/globals.css` … (edited) `.trade-panel*`, `.trade-timeline*` styles

## Edited files

- `app/api/v1/advisor/posts/route.ts` — accepts exchange, entry range, timeframeType,
  conviction, imageUrls; seeds the "Trade Published" timeline entry
- `app/advisor/(shell)/posts/new/page.tsx` — composer: exchange dropdown, horizon
  select, entry range, conviction stars, chart-image upload
- `app/advisor/(shell)/posts/[id]/page.tsx` — renders `TradeUpdatePanel`
- `lib/market-feed-serialize.ts` — coerces trade Decimals → numbers for the client
- `components/feed/FeedClient.tsx` — `FeedPost` type + renders `TradePanel`
- `app/user/markets/[id]/page.tsx` — trade panel, chart gallery, Trade Timeline,
  Similar Trades

---

## Data model added (`market_posts`)

| Column            | Type                 | Notes                                                            |
| ----------------- | -------------------- | ---------------------------------------------------------------- |
| `timeframe_type`  | enum trade_timeframe | intraday / short_term / medium_term / long_term                  |
| `exchange`        | varchar(20)          | NSE / BSE / MCX / NFO / CDS                                      |
| `entry_price_min` | decimal(18,4)        | entry range low                                                  |
| `entry_price_max` | decimal(18,4)        | entry range high                                                 |
| `trade_status`    | enum trade_status    | awaiting_entry (default) / active / target_hit / sl_hit / closed |
| `conviction`      | int                  | 1–5 stars                                                        |

New tables: `market_post_updates` (timeline), `market_post_images` (charts).
Legacy free-text `timeframe` column is kept for back-compat.

## Status transitions (server-enforced)

Logging a timeline update of a given kind also moves the trade:
`entry_triggered → active`, `target_hit → target_hit`, `sl_hit → sl_hit`,
`closed → closed`. `sl_moved` / `note` are timeline-only.

## Premium / locked-trade experience (added after Phase 1/2)

For paid posts the user hasn't unlocked/subscribed to:

- **Feed card** shows a _teaser_: BUY/SELL, symbol, status pill, and **Potential
  Upside %** — but the Entry/SL/Target grid is blurred with an inline Unlock button.
- **Detail page** (`app/user/markets/[id]/page.tsx`) renders `PremiumTradeGate`:
  upside teaser → "This is a premium trade post" + Unlock (₹price) → "Already a
  subscriber? Login" (guests) → feature checklist → subscribe card.
- **Subscribe card is honest**: real active-subscriber count (`Subscription`
  count) + real plan price (`SUB_PLANS.monthly` ₹299). Reuses the existing
  `SubscribePlansModal` + `/api/v1/advisor/[id]/subscribe`.

### Security note

The raw entry/SL/target are **withheld from locked clients**. `market-feed-serialize.ts`
nulls those fields when `is_locked` and only exposes `potential_return_pct`
(computed server-side) + `has_trade`. The detail page computes the upside on the
server too. So the teaser % can't be reverse-engineered into the actual prices via
devtools/network.

### Deliberately NOT shown (would be fabricated)

- **Advisor rating ("4.9 ★")** — no advisor rating system exists (only
  `CourseReview`). Omitted from the subscribe card. Build a ratings feature first.
- **Accuracy %** — only `advisorMetricDaily.accuracyPct` (seeded/synthetic).
  Omitted to avoid presenting fake stats as real.
- **Per-advisor named plans ("Commodity Plan")** — plans are global monthly/yearly
  (`SUB_PLANS`), not per-advisor tiers. Card links to the real subscribe flow and
  is labelled by advisor name instead.

New files: `components/trades/premium-trade-gate.tsx`.
Edited: `components/trades/trade-panel.tsx` (locked mode),
`lib/market-feed-serialize.ts` (withhold prices + upside),
`components/feed/FeedClient.tsx`, `app/user/markets/[id]/page.tsx`,
`app/globals.css` (`.trade-panel-locked`, `.trade-locked-*`, `.trade-unlock-btn`).

## Phase 3 — completing the trades section (2026-07-25)

Closes the PRD gaps that don't need the two blockers. Applied to DB.

### DB (migration `trades-phase3-migration.sql`, rollback `trades-phase3-rollback.sql`)

- `trade_status` += `draft`, `cancelled`, `exited`
- `asset_type` += `futures`, `options`, `currency`
- `trade_update_kind` += `partial_booked`, `exited`, `cancelled`
- new enum `trade_entry_type` (market/exact/range)
- `market_posts` += `entry_type`, `exit_price`, `exit_reason`, `exit_return_pct`, `closed_at`
- NOTE: Postgres can't drop enum values, so a rollback leaves the new enum
  members in place (harmless); only columns + `trade_entry_type` are dropped.

### Features shipped

- **Dedicated Trades section** `app/user/trades/page.tsx` + `components/trades/trades-client.tsx`
  (asset tabs, quick chips Open/Target Hit/Free/Premium, filter panel, locked
  teasers). Nav item "Trades" added (sidebar + mobile). **Feed now excludes
  trades** (posts with entry/target/SL) — normal analysis posts only, per PRD.
- **Composer** (`posts/new`): BUY/SELL recommendation, Entry Type (Market/Exact/
  Range), Stocks/Futures/Options/Currency asset classes, **Save Draft**.
- **Draft lifecycle**: `saveDraft` in create API → `tradeStatus:'draft'`,
  unpublished, only visible to author, no timeline seed.
- **Exit / Cancel flow**: advisor Update panel adds "Exit Trade" (exit price +
  reason → realised return computed) and "Cancel Trade"; API sets
  `exit_price/exit_reason/exit_return_pct/closed_at` and moves status.
- **Auto calcs (no live price)**: Risk-Reward ratio + realised exit return on the
  trade panel; Days Active + Exit @ / Realised % on the detail.
- **Analyst performance** on the advisor profile: Win Rate, Total/Winning/Losing/
  Open/Cancelled trades, Avg Return. Cancelled/drafts excluded from win rate.
  Replaces the old synthetic "Accuracy" tile with a real Win Rate.
- **GST**: paid-trade unlock price shows `₹base + 18% GST = ₹total`.
- Helpers in `lib/trades.ts`: `riskRewardRatio`, `potentialLossPct`, `daysActive`,
  `exitReturnPct`, `withGst`, `computeAnalystPerformance`.

### ⚠️ Still deferred (need a blocker)

- **CMP (live price)** and everything that depends on it: auto status transitions
  (awaiting→active when price enters entry zone, auto target/SL hit), current
  price on the card, symbol live-search/exchange-auto-detect. → needs AngelOne
  (down; see KNOWN-ISSUES.md). Status changes are **manual** via the Update panel.
- **Subscriber Broadcast / "publish to a service"** and per-analyst subscription
  services (Equity/Commodity/Options plans). → needs a Subscription-Services model.
  Trades currently publish to Public (marketplace) or all-subscribers only.
- **Preview button**, rich-text thesis editor, publishing a saved draft from the
  UI (draft is stored but there's no "Publish draft" button yet).

## Known behavioural note

Trades require advisors to _maintain_ them. A trade that never gets an update
stays on **Awaiting Entry**. The advisor "Update Trade" panel makes this one click;
full automation waits on live prices (AngelOne).
