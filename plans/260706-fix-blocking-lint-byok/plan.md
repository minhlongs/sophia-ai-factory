# Fix Blocking Lint + BYOK Providers

## Context
From 25-step execution review: 4 lint ERRORs block `npm run build` and `ci:lint`.
Also: BYOK save-credentials endpoint missing OpenRouter / ElevenLabs / D-ID.

## Phases

### Phase 1: Layer Boundary — platform-config-repo.ts
**File:** `src/seed/db/platform-config-repo.ts`
**Issue:** `import { encryptValue, decryptValue } from '@/tree/credentials/encryption'` violates seed→tree.
**Fix:** Move `encryptValue`/`decryptValue` to `src/seed/security/crypto-utils.ts` (already exempted in eslint config). Update `platform-config-repo.ts` and the original `encryption.ts` to re-export from seed for backward compat.

### Phase 2: Layer Boundary — stats-aggregator.ts
**File:** `src/forest/analytics/stats-aggregator.ts:16`
**Issue:** `import { ... } from '@/land/analytics/funnel-dashboard'` violates forest→land.
**Fix:** Extract the shared type/constant used by stats-aggregator into `src/seed/types/` or `src/tree/analytics/`. Update the import.

### Phase 3: Pricing Error Component
**File:** `src/app/[locale]/pricing/error.tsx`
**Issues:** (a) `require()` import, (b) conditional hook call.
**Fix:** Replace `require()` with standard `import`. Move hook call above early return.

### Phase 4: BYOK Schema Extension
**File:** `src/app/api/setup-wizard/save-credentials/route.ts`
**Issue:** Schema only handles `heygen`, `resend`, `nowpayments`. Missing `openrouter`, `elevenlabs`, `did_id`/`d-id`.
**Fix:** Add fields to `saveCredentialsSchema` for `openrouter_api_key`, `elevenlabs_api_key`, `did_api_key`. ProviderType already includes these values.

## Acceptance Criteria
- `npx eslint src --max-warnings=1000` shows 0 errors
- `npm run build` exit 0
- OpenRouter, ElevenLabs, D-ID keys save successfully via save-credentials endpoint
- No new warnings introduced

## Out of Scope
- Fixing pre-existing warnings (620)
- TikTok integration (already in tree)
- Zone/aggregator business logic refactor
