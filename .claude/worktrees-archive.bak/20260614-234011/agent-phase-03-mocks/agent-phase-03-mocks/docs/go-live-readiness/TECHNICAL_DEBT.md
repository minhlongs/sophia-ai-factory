# Technical Debt Register

This document tracks identified technical debt, legacy relics, and optimization opportunities within the Sophia AI Factory platform.

---

## 1. Supabase Relics & Migrated Services
- **Description**: Historically, the platform used Supabase for authentication and database services. Some configuration references and client modules still remain in the source tree even though Better Auth and Cloudflare D1 have been fully adopted.
- **Affected Paths**:
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/client.ts`
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/auth/callback/route.ts`
- **Impact**: Increased bundle size and developer confusion regarding the source of truth for auth.
- **Action Plan**: Safely delete the legacy Supabase file references.
- **Confidence Level**: **High** (D1 and Better Auth are the sole active database/auth backends).

---

## 2. Duplicate Cryptographic Logic
- **Description**: Cryptographic signing and key generation logic appears in multiple places across the tree layer, particularly between the Telegram bot integration and the core user session encryption.
- **Affected Paths**:
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/crypto/password-hash.ts`
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/signature.ts`
- **Impact**: Maintainability overhead; updates to hashing algorithms must be manually applied to both locations.
- **Action Plan**: Consolidate signature logic under a single export interface in `signatures.ts`.
- **Confidence Level**: **Medium** (requires verifying all consumer imports before refactoring).

---

## 3. Video Jobs Schema Mismatch
- **Description**: The database contains references and queries targeting a `video_jobs` table. This table was never added to the production Cloudflare D1 schema (migration history ended before its introduction), resulting in silent failures when triggering the legacy video pipeline.
- **Affected Paths**:
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts` (Cleaned: deprecated routes removed).
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/video-job-pipeline.ts`
- **Impact**: Code pathways that compile but crash at runtime if executed.
- **Action Plan**: Remove `legacy-video-runner.ts` completely and document HeyGen webhook as the single entry point.
- **Confidence Level**: **High** (verified by the team via ADR 0007).

---

## 4. API Pricing Margins Hardcoding
- **Description**: Calculations estimating pricing margins for Model Compute Units (MCU) and video rendering are hardcoded inside backend endpoints rather than retrieved dynamically from the database.
- **Affected Paths**:
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/coupons/activate/route.ts`
  - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/cost-guardrail.ts`
- **Impact**: Margin updates require a full production deployment instead of a database configuration update.
- **Action Plan**: Migrate pricing tier arrays and coupon definitions into a database table (`pricing_tiers`).
- **Confidence Level**: **Needs Verification** (requires validation of stripe webhook pricing sync rules).
