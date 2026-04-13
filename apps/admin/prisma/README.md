# Data Model — Corescent Fintech

PostgreSQL database managed via **Prisma ORM**.

## Quick Reference

| # | Domain | Tables | Description |
|---|--------|--------|-------------|
| 1 | Identity & Access | `users`, `roles`, `user_sessions`, `kyc_documents`, `consent_logs` | Auth, KYC, sessions |
| 2 | Advisor | `advisor_profiles`, `advisor_metrics_daily`, `advisor_plans`, `advisor_wallets` | SEBI-verified advisors, plans & earnings |
| 3 | Market Sentiment | `market_posts`, `market_comments`, `market_reactions`, `sentiment_aggregates`, `content_reports` | Regulated sentiment posts & moderation |
| 4 | Community | `community_posts`, `community_comments`, `community_post_saves`, `community_reactions`, `user_follows`, `groups`, `group_members`, `reputation_logs`, `dm_threads`, `dm_messages` | Social features, DMs, reputation |
| 5 | Tags | `tags`, `market_post_tags`, `community_post_tags` | Hashtag engine for content discovery |
| 6 | Portfolio | `broker_accounts`, `portfolios`, `portfolio_assets`, `trades_real`, `portfolio_snapshots_daily`, `portfolio_ai_analysis` | Real portfolio tracking & AI analysis |
| 7 | Virtual Lab | `virtual_wallets`, `trades_virtual`, `leaderboard_periods`, `leaderboard_entries`, `strategy_templates`, `backtest_results` | Paper trading, strategies & backtesting |
| 8 | Personal Finance | `bank_accounts`, `expense_categories`, `transactions`, `budgets`, `savings_goals`, `savings_goal_contributions`, `financial_scores` | UPI/bank sync, budgets, savings |
| 9 | Watchlists & Alerts | `watchlists`, `watchlist_items`, `price_alerts` | Asset tracking & price triggers |
| 10 | AI | `ai_logs`, `ai_decision_logs`, `ai_chat_sessions`, `ai_chat_messages`, `compliance_logs` | AI audit trail & chatbot history |
| 11 | Risk Profiling | `risk_profiles` | User risk appetite questionnaire |
| 12 | Courses | `courses`, `course_lessons`, `course_enrollments`, `course_lesson_progress`, `course_reviews` | Learning platform with progress tracking |
| 13 | Payments | `subscriptions`, `payments`, `invoices`, `payout_requests` | Billing, invoices & advisor payouts |
| 14 | Notifications | `notifications`, `notification_preferences`, `user_devices` | In-app, push (FCM), email |
| 15 | User Settings | `user_preferences` | Theme, language, currency |
| 16 | Audit | `audit_logs` | Admin action logging |

**Totals:** 70 models · 21 enums

## Enums

`UserRole` · `AccountStatus` · `VerificationStatus` · `KycDocumentType` · `SentimentType` · `AssetType` · `RiskLevel` · `ComplianceStatus` · `PostVisibility` · `ReactionType` · `TxnType` · `TradeSide` · `SubscriptionStatus` · `PaymentStatus` · `PayoutStatus` · `NotificationChannel` · `RiskAppetite` · `ChatContextType` · `AlertDirection` · `DevicePlatform` · `InvoiceStatus`

## Commands

```bash
npx prisma generate     # Generate client
npx prisma db push      # Sync schema → DB
npx prisma studio       # Visual data browser
npx prisma migrate dev  # Create migration
```

## Schema Location

```
apps/admin/prisma/schema.prisma
```
