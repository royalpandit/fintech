# Flexi Database (PostgreSQL)

This folder contains **plain SQL migrations** you can run directly on a server.

## Apply migrations

Run in order:

```bash
psql "$DATABASE_URL" -f database/migrations/001_init.sql
psql "$DATABASE_URL" -f database/migrations/002_seed.sql
```

## One-command bundle (recommended for servers)

```bash
psql "$DATABASE_URL" -f database/bundle/apply.psql
```

## Notes

- Uses PostgreSQL extensions `pgcrypto` (UUID generation) and `citext` (case-insensitive email).
- Includes constraints, indexes, and basic seed data for roles, admin user, categories, and demo advisor.

