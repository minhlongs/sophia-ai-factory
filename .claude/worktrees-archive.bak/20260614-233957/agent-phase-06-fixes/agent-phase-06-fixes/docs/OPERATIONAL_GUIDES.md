# Operational Guides

This document provides schema references, data management procedures, and migration checklists for operators of the Sophia AI Factory platform.

---

## 1. Database Table Schema Reference

Sophia's relational structure contains several critical tables inside Cloudflare D1.

### 1.1. Tenant & Billing Tables
* **`organizations`**: Manages corporate customer accounts.
  - `id` (UUID, Primary Key): Unique identifier for the organization.
  - `name` (text): Corporate/tenant name.
  - `created_at` (timestamp): Record creation time.
* **`org_balances`**: Tracks computing quota balances per organization.
  - `org_id` (UUID, Primary Key, references `organizations.id`).
  - `balance` (numeric, default 50): Number of available credits.
  - `updated_at` (timestamp).
* **`user_mcu_balance`**: Stores user-specific compute unit balances.
  - `user_id` (UUID, Primary Key, references `users.id`).
  - `credits_remaining` (numeric): Unused compute credits.
  - `credits_total_purchased` (numeric): Lifetime credit count purchased.
  - `credits_total_used` (numeric): Lifetime credit count spent.
* **`mcu_transactions`**: Audit ledger for all credit mutations.
  - `id` (UUID, Primary Key).
  - `user_id` (UUID, references `users.id`).
  - `amount` (numeric): Credits added (positive) or subtracted (negative).
  - `description` (text): Purpose of transaction (e.g. "video generation", "coupon activation").

### 1.2. Campaign & Video Tables
* **`campaigns`**: Stores configurations for marketing campaigns.
  - `id` (UUID, Primary Key).
  - `name` (text): Campaign title.
  - `user_id` (UUID, references `users.id`).
  - `status` (text): Campaign state (`active`, `paused`, `completed`).
* **`video_jobs`**: Logs rendering states of AI avatars.
  - `id` (UUID, Primary Key).
  - `org_id` (UUID, references `organizations.id`).
  - `provider_job_id` (text): HeyGen or D-ID video job identifier.
  - `status` (text): Rendering state (`pending`, `processing`, `completed`, `failed`).

---

## 2. Cloudflare D1 Database Migrations Check

Database migrations are managed using Wrangler schema migrations. Follow these procedures to check, dry-run, and apply migrations safely.

### Check Active Migrations
To review applied migrations on the production database:
```bash
npx wrangler d1 execute sophia-raas-db --command="SELECT migration_name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 10" --remote
```

### Dry-run Migrations Locally
Before applying to production, verify that migrations run cleanly on local SQLite emulation:
```bash
npx wrangler d1 migrations apply sophia-raas-db --local
```

### Apply Migrations to Production
To run outstanding migrations against the Cloudflare D1 production database:
```bash
npx wrangler d1 migrations apply sophia-raas-db --remote
```

---

## 3. Database Maintenance and Recovery Checks

* **Ledger Auditing**: Run reconciliation scripts monthly to verify that sum of `mcu_transactions.amount` matches the values in `user_mcu_balance.credits_remaining`.
* **Archival Thresholds**: When D1 database sizes approach 8GB, run the archival script to export transaction logs older than 180 days to compressed R2 storage tables.
