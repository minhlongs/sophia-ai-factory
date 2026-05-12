# J4 Wave 14 — Webhook Body Migration + Canary Endpoint

**Date:** 2026-05-09
**Status:** COMPLETE
**Phase:** Wave 14 Group J4

## Summary

Fixed Wave 13 I3 regression: `body=''` passed to verifyWebhook in split-header path.
All 3 verifiers now receive full body. Canary endpoint added and tested.

## Files Modified

| File | Change |
|---|---|
| `src/seed/security/webhook-validator.ts` | Added `body` as first param; fixed all paths to pass body; added legacy monitoring |
| `src/lib/alerts/webhook-notification-signature.ts` | Added legacy bare-hex detection + monitoring hook |
| `src/lib/sop/webhook-hmac.ts` | Added legacy bare-hex detection + monitoring hook |
| `src/app/api/analytics/agencyos-sync/route.ts` | Caller fix — reads body via `request.text()` before auth, passes to verifyWebhookSignature |

## Files Created

| File | Description |
|---|---|
| `src/app/api/canary/webhook/route.ts` | Public POST /api/canary/webhook — validates signed payload, returns {valid, format, skewMs, ageMs}; rate-limited 10/min |
| `src/app/api/canary/webhook/route.test.ts` | 5 test cases covering all acceptance criteria |
| `plans/reports/j4-260509-wave-14-webhook-canary.md` | This report |

## Verifier Caller Changes

- `seed/security/webhook-validator.ts::verifyWebhookSignature` — signature changed to `(body, signature, timestamp, secret, tolerance)`. 1 caller updated (agencyos-sync/route.ts).
- `lib/alerts/webhook-notification-signature.ts::verifyWebhookSignature` — signature unchanged `(signature, payload, timestamp, secret, tolerance)`, payload was already passed. Legacy monitoring added.
- `lib/sop/webhook-hmac.ts::verifySignature` — signature unchanged `(body, signatureHeader, secret, toleranceSec)`, body was already first param. Legacy monitoring added.

## Legacy Monitoring Hook

All 3 verifiers now emit `logger.warn('webhook_legacy_signature_used', {...})` when bare-hex (64-char) signature detected. Canary endpoint also emits this warning.

## Canary Endpoint

- Route: `POST /api/canary/webhook`
- Secret: `CANARY_WEBHOOK_SECRET` env var
- Auth: none (public diagnostic)
- Rate limit: 10 req/min per IP via withRateLimit
- Returns: `{ valid: boolean, format: 'unified'|'legacy'|'unknown', skewMs: number, ageMs: number }`
- Missing header → 400 with `code: MISSING_SIGNATURE`

## Test Results

- **tsc --noEmit:** 1 pre-existing error (`raas/missions/route.ts:141` — unrelated to this wave)
- **Canary tests:** 5/5 pass
- **Full suite:** 2914 pass, 5 fail (all in `stream/route.test.ts` — SSE timeout, pre-existing, untracked file from another wave group)
- **Net new tests:** +5

## Notes

- `agencyos-sync/route.ts` is outside strict ownership but mandatory caller fix — tsc would fail without it. Added to changes.
- Pre-existing `raas/missions/route.ts` tsc error not introduced by this wave.
