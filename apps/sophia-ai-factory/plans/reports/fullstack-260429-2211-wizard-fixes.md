# Wizard Ship-Blocker Fixes — 260429-2211

## Status: COMPLETE

## Files Changed

| File | Change |
|------|--------|
| `src/app/setup-wizard/layout.tsx` | Auth check: `getCurrentUser()` → redirect `/login?redirect=/setup-wizard` if no session |
| `src/app/api/setup/save/route.ts` | Zod refine: require openrouter OR anthropic; set `wizard_done` cookie on success; remove heygen from PROVIDER_MAP; add anthropic |
| `src/app/api/setup/verify/route.ts` | Add `muapi` case (format-check only); add `anthropic` case (sk-ant- prefix check); remove `heygen` case + import |
| `src/app/setup-wizard/page.tsx` | Replace HEYGEN_API_KEY → ANTHROPIC_API_KEY in state; add LLM key guard in handleNext; add saveFailed/onRetry state |
| `src/app/setup-wizard/components/steps/api-keys-step.tsx` | Replace HeyGen field → Anthropic field; update interface |
| `src/app/setup-wizard/components/steps/finish-step.tsx` | Add retry button on saveFailed; bilingual title + subtitle (VI+EN) |
| `src/middleware.ts` | New-user redirect: if auth OK + no `wizard_done` cookie + path === `/dashboard` → redirect `/setup-wizard` |
| `messages/en.json` | Replace `heygen` → `anthropic` in setupWizard.apiKeys |
| `messages/vi.json` | Replace `heygen` → `anthropic` in setupWizard.apiKeys |
| `src/app/api/setup/save/route.test.ts` | +5 tests: 400 empty, 400 no-LLM, 200 openrouter-only, 200 anthropic-only, wizard_done cookie |
| `src/app/setup-wizard/components/steps/api-keys-step.test.tsx` | Updated for anthropic replacing heygen; fixed button index order |

## P0 Status

- [x] Auth check on /setup-wizard (layout.tsx, Server Component)
- [x] Require ≥1 LLM key on save (Zod refine + client-side guard in handleNext)
- [x] Post-signup redirect to wizard (cookie-based: wizard_done cookie set by /api/setup/save; middleware checks on /dashboard)
- [x] MuAPI verify case (format-check only — no public ping endpoint)

## P1 Status

- [x] Retry button on FinishStep save error
- [x] Bilingual FinishStep (VI+EN title, subtitle, retry label)
- [ ] Rate limit on /api/setup/verify — not added (middleware default applies; touching rate-limit-tiers.ts out of scope)

## Verification

```
npx tsc --noEmit  → 0 errors
npx vitest run src/app/api/setup/ src/app/setup-wizard/ → 25/25 passed
```

## Design Decisions

- **wizard_done cookie vs DB query per request**: chose cookie to avoid DB call on every /dashboard/* request. Trade-off: cookie can be deleted by user to re-trigger wizard (acceptable — they land on wizard, can skip to dashboard manually via Settings link).
- **Anthropic placement in step**: kept at same DOM position as heygen was (4th field, after d-id). Render order: openrouter, elevenlabs, d-id, anthropic, muapi.
- **IS_CONFIGURED guard preserved**: verify route still blocks when `IS_CONFIGURED=true` — existing behavior unchanged.

## Open Questions

- None blocking go-live.
- Rate limiting on /api/setup/verify: currently relies on middleware default (see rate-limit-tiers.ts owned by other agent). Should add explicit rule for wizard routes in a follow-up.
