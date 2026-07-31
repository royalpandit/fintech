# Session Change Log — `feat/trades-subscriptions-messages`

All work done this session. Commits (oldest → newest):
`6b0ed4b` subscription services · `9bff94b` Trades/Services/Messages · `5b9b66d` search/watchlist/feed ·
`c2db2b2` AngelOne WS fix · `639c017` landing + advisor feed/search · `1d2505b` merge · `7d5302a` competitions/basket + Trades redesign.

Side: 👤 User (investor) · 🧑‍💼 Advisor · 🛠 Admin/Super-admin · 🌐 Shared/infra · 📣 Landing · 🚩 payment bypassed

---

## Uncommitted work-in-progress (post-`7d5302a`)

### Admin-editable permission matrix 🛠 (NEW)
- **10 professional types** (enum extended: +ARN, stock broker, finance creator, listed company, financial platform) + migration.
- `professional_capabilities` table = admin-editable matrix; `lib/capabilities-server.ts` resolves DB override → code default (cached).
- **Super-admin → Permissions** editor (`/super-admin/permissions`): pick a professional, grouped on/off **switches** by category, **presets** (Content/Distributor/Advisory/Corporate/Full), "changed from default" markers, reset-to-default. Every change audit-logged.
- `can()` (server gates + client via profile API) now reads the DB matrix, so admin edits take effect live.
- **Demo accounts** for the 5 new types (`mfd@ / broker@ / creator@ / listedco@ / platform@ finuer.local`, pw `<Type>@2025`); existing advisors typed (advisor@ & advisor2@ = `research_analyst` so trades still work, advisor3@ = RIA).

### Roles & permissions — capability layer 🧑‍💼 🛠
- New `lib/capabilities.ts` — encodes the "Roles and permissions in finuer" matrix as data (professional type → permission tier → capability) with `can()`. Single source of truth.
- **SEBI-only trade posting** enforced (per doc): create API (`/advisor/posts`), edit API (`/advisor/posts/[id]`), and the open `market/posts` route all reject Entry/Target/SL (buy-sell) from non-SEBI tiers. Composer + dashboard quick-post hide the trade fields for non-SEBI advisors.
- **Daily buy/sell cap** — 5 published trade posts per analyst per day.
- Note: RIA (`investment_advisor`, the default type) is in the non-trade tier per the doc, so default advisors can't post trades until set to `research_analyst`/`advisory_firm`.

### Advisor parity tabs 🧑‍💼
- Advisors get Markets, Watchlist, Finuer Basket, Competitions (same components as investors); `/user` layout relaxed so advisors can follow detail pages.

### Subscriptions (investor) 👤
- Search bar + Filter (status: active/expired/cancelled; type: services/advisor/one-time) on Subscriptions & Purchases.

### Fixes / UI 🛠
- Back-button double-arrow glitch fixed (competition + basket + my-predictions).
- Super-admin competition status dropdown trimmed to Draft/Upcoming/Active.
- Super-admin basket add-stock: stock search + autofill, wider modal, lighter weights.
- Advisor "My Market Posts" → "Market Posts".

### 🚩 Blocked / awaiting decision
- **Markets MF/IPO** — AngelOne has no mutual-fund/IPO data. MF feasible via AMFI (free); IPO needs a provider or an admin-curated list.
- **Remaining matrix gates** — paid subscriptions / premium unlocks / reports / polls etc. not yet gated by tier.

---

### Trades 👤
- New Trades section: structured BUY/SELL calls (entry/target/SL/return) separate from the Feed.
- Redesigned to a split view — left Filters sidebar, center list, right Featured/Top Analysts rail.
- All filters (asset, quick, sort, recommendation, status, horizon, risk, access) merged into the one sidebar.
- Unlock validation: hide "Unlock" when the viewer already has access via an advisor/service subscription.
- Featured advisors' calls bubble to the top with Promoted/Sponsored badges.

### Subscription Services 🧑‍💼 🛠 🚩
- Advisors create per-service plans (by market/strategy) with their own subscribers, broadcasts, chats, paid recos.
- Users subscribe via a modal/button; free-trial + paid tiers.
- Admin/super-admin revenue views (advisor revenue share).

### Subscriptions & Purchases (buyer side) 👤 🚩
- New page: active/past service + legacy advisor subs with expiry countdown + descriptions.
- One-time purchases section (individually unlocked trades/posts).
- Working Renew (1m/1y) + Cancel for both sub types; added the nav tab. Payment bypassed.

### Advisor promotion / Featured Analyst 🧑‍💼 🚩
- Paid "Featured Analyst" placement — `featuredUntil`/`featuredTier` on AdvisorProfile.
- "Get Featured" card on the Services page + `/api/v1/advisor/feature` (weekly/monthly/quarterly). Payment bypassed.

### Messages 👤 🧑‍💼 🛠
- DM threads between investors and advisors: inbox, thread list, new-chat search, message search.
- Admin messaging workflows; media + contacts support.

### Markets & Watchlist 👤
- Stock/crypto search on /markets (AngelOne) + add-to-watchlist everywhere a symbol appears (modern star icon).
- Watchlist panel + watchlist search; DB-backed watchlist store.
- Back button on the chart page; trade-detail gets back icon, similar-trades sidebar, and a comment form.

### Feed & community 👤 🧑‍💼
- Advisors can create/view normal community posts like investors (advisor feed).
- Feed post search by keyword / #tag / $symbol; @mention notifications.
- Feed filter (sort/recommendation/status/horizon/risk/access), post scheduling, composer improvements.

### Global search 👤
- User search page + search categories (people/posts/symbols) and search API.

### Competitions 👤 🛠
- Prediction-engine competition module (admin create/manage + investor participate); Finuer Score/levels.
- Added an "All" tab, a global leaderboard page + API, and a user stats card.
- 🐛 Fixed missing CSS (module was rendering as raw text with a stray gradient bar).

### Finuer Basket 👤 🛠
- Curated model-portfolio module with auto-calculated returns vs benchmark (admin manage + investor browse).
- Added Share + Add-to-Watchlist (new `finuer_basket_saves` table) and a 1M→5Y return sparkline.
- 🐛 Fixed missing CSS (module was rendering as stacked plain text).

### Navigation / docs alignment 👤 🧑‍💼
- Finuer Basket + Competitions made investor-only (removed from advisor nav) per the product specs.
- Removed the duplicate "Subscribers" tab; renamed Paper → "Virtual Trading" on both navs.
- Fixed the "My Market Posts" route-key mismatch; removed the global top search bars everywhere.

### Landing (public) 📣
- Adopted Hemant's emerald landing redesign (scoped `.landing-root` tokens; animated hero/mockups/header/popup/slider/carousel).
- Kept reusable motion primitives (counter, reveal); installed framer-motion + Radix.

### Infrastructure & fixes 🌐
- AngelOne WebSocket crash fix for Node 26 (`WS_NO_BUFFER_UTIL`/`WS_NO_UTF_8_VALIDATE`) + symbol-search error surfacing.
- Resolved `git pull origin main` merge (subscription-services union, tsbuildinfo); regenerated Prisma client.
- DB migrations applied to hosted Prisma Postgres: subscription services, `finuer_basket_saves`, advisor `featured_until`/`featured_tier`.
- Added `*.tsbuildinfo` to `.gitignore`.

---

### 🚩 Left to wire (external dependencies)
- **Payment gateway** — subscribe/renew, one-time unlock, and Featured Analyst purchase all bypass billing today.
- **AngelOne** live data subject to broker rate/session limits.
- `.env` (live broker creds, TOTP secret, Gemini key) is gitignored — never committed.

### Reference docs in repo
`TRADES-PHASE1-2-CHANGES.md` · `SUBSCRIPTION-SERVICES-CHANGES.md` · `MESSAGES-CHANGES.md` · `KNOWN-ISSUES.md`
