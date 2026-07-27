# Messages module — change log

Against `analyst message section.pdf` (Analyst Messages PRD).

Date: 2026-07-26 · Status: implemented, not committed.

---

## Already in place before this pass
- Premium chat — only **active subscribers** can message an analyst; free
  followers are blocked (enforced in `POST /api/v1/messages/threads`).
- Private 1-to-1 chat with text + **image + PDF/doc** attachments.
- User-side subscriber search + deep message-history search.

## Shipped this pass — Broadcast (1-to-many) + polish

### DB (migration `dm-broadcasts-migration.sql`, rollback `dm-broadcasts-rollback.sql`, applied)
- `dm_broadcasts` — one row per analyst broadcast (content, attachment,
  recipient_count, scheduled_at, sent_at).
- `dm_messages.broadcast_id` — tags each fanned-out copy so it renders a badge.

### Delivery (`lib/broadcast.ts`)
- `activeSubscriberIds(analyst)` — deduped active subscribers.
- `deliverBroadcast(id)` — for each subscriber, find-or-create the 1:1 thread and
  insert the message tagged with `broadcastId`. **One copy per subscriber.**
- `createBroadcast(...)`, `sendDueBroadcasts()` — scheduled broadcasts are sent
  lazily on the next messages-page load (no cron), like scheduled trades.

### API (`app/api/v1/advisor/broadcasts/route.ts`, analyst-only)
- `GET` → current active-subscriber count (recipient count).
- `POST` → create + send now, or schedule for later. Rejects when there are no
  active subscribers.

### UI
- **Analyst messages** (`advisor/(shell)/messages`): rebuilt as a client list with
  a **subscriber search** bar + a **+ Broadcast** button. Broadcasts show a "📢"
  prefix in the list preview.
- **Broadcast composer** (`broadcast-composer.tsx`): message + attachment + live
  recipient count + **Send Now / Schedule** (date-time). Styles `.bc-*` in globals.
- **Chat** (`ChatClient`): broadcast messages show a **📢 Broadcast badge**;
  subscribers can reply normally (reply is a normal private message). Added an
  **emoji** picker to the composer (reuses `EmojiPicker`).

---

## ⚠️ Deferred — need the Subscription-Services model (the keystone)

The PRD's **dynamic subscription filters, subscription badges on chats, and
broadcast recipient groups** (Equity / Commodity / Options / … per analyst) all
require per-analyst **subscription services** (named/bundle plans). Today a
subscription is a single flat monthly/yearly plan with no "service" concept, so:

- Broadcast currently targets **All active subscribers** only (no per-service
  targeting / "Choose Service").
- Chat list has **no subscription badges** and the analyst list has **no
  subscription filter chips with counts**.

Building `SubscriptionService` (per-analyst plans) + `Subscription.serviceId`
unblocks all of the above **and** the trades "publish to a service" broadcast.
This is the single highest-leverage next build across both PRDs.

## Deferred — other
- **Video + voice notes** in chat — upload route currently allows images + docs
  only. (Emoji ✅, images ✅, PDF ✅ are done.)
- **Unread counts** — no per-participant read tracking yet (needs a `lastReadAt`
  on `dm_thread_participants` + mark-read on open).
- **Push notifications** on broadcast delivery — not wired.
