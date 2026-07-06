---
phase: 2
title: "Factory Registration"
status: completed
effort: done (verification only — implementation completed as part of Phase 1)
---

# Phase 2: Factory Registration

## Overview

Replicate is registered in the existing `ServiceFactory` video gate and BYOK credential stack. Phase 1 shipped the integration; this phase verified the registration contract end-to-end. No new tests required beyond what is already present in `land/services/factory.test.ts` (Case 5 explicitly asserts HEYGEN_API_KEY / REPLICATE_API_TOKEN prod gate, and `getReplicateVideoService` for direct access is covered.)[^1][^2][^3]

## Implementation Summary

| Concern | Verified location |
|---|---|
| Replicate service class | `src/land/services/replicate/replicate-video-service.ts` |
| ServiceFactory registration | `src/land/services/factory.ts` — `getVideoService` Heygen-first / Replicate fallback; `getReplicateVideoService` direct accessor |
| BYOK credential resolution | `src/tree/byok/resolve-user-api-key` + `src/tree/byok/user-api-key-store` |
| Provider format validator | `src/tree/byok/key-format-validators.ts` — `validateReplicate` (`r8_<32+ alphanum>`) |
| Error types | `src/seed/services/errors` — `ProviderInvalidKeyError`, `ProviderQuotaExceededError`, `ProviderNetworkError` |
| Barrel re-export | `src/land/services/index.ts` already re-exports `./replicate/replicate-video-service` |
| Tests | `src/land/services/factory.test.ts` (10/10 passing), Phase 1 validation runs alongside |

## Success Criteria

- [x] ReplicateVideoService implements IVideoService and handles create/get/list
- [x] ServiceFactory routes `getVideoService(userId)` to HeyGen → Replicate → mock/error
- [x] Direct `getReplicateVideoService(userId)` accessor added
- [x] BYOK `replicate` provider idempotent in `key-format-validators.ts`
- [x] Replicate errors use canonical `ProviderInvalidKeyError` etc. (no ad-hoc errors)
- [x] All ServiceFactory tests green (10/10)

## Notes

- Phase 1 was a placeholder; real implementation happened in Phase 1.Phase 2 was registry verification only. No code changes made.
- Phase 4 (`phase-04-testing-qa.md`) is a further net-new test expansion opportunity if the team wants broader Replicate integration coverage (but Phase 2's contract is satisfied by existing tests).

## Dependencies

- Phase 1 — ReplicateVideoService and ServiceFactory top-level wiring (done)
- Next: Phase 3 (Wizard Integration — register `replicate` provider in BYOK Setup Wizard form + validation)
