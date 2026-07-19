# Phase 02B Implementation Report — Wizard Persist + HeyGen

**Date:** 260429 | **Status:** COMPLETED

---

## Files Modified

| File | Change |
|---|---|
| `src/app/api/setup/save/route.ts` | Replaced stub with real persist: iterates PROVIDER_MAP, calls `setUserApiKey()` per non-empty key, returns `{ saved: [...] }` |
| `src/app/setup-wizard/components/steps/api-keys-step.tsx` | Added HeyGen + MuAPI fields; wrapped all labels/helpText in `useTranslations('setupWizard.apiKeys')` |
| `src/app/setup-wizard/page.tsx` | Added `HEYGEN_API_KEY` + `MUAPI_API_KEY` to config state + status initial state |
| `messages/en.json` | Added `setupWizard.apiKeys.*` block (5 providers × 3 keys = 15 strings) |
| `messages/vi.json` | Added same block in Vietnamese with full diacritics |
| `src/app/setup-wizard/components/steps/api-keys-step.test.tsx` | NEW — 6 tests covering: title/subtitle render, all 5 fields render, HeyGen field render, updateConfig callback, verifyKey per-provider correctness |

---

## New Translation Keys Added

```
setupWizard.apiKeys.title / subtitle
setupWizard.apiKeys.{openrouter,elevenlabs,did,heygen,muapi}.{label,placeholder,help}
```

15 keys × 2 locales = 30 entries total.

---

## Test Results

```
Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  696ms
```

---

## TSC Status for Owned Files

Zero errors from any owned file. Pre-existing errors in `video-service.ts`, `generate-campaign.ts`, HeyGen API routes (Phase 02A scope) remain unchanged.

---

## Sample VI Translations (diacritics check)

- `setupWizard.apiKeys.title` → **"Cấu Hình Dịch Vụ AI"** (ấ, ị, ụ correct)
- `setupWizard.apiKeys.elevenlabs.label` → **"ElevenLabs API Key (Giọng Nói)"** (ọ, ó correct)
- `setupWizard.apiKeys.muapi.label` → **"MuAPI Key (Âm Nhạc/Âm Thanh)"** (Â, ạ, Â correct)

---

## Bottom Line

WIZARD PERSISTS KEYS + HEYGEN FIELD LIVE ✅

- `POST /api/setup/save` now calls `setUserApiKey()` for every non-empty provider key (openrouter, elevenlabs, d-id, heygen, muapi)
- HeyGen field renders in Step 2 with mask/verify/eye-toggle identical to ElevenLabs pattern
- MuAPI field also added
- All labels i18n-wrapped via `useTranslations('setupWizard.apiKeys')`
- 6/6 tests pass, zero new TSC errors in owned files
