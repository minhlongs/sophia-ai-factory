# Technical Journal — Open-Core Runtime Persistence, Entitlement Truthfulness & Settings UI Wiring

- **Date:** 2026-10-17
- **Branch:** `fix/open-core-runtime-integration`
- **Scope:** Phase 06 (Steps 26–30 of Open-Core Restructuring Plan)

## Context & Problem Statement

Following the initial structural partitioning of the Open-Core Community and Commercial SaaS scopes, adversarial code review and documentation auditing surfaced three key gaps:
1. **Fail-Open Authorization Defect:** In `src/seed/config/edition-config.ts`, `meetsMinimumTierRank` defaulted to `true` when `licensedTier` was missing, and `resolveSophiaEdition` granted `'enterprise'` upon receiving `SOPHIA_EDITION=enterprise` even without a verified license key.
2. **Stateless Status Route & Misaligned Modal Copy:** `GET /api/open-core/status` was missing route-level authentication and did not resolve the user's active D1 subscription tier (`getUserTier`), while `POST /api/open-core/status` verified HMAC tokens without org binding and modal buttons promised "Activation" despite being a stateless server-side verification check.
3. **Portability Persistence Gap:** `src/app/api/open-core/portability` echoed mock data from query parameters instead of reading and writing the user's non-secret workspace configuration (`user_profiles.settings` and `tenant_settings`) in D1.

## Architectural Implementation & Security Invariants

1. **Fail-Closed Edition & Feature Gate Resolution (`src/seed/config/edition-config.ts`):**
   - Hardened `meetsMinimumTierRank`: when `licensedTier` is missing, it returns `requiredTier === 'FREE'` (strictly failing closed for all paid features).
   - Hardened `resolveSophiaEdition`: only returns `'enterprise'` when `hasValidRaasLicense === true`.
   - Verified that all non-community features require both edition eligibility and sufficient tier rank.

2. **D1-Backed Workspace Portability Store (`src/tree/open-core/workspace-portability-store.ts`):**
   - Created the persistence store reading `defaultLocale` and `routingStrategy` from `user_profiles.settings`, configured provider metadata (excluding plaintext keys) from `user_api_keys` and `user_provider_credentials`, and channel presets from `tenant_settings` (`namespace = 'misc'`).
   - Implemented `saveUserPortableConfig` to upsert imported non-secret configurations cleanly into D1 without altering database migrations.

3. **Truthful API Endpoints (`/api/open-core/status` & `/api/open-core/portability`):**
   - Enforced `getCurrentUser()` authentication on both routes (`401` if unauthenticated).
   - In `status/route.ts`, bound `GET` to the user's D1 tier (`getUserTier(user.id)`) and framed `POST` explicitly as `validation_preview` with `persisted: false` and strict `orgId` verification (`403 ORG_MISMATCH` if mismatched, never leaking internal `orgId` or `licenseId` in responses).
   - In `portability/route.ts`, connected `GET` and `POST` to `loadUserPortableConfig` and `saveUserPortableConfig`.

4. **Settings Dashboard Integration (`settings-page.tsx`, `open-core-portability-panel.tsx`, `open-core-portability-subviews.tsx`):**
   - Added the `Open-Core & Portability` tab to `src/components/stitch/screens/settings/settings-page.tsx`.
   - Implemented `OpenCorePortabilityPanel` and decomposed subviews into `open-core-portability-subviews.tsx` so all production files remain strictly `< 170 LOC`.
   - Updated `CommercialUpgradeModal` copy to clarify that license checks are preview-only and permanent activation requires setting server environment variables.

5. **Environment Template & Documentation Truthfulness:**
   - Corrected `.env.example` and `.env.community.example` variable names to match runtime expectations (`BYOK_MASTER_KEY`, `CREDENTIALS_MASTER_KEY`) and replaced static default keys with generation instructions.
   - Refined `README.md` and `docs/SELF_HOSTING.md` to state capabilities factually (direct social publisher code adapters included; configuration bundle export/import; platform developer approvals remain external prerequisites).

## Verification Evidence

- **Line Counts:** All 10 production files strictly `< 180 LOC` (`wc -l` passing).
- **TypeScript & ESLint:** `npm run type-check` (0 errors), `eslint` (0 errors, 0 warnings).
- **Layer Boundaries:** `npm run check:boundaries` (0 clean architecture layer violations).
- **i18n Translation Validation:** `npm run i18n:validate` (0 missing keys across 5,054 `t()` calls).
- **Vitest Unit & Integration Suites:**
  - `src/seed/config/__tests__/open-core-edition.test.ts`: 7 passed
  - `src/seed/security/__tests__/raas-license-verifier.test.ts`: 4 passed
  - `src/tree/open-core/__tests__/open-core-funnel.test.ts`: 4 passed
  - `src/app/api/open-core/__tests__/open-core-routes.test.ts`: 6 passed
  - Protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN): 147 passed
  - Total: 22 test files passed, 168 tests passed, 0 failures.
