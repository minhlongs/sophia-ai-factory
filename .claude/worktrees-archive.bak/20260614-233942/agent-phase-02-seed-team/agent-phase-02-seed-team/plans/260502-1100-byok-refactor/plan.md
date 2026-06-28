# BYOK Refactor — End-to-End

**Status:** In Progress  
**Date:** 2026-05-02  
**Priority:** CRITICAL

## Goal
Each customer uses THEIR OWN HeyGen/Resend/NOWPayments keys for video fulfillment.
Platform keys remain only for synthetic monitor, health check, onboarding video.

## Existing BYOK Infrastructure
- `lib/byok/byok-crypto.ts` — AES-GCM-256, Web Crypto ✅
- `lib/byok/user-api-key-store.ts` — CRUD over `user_api_keys` D1 table ✅
- `lib/byok/resolve-user-api-key.ts` — BYOK_ENABLED gate ✅
- `user_api_keys` migration 0011 ✅
- `getHeyGenClient(userId?)` already resolves user key ✅
- `factory.ts` has `resolveHeygenKey(userId?)` ✅

## Gaps to Fix
1. [ ] Migration 0046 — `user_provider_credentials` table (spec requirement)
2. [ ] `lib/credentials/encryption.ts` — re-export / thin wrapper over byok-crypto
3. [ ] `lib/credentials/user-credentials-repo.ts` — maps to user_api_keys store
4. [ ] `lib/credentials/get-provider-key.ts` — `getHeyGenKey`, `getResendKey`, `getNowPaymentsKey`
5. [ ] `fulfillment-retry` cron — per-row user key lookup (not single env var)
6. [ ] `video-status-sync` cron — per-row `getHeyGenClient(userId)` 
7. [ ] `one-time-fulfillment.ts` — use `getHeyGenKey({userId, fallbackToPlatform:false})`
8. [ ] Setup wizard — HeyGen + Resend + NOWPayments fields
9. [ ] API routes: save-credentials, test-heygen, test-resend, list-credentials
10. [ ] Pricing page — HeyGen credential gate before One-Time CTA
11. [ ] Tests — new modules + update mocks
12. [ ] Docs update

## Phases
- [x] Research & analysis
- [ ] Phase 01: Migration + credentials lib
- [ ] Phase 02: Refactor fulfillment readers
- [ ] Phase 03: Setup wizard + API routes
- [ ] Phase 04: Pricing gate
- [ ] Phase 05: Tests
- [ ] Phase 06: Docs
