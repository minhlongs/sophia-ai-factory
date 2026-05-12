# Docs Sync Evaluation — Welcome Page i18n Refactor (2026-05-12)

## Executive Summary

**Recommendation: NO updates required.**

The refactor is internal code organization (ternary → translation keys). No architecture changes, no public API shifts, no user-facing behavior changes beyond potential wording adjustments that are invisible to docs.

## Docs Reviewed

| File | LOC | Finding |
|------|-----|---------|
| `code-standards.md` | 470 | Already documents next-intl patterns (Phase 29). No gaps. |
| `code-standards-advanced-patterns.md` | TBD | Covers next-intl Formatter type pattern; not relevant to this refactor. |
| `system-architecture.md` | TBD | Mentions i18n in login flow; welcome page flows not detailed (OK for internal refactor). |
| `project-overview-pdr.md` | TBD | Describes Setup Wizard UX at high level; translation keys are implementation detail. |
| `deployment-guide.md` | TBD | No i18n deployment steps needed. |
| `docs/handover/*.md` | — | Reviewed 5 client-facing docs; none touch welcome flow specifics. |

## Changes Analysis

**What changed:**
1. `messages/vi.json` + `messages/en.json` — extended `welcome.*` namespace (+30 keys, orphaned -4 keys)
2. `welcome-page-client.tsx` — refactored `isVi ? titleVi : titleEn` → `t('welcome.<key>')`
3. `welcome-onboarding-steps.tsx` — dropped `titleVi/descVi/titleEn/descEn` fields; replaced with `StepKey` union
4. `page.tsx` — server metadata uses `getTranslations`

**Impact assessment:**
- **User-visible:** None (same copy, now centralized)
- **Developer-visible:** Code cleaner (single translation key vs. hardcoded pairs)
- **Architecture:** No change (still next-intl client + server rendering)
- **API contracts:** No public API touched
- **Handover flows:** None (welcome page is internal onboarding)

## Decision Per Doc

### code-standards.md
- Already documents "Return user-friendly error messages to the UI"
- Already references next-intl in Phase 29 (Formatter type pattern)
- No explicit "translation key naming" section, but not needed:
  - Pattern is `welcome.steps.<stepKey>.<field>` — self-documenting
  - Developers follow existing hierarchy already established in login (`auth.signup.*`)
- **Action: SKIP**

### code-standards-advanced-patterns.md
- Phase 29 covers next-intl Formatter type safety (unaffected by this refactor)
- No new pattern introduced (just standardizing key usage across components)
- **Action: SKIP**

### system-architecture.md
- Describes high-level flows (/setup-wizard, /welcome)
- Translation keys are implementation detail, not architecture
- **Action: SKIP** (update not justified)

### project-overview-pdr.md
- "Zero-Code Setup" describes the Wizard's goal; doesn't enumerate i18n
- Translation strategy not part of product-level PDR
- **Action: SKIP**

### handover docs (client-facing)
- No welcome page runbooks for FREE100 partners
- i18n translations are transparent to partners (bilingual UI auto-adapts)
- **Action: SKIP**

## Standards Already in Place

From `code-standards.md` + codebase grep:

```typescript
// ✅ Already standardized pattern:
const t = useTranslations('welcome');  // Namespaced from messages/*.json
t('steps.accountCreated.title');       // Dot notation, hierarchy preserved
t('steps.firstSop.installedPrefix', { count: 3 });  // Interpolation support
```

The refactor **conforms** to this standard, no docs clarification needed.

## Unresolved Questions

None. The refactor is self-contained.

---

**Report date:** 2026-05-12 06:33 PT
**Docs manager:** Haiku 4.5
