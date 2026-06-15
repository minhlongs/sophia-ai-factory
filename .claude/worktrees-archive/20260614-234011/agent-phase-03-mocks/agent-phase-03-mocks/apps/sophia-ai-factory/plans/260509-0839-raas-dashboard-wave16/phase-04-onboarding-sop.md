# Phase 04 — FREE100 Onboarding + Auto-Install SOP

## Context Links
- Audit: `plans/reports/scout-260509-0839-raas-dashboard-gap.md` §P1.2
- Promo flow: `src/app/api/promo/redeem-free/route.ts:95-221`
- Auto-handover: `src/tree/handover/auto-handover.ts`
- Dashboard root: `src/app/[locale]/dashboard/page.tsx` (line 80 onboarding gate)
- SOP playbooks: `src/lib/sop/seeds/playbooks/` (existing categories: analytics, content, crisis, email, leads, sales, social)

## Overview
- **Priority:** P1.2
- **Status:** done
- **Description:** When FREE100 (MASTER tier, no `onboarding_completed_at`) lands on `/dashboard`, redirect to `/dashboard/onboarding` showing a 3-step guided flow ("create first video"). Auto-install a "Generate & Distribute Video" SOP template during handover so the user has a head start. Replace BYOK setup steps for MASTER tier — they don't need API keys.

## Key Insights
- BYOK wizard (`<DashboardSetupSteps>`) is wrong UX for FREE100 — MASTER tier uses platform-provided keys. Only show BYOK to PREMIUM/ENTERPRISE.
- Existing `onboarding_completed_at` field is the gate; reuse.
- SOP system already has install path (`src/lib/sop/seeds/`); we add 1 new template, not new infra.
- Onboarding page is a 3-step UI: (1) "Generate first video" CTA → links to Phase 01 prompt form, (2) "Connect channels" link → integrations page, (3) "Distribute" preview. No state machine; just static steps with completion checkmarks based on user's data.

## Requirements

### Functional
- New route `/dashboard/onboarding` (locale-prefixed):
  - 3 steps with status (todo / done / current).
  - Step 1: "Create your first video" — done when user has any `engine_missions` row with status=succeeded.
  - Step 2: "Connect a channel" — done when user has any `publishing_channels` row with `connected=true` OR Telegram pairing.
  - Step 3: "Publish your first video" — done when user has any `publishing_jobs` with status=live.
  - "Skip onboarding" link → sets `onboarding_completed_at = now()` and redirects to `/dashboard`.
  - All-3-done auto-sets `onboarding_completed_at` and shows "Go to dashboard" CTA.
- `/dashboard` page modification:
  - If `tier === 'MASTER' && !onboarding_completed_at`: redirect to `/dashboard/onboarding`.
  - If `tier !== 'MASTER' && !onboarding_completed_at`: keep existing BYOK setup steps (unchanged).
- Auto-install SOP: when promo handover runs (`triggerAutoHandover` in `auto-handover.ts`), insert row in `user_sop_installations` with the new "video-generation-starter" template ID.
- New SOP template file: `src/lib/sop/seeds/playbooks/content/video-generation-starter.ts` (placed under `content/` since social already exists; pick best fit per existing convention).

### Non-Functional
- File <200 LOC.
- Locale-aware (en + vi).
- No flash-of-wrong-content: redirect happens server-side.

## Architecture
```
[Promo redeem] /api/promo/redeem-free
   └─ applyPromoCode → triggerAutoHandover
                          └─ (NEW) install-starter-sop.ts: insert user_sop_installations
                          └─ existing: send magic link

[Magic link] /dashboard
   ├─ getUserTier(user.id) === 'MASTER' ?
   │    yes + !onboarding_completed_at → redirect /dashboard/onboarding
   │    yes + onboarding done → render normal dashboard
   │    no  → existing flow (BYOK steps)

/dashboard/onboarding/page.tsx (server)
   └─ load: missions count succeeded, channel count, publish count
   └─ render <OnboardingSteps {...status}/>
        └─ Step CTAs link to /dashboard/videos/new, /dashboard/integrations/channels, etc.
```

Layer placement:
- SOP seed → `src/lib/sop/seeds/playbooks/content/video-generation-starter.ts` (existing convention).
- Auto-install helper → `src/tree/handover/install-starter-sop.ts` (~50 LOC).
- Onboarding page → app router; client interactivity minimal (server-rendered, only "skip" button is client).

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/page.tsx` — add MASTER-tier redirect to onboarding.
- `src/tree/handover/auto-handover.ts` — call new `installStarterSop(userId)` after user creation.

### Create
- `src/lib/sop/seeds/playbooks/content/video-generation-starter.ts` (~80 LOC) — template definition (id, title, steps array).
- `src/tree/handover/install-starter-sop.ts` (~50 LOC) — D1 insert into `user_sop_installations`.
- `src/app/[locale]/dashboard/onboarding/page.tsx` (~120 LOC) — server component, load status + render.
- `src/app/[locale]/dashboard/onboarding/components/onboarding-steps.tsx` (~150 LOC) — UI: step cards.
- `src/app/[locale]/dashboard/onboarding/components/skip-button.tsx` (~40 LOC) — client component, server action to set timestamp.
- `src/app/actions/complete-onboarding-action.ts` (~40 LOC) — server action.
- `src/tree/handover/__tests__/install-starter-sop.test.ts`
- `src/app/[locale]/dashboard/onboarding/__tests__/page.test.tsx`

## Implementation Steps
1. Read existing SOP template format: `cat src/lib/sop/seeds/playbooks/social/<one>.ts` to mirror convention.
2. Create `video-generation-starter.ts` template:
   - `id: 'video-generation-starter'`
   - `title: 'Generate & Distribute Your First AI Video'` (en) / vi equivalent
   - Steps: prompt input → generation → channel connect → distribute → review.
   - Must conform to existing SOP type interface (whatever `lib/sop/types.ts` declares).
3. Create `install-starter-sop.ts`:
   - Input: `userId, tenantId`.
   - Insert into `user_sop_installations` (or whatever table name from SOP system) with template_id, installed_at.
   - Idempotent (skip if already installed).
4. Hook into `auto-handover.ts`: after user record created, call `installStarterSop(userId, tenantId)`. Failures log+continue (non-blocking).
5. Modify `dashboard/page.tsx`:
   - After `getUserTier(user.id)`, if `tier === 'MASTER' && !onboarding_completed_at` → `redirect(localizedHref(locale, '/dashboard/onboarding'))`.
6. Build `onboarding/page.tsx`:
   - Auth gate.
   - Parallel D1 queries: count missions succeeded, count connected channels (incl. Telegram), count live publishes.
   - Compute step statuses.
   - Render `<OnboardingSteps step1Done step2Done step3Done />`.
   - If all 3 done → also call `completeOnboarding()` server action.
7. Build `onboarding-steps.tsx`: step cards with Material icons, CTA buttons linking to existing routes.
8. Build `skip-button.tsx` + server action `complete-onboarding-action.ts`: update `user_profiles.onboarding_completed_at`.
9. i18n: all step labels, descriptions, CTAs, skip text (en + vi).
10. Tests: install helper unit, page render integration, e2e (FREE100 redeem → land on onboarding → skip → dashboard).
11. `npm run build`, `npm test`, deploy + SHA verify.

## Todo List
- [x] Inspect existing SOP template format (`lib/sop/types.ts` + 1 example)
- [x] Create `video-generation-starter.ts` template
- [x] Create `install-starter-sop.ts` (idempotent insert)
- [x] Wire into `auto-handover.ts` post-user-creation
- [x] Modify `dashboard/page.tsx` MASTER-tier redirect
- [x] Create `onboarding/page.tsx` server component
- [x] Create `onboarding-steps.tsx` UI
- [x] Create `skip-button.tsx` + server action
- [x] i18n keys (en + vi)
- [x] Unit test: install helper idempotent
- [x] Integration test: page renders correct step status
- [ ] e2e: FREE100 → onboarding redirect → skip → dashboard (deferred)
- [x] `npm run build` clean (exit 0)
- [x] `npm test` all pass (2980/2980 passing)
- [ ] Deploy + SHA-match verify (coordinator handles)

## Success Criteria
- FREE100 user clicks magic link → lands on `/dashboard/onboarding` (NOT BYOK steps).
- 3 steps shown with accurate status reflecting user's actual data.
- "Skip" sets timestamp; future visits go straight to dashboard.
- SOP template installed for user (visible in `/dashboard/sops`).
- PREMIUM/ENTERPRISE flow unchanged (BYOK steps still appear).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SOP template type interface unknown | M | M | Step 1 inspects existing files first. |
| `onboarding_completed_at` updates fail silently | L | M | Server action returns success/error; UI surfaces toast. |
| Existing user (pre-Wave 16) marked as MASTER without timestamp | M | M | Migration: backfill `onboarding_completed_at = created_at` for all existing users on deploy. |
| Redirect loop if onboarding page itself fails to load | L | H | Add try-catch; fallback to dashboard with error banner. |
| Auto-install triggers for non-promo MASTER (paid) users | M | L | Check inside `triggerAutoHandover` only — paid signups go through different path. |

## Security Considerations
- Onboarding page requires auth; redirect to login if not.
- Skip action verifies userId from session; never trusts URL/form input for userId.
- Step status queries are scoped to `user_id = current_user.id`.
- No promo code or sensitive data in onboarding URL params.

## Next Steps
- Wave 17: richer onboarding (interactive video walkthrough, progress saved across sessions).
- Wave 17: dynamic SOP recommendations based on tier + behavior.

## Completion Notes

**Critical Bugs Fixed (Wave 16.1 code review 2026-05-09):**
- **Bug 3 (Migration 0098):** Column camelCase corrected. Timestamps: ISO string → unix-ms conversion. Migration rewritten to match D1 schema.
- **M4 updateError Inspection:** Error handling in `complete-onboarding-action.ts` now properly surfaces DB update failures.
- **M5 Redundant revalidatePath:** Noted; kept for cache consistency across tier redirect.

**Files Created (7 + 7 tests):**
- `video-generation-starter.ts` (~80 LOC) — SOP template definition
- `install-starter-sop.ts` (~50 LOC) — D1 insert helper (idempotent)
- `onboarding/page.tsx` (~120 LOC) — server component, load + render
- `onboarding-steps.tsx` (~150 LOC) — UI step cards
- `skip-button.tsx` (~40 LOC) — client component
- `complete-onboarding-action.ts` (~40 LOC) — server action
- migration `0098_add_onboarding_timestamp.sql` — adds `onboarding_completed_at`
- + 7 test files

**Build Status:** `npm run build` clean (0 TS errors). `npm test` 2980/2980 pass.

## Unresolved Questions
- (resolved in implementation) Column `onboarding_completed_at` is `INTEGER` unix-ms. Backfill deferred to Wave 17 cleanup.

## Next Steps
- Deploy phase-01 + phase-04 together via `npm run deploy:full`.
- Phase 02 + 03 (distribution + Telegram) deferred to next session.
