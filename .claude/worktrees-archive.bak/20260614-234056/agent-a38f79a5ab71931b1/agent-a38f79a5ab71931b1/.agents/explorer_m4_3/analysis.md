# Sophia AI Factory Testing & Verification Setup Analysis

## 1. General Testing Setup Overview

The testing environment of the **Sophia AI Factory** project utilizes **Vitest** as the core test runner, configured with a `jsdom` environment. Below are the execution and configuration details:

### Package Scripts (`package.json`)
The root `package.json` defines the following scripts for test execution:
- `"test": "vitest run"` - Runs the full test suite once.
- `"test:watch": "vitest"` - Runs tests in watch mode.
- `"test:ui": "vitest --ui"` - Launches Vitest UI.
- `"test:coverage": "vitest run --coverage"` - Runs tests with coverage reports.

### Vitest Config (`apps/sophia-ai-factory/vitest.config.ts`)
- **Environment**: `'jsdom'`
- **Globals**: Enabled (`globals: true`).
- **Setup File**: `./src/test/setup.tsx` (runs before each test file).
- **Test File Pattern**: `src/**/*.test.{ts,tsx}`
- **Coverage**:
  - Reporters: `['text', 'json-summary', 'html']`
  - Global Thresholds: Lines: 60%, Functions: 50%, Branches: 50%, Statements: 60%.
  - Local Guard: Under `src/app/[locale]/dashboard/**`, there is a strict regression floor (Lines: 4%, Branches: 4%, Functions: 2%, Statements: 3%).
- **Environment variables loading**: Automatically loads `.env.test` using `dotenv`.

---

## 2. Unit Tests Covering Usage Metering, Redis Tracking, and Quota Checking

The following exact unit test files under `apps/sophia-ai-factory/src` verify these functions. All 102 tests passed successfully.

### 2.1. Usage Metering Tests
- **`forest/usage-metering/usage-metering-integration.test.ts` (25 tests passed)**
  - *Idempotency*: Tests format validation for keys with prefix `req_` (client-driven) and `gen_` (system-driven). Ensures unique keys are generated per call when `requestId` is missing to avoid silent collisions, and deterministic keys when `requestId` is present.
  - *License Association*: Verifies consistent SHA256 hashing for license keys (`raas_*`).
  - *Credit Calculation*: Validates credits used for HeyGen (1 per call), ElevenLabs (1 per call), and OpenRouter (5 credits per 5000 tokens). Ensures correct multipliers are applied (PREMIUM and ENTERPRISE get a bonus rate).
  - *Response Time Utility*: Tests `startTimer()` to verify elapsed millisecond measuring.
  - *Event Structure*: Pinpoints schema structure compliance for `UsageEventInput`.

- **`forest/usage-metering/aggregator.test.ts` (15 tests passed)**
  - *Hour/Day Aggregation*: Verifies aggregation of events by hour and day.
  - *Error Tracking*: Tracks error count for non-2xx response status codes.
  - *Tenant Separation*: Verifies that events from different users/tenants are not aggregated together.
  - *Summary Generation*: Tests the construction of `buildHourlySummary` and `buildDailySummary`.

- **`forest/usage-metering/usage-kv-sync-batching.test.ts` (7 tests passed)**
  - *KV Batching*: Verifies merging multiple records of the same `userId:service` key into a single `KV.put` write. Writes separate KV entries for distinct user-service pairs.
  - *State Synchronization*: Tests merging new batch totals with existing values (read-modify-write).
  - *Non-blocking IO*: Ensures flushing is deferred via `waitUntil` when provided in Cloudflare Workers context.
  - *KV Failures*: Tests null client guards when Redis KV client is missing.

### 2.2. Redis Tracking Tests
- **`tree/clients/__tests__/upstash-redis-client.test.ts` (16 tests passed)**
  - *Upstash client*: Mocks `@upstash/redis` to test singleton instance retrieval.
  - *Production Checks*: Throws error if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are missing in production.
  - *Dev fallback*: Emits dummy client in non-production environments when variables are missing.
  - *State CRUD*: Tests `setSession`, `getSession` (including automatic JSON-parsing), and `deleteSession` session states.
  - *Ping*: Verifies connection checks via `ping()` returning true/false based on `PONG`.

### 2.3. Quota Checking Tests
- **`forest/quota/__tests__/mission-quota.test.ts` (7 tests passed)**
  - *Quota Calculation*: Sums counts from both `missions` and `engine_missions` tables in the D1 database.
  - *Owner Mappings*: Resolves owner relationships via `resolveOrgId` and `resolveOrgOwnerUserId`.
  - *Tier Gate Enforcing*: Blocks requests at the boundaries of `BASIC` and `PREMIUM` tiers.
  - *Fail-open Safety*: Resolves to allowed when D1 database throws errors or is missing.

- **`forest/quota/video-quota.test.ts` (9 tests passed)**
  - *Tier Limits*: Exposes BASIC (0), PREMIUM (30), ENTERPRISE (200), and MASTER (1000) slots.
  - *MASTER Limit Regression Lock*: Rejects the 1001st slot reservation for the MASTER tier.
  - *Reservation States*: Exercises D1 queries to verify transaction updates for reserving slots (`reserveVideoSlot`) and releasing them (`releaseVideoSlot` floors count at 0).
  - *Quota checking (read-only)*: `checkVideoQuota` reports correct counts without changing states.

- **`seed/auth/enforce-tier-quota.test.ts` (4 tests passed)**
  - *Tiers routing*: Validates routing behavior for `checkTierQuota`. Rejects BASIC (0 limit), allows/rejects PREMIUM/ENTERPRISE based on underlying `checkVideoQuota` result.

- **`seed/auth/enforce-ai-command-quota.test.ts` (8 tests passed)**
  - *AI Commands tier limits*: Validates quota check for `checkAiCommandQuota` (BASIC: 5/mo, PREMIUM: 15/mo, ENTERPRISE: 15/mo, MASTER: unlimited 999).
  - *Optimization*: Short-circuits DB queries entirely for MASTER users.
  - *UTC Boundaries*: Ensures `resetsAt` is correctly calculated as the start of the next month.

- **`lib/publishing/__tests__/per-channel-quota.test.ts` (7 tests passed)**
  - *Channel Limits*: Enforces daily quotas for tiktok (30), youtube (50), and instagram (25).
  - *State*: Increments used values and blocks when daily limits are exceeded.

- **`lib/publishing/__tests__/per-channel-quota-d1-race.test.ts` (4 tests passed)**
  - *D1 atomic operations*: Exercises actual SQL `UPDATE ... WHERE used_today < daily_limit` logic using an SQLite in-memory instance (`FakeD1`).
  - *Race condition safety*: Fires 10 concurrent requests to a limit=5 quota, validating that exactly 5 are allowed and 5 are blocked.
  - *Idempotency*: Tests that `INSERT ... ON CONFLICT DO NOTHING` works correctly.

---

## 3. Verification Scripts & Special Requirements

Sophia AI Factory uses a robust suite of validation and automation scripts under `/scripts/`.

### 3.1. Go-Live Documentation Verifier (`scripts/verify-go-live-docs.py`)
- **Purpose**: Verifies compliance for documentation files before releasing or deploying.
- **Checks executed**:
  - Checks if **17 required documents** are present and non-empty (including README, SECURITY, docs/QUICKSTART, docs/TESTING, etc.).
  - **Placeholder Search**: Scan for placeholder words (`TODO`, `TBD`, `placeholder`, `xxx+`) using a case-insensitive regex pattern. Exits with error if found.
  - **Link Verification**: Checks both relative paths and absolute `file:///` links inside the markdown files to ensure the target files actually exist locally.
- **Special Requirements**:
  - Requires **Python 3**.
  - **Hardcoded Path**: Uses a hardcoded path (`WORKSPACE_DIR = "/Users/macbook/projects/sophia-ai-factory"`). Running it on environments where this directory structure does not exist will fail unless modified.

### 3.2. Local Gate Runner (`scripts/ci/run-gates.sh`)
- **Purpose**: Pre-push script designed to mirror the CI quality gate locally.
- **Checks executed**:
  - Runs TypeScript type checking via `tsc --noEmit`.
  - Runs Next.js ESLint validation (`next lint`).
  - Runs full Vitest suite with coverage and checks that overall line coverage is **`>= 70%`** by parsing `coverage/coverage-summary.json` with a python snippet.
  - **Zero `: any` Types**: Runs grep to ensure there are no `: any` type declarations in `.ts` or `.tsx` files.
  - **Zero Console Logs**: Ensures there are no calls to `console.log`, `console.warn`, or `console.error` in the production code (ignores `__tests__` and lines containing `// eslint-disable`).
- **Special Requirements**:
  - Expects a Unix-like environment supporting `grep`, `wc`, `tr`.
  - Requires Python 3, Node, and npm packages.

### 3.3. Database Migration Canary Guard (`scripts/ci/migration-guard.sh`)
- **Purpose**: Blocks canary deployments to prevent schema skew when D1 migrations are pending.
- **Checks executed**:
  - List migrations for D1 database `sophia-raas-db` via `npx wrangler d1 migrations list sophia-raas-db --json`.
  - Exits with `1` (failing the deployment pipeline) if there are any migrations without an `applied_at` date. Forces a full sequential deployment (100% switch) instead of canary split.
- **Special Requirements**:
  - Requires `CLOUDFLARE_API_TOKEN` environment variable to authenticate wrangler CLI.

### 3.4. Email DNS Verifier (`scripts/verify-email-dns.ts`)
- **Purpose**: Queries DNS TXT records to confirm SPF, DKIM, and DMARC parameters.
- **Checks executed**:
  - Verifies presence of SPF (`v=spf1 ...`), DKIM selector record (`resend._domainkey`), and DMARC (`_dmarc.mekongmind.com`) policy details.
- **Special Requirements**:
  - Must run via Node tsx CLI: `pnpm dlx tsx scripts/verify-email-dns.ts [domain]`.
  - Needs external network connection to query DNS resolvers.
  - Defaults to `mekongmind.com` but accepts overrides via `RESEND_DOMAIN` or first command-line argument.

### 3.5. Wrangler Secrets Deployer (`scripts/ci/wrangler-set-build-vars.sh`)
- **Purpose**: Atomically injects current commit metadata (commit SHA, deploy branch, timestamp) as secrets directly into the Cloudflare Worker, bypassing dangerous file rewrites.
- **Special Requirements**:
  - Requires `CLOUDFLARE_API_TOKEN` environment variable.
