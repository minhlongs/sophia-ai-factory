# BYOK Admin Flow Ship-Blockers — Fix Report
Date: 260429

## Status: COMPLETE

## Files Modified

| File | Lines Changed | Change |
|------|--------------|--------|
| `src/lib/byok/user-api-key-store.ts` | +1 | Added doc comment clarifying heygen is server-managed; kept it in ByokProvider union (required by heygen-client.ts, factory.ts — out-of-scope files) |
| `src/app/api/user/byok/route.ts` | +16 | Added muapi to PROVIDERS const; added PROVIDER_KEY_RX map + superRefine format validation; replaced generic Zod errors with field-specific messages |
| `src/components/byok/byok-key-form.tsx` | +3 | Removed heygen, added muapi; exported UserSettableProvider type; updated hints |
| `src/middleware/rate-limit-tiers.ts` | +1 | Added `/api/user/byok/*` → RATE_LIMITS.admin (20 req/min) before catch-all |
| `src/app/[locale]/dashboard/byok/page.tsx` | +12 | Added bilingual provider feature map under heading; filter heygen from configured list before passing to form |
| `src/app/api/user/byok/route.test.ts` | +40 | Added 5 new tests; updated GET test to include muapi; fixed 500-path test key to match new format regex |

## P0 Fixes
- **Provider enum**: heygen kept in `ByokProvider` type (DB union — needed by heygen-client.ts/factory.ts). Removed from admin PROVIDERS const in route.ts and form. muapi added to both.
- **Rate-limit rule**: `/api/user/byok/*` → admin tier (20 req/min) inserted before `/api/*` catch-all.

## P1 Fixes
- **Zod field errors**: POST and DELETE now surface `flat.fieldErrors.key?.[0]` / `flat.fieldErrors.provider?.[0]` as `error` string.
- **Key format validation**: superRefine on PostSchema validates per-provider regex patterns.
- **UI hints**: Bilingual provider→feature mapping added to byok page (UX copy only, no logic).

## Tests Added
1. `400 when openrouter key has invalid format` — expects `error: 'Invalid openrouter key format'`
2. `200 when openrouter key has valid format (sk-or-v1-...)` — happy path
3. `200 when muapi key is stored` — muapi happy path
4. `400 when heygen provider is submitted (removed from enum)` — enum rejection
5. Updated GET test: mockList returns muapi in list

## Verification

```
npx tsc --noEmit      → 0 errors in owned files (2 pre-existing errors in heygen/setup files, out-of-scope)
npx vitest run src/app/api/user/byok/     → 15/15 pass
npx vitest run src/middleware/rate-limit-config.test.ts → 29/29 pass
```

## Open Questions
- Pre-existing TS errors in `src/app/api/setup/save/route.ts:55` (`.errors` property on ZodError) and `src/app/api/heygen/api-routes.test.ts:303` — need separate fix by setup/heygen agent owners.
- heygen is still in ByokProvider union so `getUserApiKey(userId, 'heygen')` in heygen-client.ts and factory.ts compiles. If the intent is to fully remove heygen from D1 lookup, those files need updating too (out of scope).
