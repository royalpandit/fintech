# Flexi - Fintech Social Intelligence Platform

Full-stack setup based on the provided PTDD, Advisor Panel, and Super Admin Panel documents.

## Stack

- Admin Panel: Next.js (`apps/admin`)
- Backend APIs: NestJS (`apps/backend`)
- AI Layer: FastAPI (`apps/ai`)
- Database: PostgreSQL
- Cache/Queue: Redis

## Project Structure

- `apps/admin`: Super Admin + Advisor panel UI scaffolding
- `apps/backend`: NestJS API with all documented endpoints
- `apps/ai`: FastAPI multi-agent style AI endpoints
- `docker-compose.yml`: Postgres + Redis + backend + ai + admin

## Quick Start

1. Copy env files:
   - `cp apps/backend/.env.example apps/backend/.env`
   - `cp apps/ai/.env.example apps/ai/.env`
2. Run with Docker:
   - `docker compose up --build`
3. URLs:
   - Admin: `http://localhost:3000`
   - Backend: `http://localhost:4000/api/v1`
   - AI Layer: `http://localhost:8000`

## Included API Coverage

All major endpoints from the PTDD API section are included, including:
- Auth/User
- Advisor verification/subscription
- Market sentiment module
- Community module
- Portfolio and AI insights
- Virtual lab + leaderboard
- AI chatbot/risk/expense endpoints
- Finance + UPI + budgets
- Courses + purchases
- Notifications
- Admin moderation/compliance/reporting
- Moderation analysis endpoint

## Notes

- This setup is production-ready as a foundation and includes architecture, endpoint scaffolding, and database models.
- Integrations like broker APIs, payment gateways, and advanced ML models are structured with placeholders and can be plugged into service implementations.
