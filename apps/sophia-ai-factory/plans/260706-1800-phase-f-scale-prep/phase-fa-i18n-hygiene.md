---
title: "F-A: i18n + Import Hygiene"
status: completed
priority: P1
effort: 1–2 days
track: F-A
---

# Phase F-A: i18n + Import Hygiene

## Priority: P1 | Est: 1–2d

## Context

Three creator-pages violate the canonical-import rule (`next/link` banned, use `@/navigation`).
One settings page has an i18n namespace mismatch.
Several hardcoded strings lack i18n keys.

## Key Insights

- `src/app/creator/page.tsx:13` — `import Link from 'next/link'`
- `src/app/creator/listings/page.tsx:13` — `import Link from 'next/link'`
- `src/app/creator/settings/page.tsx:13` — `import Link from 'next/link'`
- `src/app/creator/settings/page.tsx:21` — `getTranslations('sop.creator')` for metadata, body uses `marketplace.creator`
- `src/app/creator/settings/settings-form.tsx:127-129` — hardcoded payout-method labels
- `src/app/creator/listings/listings-client.tsx:47,62` — `window.confirm()` dialogs

## Requirements

1. Replace banned `next/link` with canonical `import { Link } from '@/navigation'`
2. Normalize settings metadata namespace to `marketplace.creator`
3. Add i18n keys for: payment-method labels, confirm dialog text, status-color keys

## Files to Modify

- `src/app/creator/page.tsx`
- `src/app/creator/listings/page.tsx`
- `src/app/creator/settings/page.tsx`
- `src/app/creator/settings/settings-form.tsx`
- `src/app/creator/listings/listings-client.tsx`
- `messages/en.json`
- `messages/vi.json`

## Implementation Steps

1. Fix 3 banned `next/link` imports → `@/navigation`
2. Fix namespace mismatch in settings metadata
3. Audit hardcoded strings in creator listings + settings
4. Add missing keys to `messages/en.json` + `messages/vi.json`
5. Wrap hardcoded labels in `t()` calls
6. Run `npm run lint` + `npm test` to verify zero regressions

## Success Criteria

- ESLint `no-restricted-imports` passes on all creator pages
- Zero hardcoded user-facing strings in creator pages
- i18n validate passes (bilingual completeness)
