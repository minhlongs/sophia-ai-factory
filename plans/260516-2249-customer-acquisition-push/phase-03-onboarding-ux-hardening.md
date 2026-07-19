---
title: "Phase 03 — Onboarding UX Hardening (Setup Wizard polish)"
description: "Close handover §8 gotchas: ElevenLabs xi-api-key format validation, D-ID base64 hint, HeyGen async expectation."
status: completed
priority: P0
effort: "Actual ~1.5h (vs ~4-6h estimated — leveraged existing byok-key-form)"
dependencies: []
created: 2026-05-16
completed: 2026-05-17
deployed: 8601fe9a
commits: [8601fe9a]
notes: "Shipped validators lib + 23-case test + form integration + bilingual i18n. HeyGen async hint deferred — no specific blocker found in audit."
---

# Phase 03 — Onboarding UX Hardening

## Context Links

- Handover §8 Known Issues: handover-260516-raas-zero-bug.md
- Setup Wizard component: `src/forest/onboarding/setup-wizard/`

## Overview

- **Priority:** P0 — directly addresses customer-blockers from handover doc
- **Goal:** every BYOK key field validates format inline so customer never sees raw `did_401` / `elevenlabs_401` errors

## Requirements

### Functional

- **ElevenLabs key field:** validate starts with `sk_` (or appropriate prefix per API docs) on blur; reject with hint "ElevenLabs API key starts with sk_ — get it at https://elevenlabs.io/app/settings/api-keys"
- **D-ID key field:** detect raw vs base64-encoded form. D-ID dashboard issues base64-encoded by default. If pasted value looks like email:password format → auto-base64 it client-side before save. Show hint: "D-ID key auto-encoded for you"
- **HeyGen key field:** validate length + character set; hint: "HeyGen render takes 3-10 min — async by design"
- **OpenRouter key field:** validate `sk-or-` prefix
- **NOWPayments key field:** validate UUID format
- All hints bilingual VN+EN
- Setup Wizard step shows "Next step is OPTIONAL" badge for ElevenLabs/D-ID/HeyGen (only OpenRouter is required for basic flow)

### Non-Functional

- Zero regression on Setup Wizard happy path
- Validation runs client-side only (no extra API roundtrip)

## Architecture

```
Setup Wizard step "API Keys"
  → each input has zod-driven onBlur validator
  → inline error + hint with provider doc link
  → save button disabled until all required pass
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/forest/onboarding/setup-wizard/api-keys-step.tsx`
- `apps/sophia-ai-factory/src/forest/onboarding/setup-wizard/byok-key-form.tsx`
- `apps/sophia-ai-factory/messages/en.json` + `vi.json` (`wizard.byok.hint.*` keys)

### Create
- `apps/sophia-ai-factory/src/lib/byok/key-format-validators.ts` (one validator per provider)
- `apps/sophia-ai-factory/src/lib/byok/key-format-validators.test.ts`

## Implementation Steps

1. Validators: zod schemas per provider (regex + length)
2. Auto-base64 helper for D-ID (detects `email:password` pattern)
3. Hint copy in en.json + vi.json (5 providers × 2 langs = 10 keys)
4. Wire validators in `byok-key-form.tsx` with onBlur + inline errors
5. "Optional" badge on non-required provider steps
6. Tests: 5 validator boundary cases + auto-base64 round-trip
7. Deploy + smoke (Phase 05 will reveal remaining friction)

## Todo List

- [ ] 5 validator schemas + tests
- [ ] D-ID auto-base64 helper + test
- [ ] Hint copy 10 keys (en+vi)
- [ ] Wire validators in form
- [ ] Optional badge UI
- [ ] Deploy + verify

## Success Criteria

- 0 customer-reportable "401 from provider" errors in Phase 05 + first-10-customer window
- Validation messages bilingual + actionable (each links to provider docs)
- Setup Wizard completion rate ≥ 80% (Phase 01 measurement)
