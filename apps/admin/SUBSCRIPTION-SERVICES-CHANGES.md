# Subscription Services — change log

The keystone that unblocks per-service segmentation across the Messages and
Trades PRDs: dynamic subscription filters, chat badges, broadcast recipient
groups, and trade "publish to a service".

Date: 2026-07-26 · Status: implemented, not committed.

---

## Model (migrations applied)

Separate tables so existing `subscriptions` (chat gating) are untouched:

- **`subscription_services`** — a per-analyst plan: name, description, price
  (monthly), `is_bundle`, `is_active`, `sort_order`.
- **`service_bundle_items`** — a bundle service's member services.
- **`service_subscriptions`** — a user's ownership of a service (`@@unique
  (user_id, service_id)`). Owning any service also keeps the flat `Subscription`
  active, which is what still grants chat access.
- **`dm_broadcasts.target_service_ids Int[]`** — a broadcast's target services
  (empty = all subscribers).

Migrations: `subscription-services-migration.sql` (+ rollback),
`broadcast-target-services.sql`.

## Helpers — `lib/subscription-services.ts`
- `advisorServices(advisor, {activeOnly})` — services + active subscriber counts.
- `userOwnedServiceIds(user, advisor)` — services a user owns (direct + bundle
  expansion).
- `subscribersForServiceIds(advisor, ids)` — user IDs owning any of those
  services, including via a bundle that contains one.
- `subscriberServiceNames(advisor)` — userId → service names (chat badges).

## Features wired
- **Analyst service management** — new `/advisor/services` page (create/list/
  delete services, build bundles from existing services). "Services" nav tab.
  APIs: `GET/POST /api/v1/advisor/services`, `PATCH/DELETE /…/services/[id]`,
  public `GET /api/v1/advisor/[id]/services`.
- **Subscribe to a service** — `SubscribePlansModal` now lists the advisor's
  services (falls back to the global monthly/yearly plans when none exist).
  `POST /api/v1/advisor/[id]/subscribe` accepts `serviceId` → creates a
  `service_subscriptions` row and keeps the flat subscription active.
- **Broadcast recipient groups** — the Broadcast composer shows "All Subscribers"
  + one chip per service (with counts); the live recipient count updates with the
  selection. Delivery targets exactly those subscribers (dedup, incl. bundles).
  Scheduled broadcasts remember their target services.
- **Message subscription filters + badges** — analyst Messages page shows dynamic
  filter chips (All + per-service with counts) and per-conversation service
  badges next to each subscriber's name.
- **Trade publish-to-service** — the trade composer's "Subscribers → Choose
  specific people" now also offers "publish to a service". Selecting services
  targets exactly those subscribers via the existing custom-audience mechanism
  (`MarketPostRecipient`), so visibility gating is reused unchanged.

## What this unblocks (previously deferred)
- Messages PRD: subscription filters ✅, chat badges ✅, broadcast recipient
  groups ✅.
- Trades PRD: "publish to a service / subscriber broadcast" ✅.

## Phase 2 — full "Create Subscription Service" PRD (2026-07-27)

Matches `Finuer – Create Subscription Service (Analyst)`.

### DB (migration `service-plans-migration.sql`, applied)
- `subscription_services` += `category` (enum `service_category`:
  stocks/futures/options/commodity/currency/crypto), `yearly_price`,
  `has_trial`, `trial_days` (default 7), `paused`.
- `service_subscriptions` += `is_trial`.

### Analyst UX — "Subscribers" tab **replaced by "Subscription Services"**
- Old `/advisor/subscribers` now **redirects** to `/advisor/services` (per the
  decision, subscribers live inside each service — no global list).
- **Hub** (`/advisor/services`): "+ Create New Service" + service cards
  (name, category, ₹/mo, trial, subscriber count, Active/Paused, Manage).
- **Create form** (PRD Basic Details + Pricing): Service Name, Category,
  Description, Monthly + Yearly price with **auto "saves X%"**, 7-Day Free Trial
  toggle.
- **Manage page** (`/advisor/services/[id]`) with the four PRD tabs:
  - **Overview** — name, category, description, monthly & yearly pricing,
    subscriber count, status.
  - **Subscribers** — table of subscribers with start / expiry /
    Active·Expired·Cancelled status + trial badge.
  - **Analytics** — total subs, active, monthly & yearly revenue, active trials.
  - **Settings** — edit name/category/description/pricing, toggle 7-day trial,
    **Pause new subscriptions**, **Delete** (guarded: warns on active subscribers,
    deletes with confirmation via `?force=true`).

### Subscribe flow
- Subscribe modal shows a **Monthly/Yearly** toggle (when yearly pricing exists)
  and a **free-trial** note. First-time subscribers to a trial service get an
  `is_trial` subscription expiring after `trial_days`; paused services are hidden
  and rejected server-side.

### API
- `POST/PATCH /api/v1/advisor/services[/id]` handle category / yearly / trial /
  paused; `DELETE` is guarded (409 unless `?force=true`).
- `POST /api/v1/advisor/[id]/subscribe` accepts `billing` (monthly/yearly) and
  grants trials.

### ⚠️ Approximations (no billing engine)
- **Revenue** = active subscribers × price (live snapshot, not real collections).
- **Renewal Rate** shows "—": needs billing-cycle history we don't record.
- **Trials don't actually bill** at expiry; the subscription simply expires by
  `end_date` (consistent with the app's no-payment model).
- **Legacy subscribers** (flat `Subscription` from before services existed) own no
  service, so they don't appear under any service's Subscribers tab.

## ⚠️ Notes / still open
- **Bundle pricing/among-services UI** is basic (pick ≥2 services, set a price).
  No proration or per-member pricing.
- **No real payments** — subscribing is instant (consistent with the rest of the
  app). GST is display-only on paid trades.
- **Legacy flat subscribers** (subscribed before services existed) own no service,
  so they appear under "All" but not under any service filter/badge. That's
  expected; they keep chat + general access.
- Editing a service's bundle membership after creation isn't exposed yet (create
  + delete only).
