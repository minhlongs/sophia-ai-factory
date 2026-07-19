---
phase: 3
title: "Setup Wizard + Dashboard Shell"
status: in_progress
effort: "3-4h"
dependsOn: "Phase 1 (P0 Screen Prompts & Amber Update)"
blocks: ["Phase 4: Integration Test & Deploy Readiness"]
---

# Phase 3: Setup Wizard + Dashboard Shell

## Overview

Generate and integrate the 2 most critical P0 screens. The **Setup Wizard** is Protected Flow #1 — must preserve all existing API routes, server actions, and the 5-step BYOK onboarding flow. The **Dashboard Shell** is the primary application frame — sidebar navigation, KPI cards, header bar.

These two screens share the dashboard layout context but modify different files — can run sequentially (Wizard first, then Shell) or in parallel with careful coordination.

## Prerequisites

- Phase 1 complete: amber-updated Setup Wizard prompt (#11) exists, dashboard prompts (#3+#4) updated
- Phase 0 complete: amber design tokens
- Understanding of Protected Flow #1 constraints (see below)

---

## CRITICAL: Protected Flow #1 — Setup Wizard Constraints

The Setup Wizard is Protected Flow #1 per `sophia-handover-rules.md`. Any breakage here **blocks production deployment**.

### Must Preserve
1. **5-step stepper**: Welcome → System Check → AI Keys → Provider Credentials → Review & Finish
2. **API routes** (do not modify):
   - `POST /api/setup/verify` — validates individual API keys with latency measurement
   - `POST /api/setup/save` — persists config (OpenRouter, Anthropic, ElevenLabs, D-ID)
   - `POST /api/setup-wizard/test-heygen` — validates HeyGen key
   - `POST /api/setup-wizard/test-resend` — validates Resend key
   - `POST /api/setup-wizard/save-credentials` — persists provider credentials
   - `GET /api/setup-wizard/list-credentials` — lists saved credentials
3. **Server action**: `completeOnboardingAction` from `@/app/actions/complete-onboarding-action`
4. **BYOK fields**: OpenRouter API Key, Anthropic API Key, ElevenLabs API Key, D-ID API Key, MUAPI Key, HeyGen API Key, Resend API Key, NOWPayments API Key, HeyGen Webhook Secret
5. **localStorage persistence**: step number only (never raw API keys) — `WIZARD_STORAGE_KEY = 'sophia-wizard-state-v2'`
6. **Validation flow**: key validation → status indicators (idle/validating/valid/invalid) → error messages
7. **Retry logic**: 3-attempt save with exponential backoff
8. **Auto-complete**: MASTER users with all 3 milestones done → auto-redirect to dashboard
9. **Tier-aware**: MASTER users → post-activation milestones check; all others → straight to wizard
10. **Bilingual**: all error messages, labels, tooltips in VN+EN

### What CAN Change (visual only)
- Color theme: indigo → amber primary
- Font system: existing fonts OK (Inter, IBM Plex Sans)
- Card styling: rounded-lg, amber borders
- Button styles: amber-filled primary buttons
- Status dots: green (configured) / red (missing) — color scheme preserved
- Stepper visual: amber active step indicator
- Background: maintain dark #0F0F11

---

## Screen 4: Setup Wizard (NEW Stitch prompt #11)

| Attribute | Value |
|-----------|-------|
| Prompt Source | `prompts-stitch-screens.md` #11 (NEW, created in Phase 1) |
| Target Route | `src/app/[locale]/dashboard/onboarding/page.tsx` |
| Client Component | `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` |
| Step Components | `src/tree/components/setup-wizard/steps/*` |
| Stepper | `src/tree/components/setup-wizard/wizard-stepper.tsx` |

### Current Architecture
- **Server page** (`page.tsx`): auth gate → resolve tier → MASTER auto-complete check → render `<WizardClient />`
- **Client component** (`wizard-client.tsx`): 509 lines, manages all wizard state, API calls, save/retry logic
- **Step components**: `welcome-step.tsx`, `system-check-step.tsx`, `api-keys-step.tsx`, `provider-credentials-step.tsx`, `review-step.tsx`
- **Stepper**: `wizard-stepper.tsx` — visual progress indicator

### Steps

#### A: Generate Stitch Screen
1. Paste Setup Wizard prompt #11 into stitch.withgoogle.com
2. Generate Desktop High-Fidelity screen
3. Export HTML → save to `reports/setup-wizard.html`
4. Review: all 5 steps visible, all input fields present, amber theme applied

#### B: Convert to Next.js Components
5. Extract Stitch layout structure: stepper bar, content panel (per-step), action bar (Back/Next/Save)
6. Create `src/components/stitch/screens/onboarding/` directory
7. Create wrapper component: `onboarding-wizard-shell.tsx` — provides the amber-themed card layout + stepper visual
8. Apply amber color tokens:
   - Active step: `bg-[#D97706]` / `bg-amber-600`
   - Completed step: `text-amber-500` checkmark
   - Input focus: `ring-amber-500`
   - Primary buttons: `bg-[#D97706] hover:bg-amber-700`
   - Status valid: green-500, invalid: red-500 (preserved)
   - Error banner: `bg-red-500/10 border-red-500/20 text-red-400`

#### C: Wire into Existing Wizard Client
9. **CRITICAL**: Do NOT modify `wizard-client.tsx` logic. Only change the visual wrapper.
10. Wrap existing `<WizardClient />` in the new Stitch shell component from `onboarding/page.tsx`
11. Or: update inline classes in `wizard-client.tsx` — replace `bg-primary` → `bg-[#D97706]`, `text-primary` → `text-amber-600`, `bg-muted/50` → `bg-[#0F0F11]`, etc.
12. Update step components (`welcome-step.tsx`, `system-check-step.tsx`, `api-keys-step.tsx`, `provider-credentials-step.tsx`, `review-step.tsx`) — amber theme for icons, borders, status indicators
13. Update `wizard-stepper.tsx` — amber active step, amber completed checkmark

#### D: i18n
14. All wizard text already uses `useTranslations('setupWizard')` — no namespace change needed
15. Update `messages/en.json` → `setupWizard` namespace only if new visual labels added
16. Update `messages/vi.json` → `setupWizard` namespace with Vietnamese equivalents

#### E: Verify
17. `npm run type-check` → 0 errors
18. Manual test flow:
    - Visit `/dashboard/onboarding` as unauthenticated → redirect to `/login`
    - Visit as authenticated new user → see step 1 (Welcome)
    - Complete all 5 steps → configure valid OpenRouter key → validate → green checkmark
    - Enter invalid API key → see red X + error message
    - Save → redirect to `/dashboard`
    - Re-visit `/dashboard/onboarding` after save → auto-redirect to `/dashboard`
19. MASTER auto-complete: user with all 3 milestones done → auto-complete + redirect to `/dashboard`

### Key Files
| File | Action |
|------|--------|
| `src/app/[locale]/dashboard/onboarding/page.tsx` | UPDATE — add Stitch shell wrapper (logic preserved) |
| `src/app/[locale]/dashboard/onboarding/wizard-client.tsx` | UPDATE — visual classes only (logic preserved) |
| `src/tree/components/setup-wizard/wizard-stepper.tsx` | UPDATE — amber active step |
| `src/tree/components/setup-wizard/steps/*.tsx` | UPDATE — amber theme |
| `src/components/stitch/screens/onboarding/` | CREATE — Stitch shell + wrappers |
| `messages/en.json` → `setupWizard` | MAY UPDATE if new labels |
| `messages/vi.json` → `setupWizard` | MAY UPDATE Vietnamese |

---

## Screen 5: Dashboard Shell + Overview

| Attribute | Value |
|-----------|-------|
| Prompt Source | `prompts-stitch-screens.md` #3 (Dashboard Shell) + #4 (Dashboard Overview), amber-updated |
| Target Route | `src/app/[locale]/dashboard/page.tsx` (overview) |
| Layout | `src/app/[locale]/dashboard/layout.tsx` (shell) |

### Current Architecture
- **Shell** (`layout.tsx`): sidebar 240px (brand, tier badge, nav, quota widget, health, sign-out) + header + main content
- **Sidebar nav**: `DashboardSidebarNav` from `@/forest/components/dashboard/dashboard-sidebar-nav`
- **Overview** (`page.tsx`): auth gate, tier resolve, D1 queries, conditional rendering:
  - First-time: `DashboardSetupSteps`
  - Returning: `DashboardReturningUser`
  - Zero-run: `DashboardFirstCampaignCta`
  - MASTER: `OnboardingTourModal`, `MasterWelcomeBanner`, `OnboardingStatusWidget`
- **KPI components**: `MissionControlWidget`, `OnboardingStatusWidget`, `LocalSetupGuide`

### Steps

#### A: Generate Stitch Screen
1. Paste Dashboard Shell prompt #3 + Overview prompt #4 into stitch.withgoogle.com
2. Generate as a combined single screen (shell frame + overview content)
3. Export HTML → save to `reports/dashboard-shell-overview.html`

#### B: Convert Shell Layout
4. Create `src/components/stitch/screens/dashboard/dashboard-shell.tsx` — sidebar + header frame
5. Apply amber theme:
   - Active nav item: `border-l-2 border-amber-500 bg-amber-500/10`
   - Logo "Sophia" with amber dot: `<span className="text-amber-500">.</span>`
   - Sidebar: `bg-[#18181B]` surface, `bg-[#0F0F11]` background
   - KPI cards: `border-zinc-800` border, amber accent on progress bars
6. Wire existing sidebar nav content (`DashboardSidebarNav`) into Stitch frame
7. Preserve: tier badge, quota widget, health indicator, sign-out button, upgrade CTA

#### C: Convert Overview Content
8. Create `src/components/stitch/screens/dashboard/dashboard-overview.tsx` — KPI cards + charts + recent campaigns
9. Apply amber theme to KPI cards:
   - Active Campaigns number: white 32px/700
   - Progress bar: amber fill
   - Mini-chart: amber line
   - Quick Actions: amber accent border on "Create Campaign" card
10. Preserve: all conditional rendering logic from `page.tsx` (first-time vs returning vs zero-run vs MASTER)
11. The Dashboard page logic must remain **unchanged** — only the visual wrapper changes

#### D: Route Integration
12. In `layout.tsx`: replace inline sidebar with `<DashboardShell>` wrapper
13. In `page.tsx`: wrap content in `<DashboardOverview>` component
14. All auth gates, D1 queries, tier resolution, conditional rendering logic **MUST remain unchanged**
15. `export const dynamic = 'force-dynamic'` must be preserved

#### E: i18n
16. Most dashboard text already uses `useTranslations('dashboard')` — no namespace change
17. Add new i18n keys only for new visual labels (e.g., KPI card labels, quick action titles)
18. Bilingual VN+EN for all new keys

#### F: Verify
19. `npm run type-check` → 0 errors
20. `npm run build` → 0 errors
21. Manual test:
    - Visit `/dashboard` as authenticated user → sidebar renders, KPI cards render
    - Visit as new user (no onboarding) → setup steps show
    - Visit as MASTER → onboarding tour modal, welcome banner
    - Sidebar nav links work (Campaigns, Videos, Analytics, Billing, Settings)
    - Mobile: hamburger menu works (MobileNav)
    - Theme toggle works (light/dark — though we're dark-only)

### Key Files
| File | Action |
|------|--------|
| `src/app/[locale]/dashboard/layout.tsx` | UPDATE — wrap in Stitch shell (preserve all logic) |
| `src/app/[locale]/dashboard/page.tsx` | UPDATE — wrap content in Stitch overview (preserve all logic) |
| `src/components/stitch/screens/dashboard/dashboard-shell.tsx` | CREATE |
| `src/components/stitch/screens/dashboard/dashboard-overview.tsx` | CREATE |
| `src/forest/components/dashboard/dashboard-sidebar-nav.tsx` | MAY UPDATE — amber active state |
| `messages/en.json` → `dashboard` | MAY UPDATE new labels |
| `messages/vi.json` → `dashboard` | MAY UPDATE Vietnamese |

---

## Sequential Execution Strategy

Setup Wizard and Dashboard Shell share the dashboard layout context but modify different files. Recommended sequence:

1. **Setup Wizard first** (higher risk — Protected Flow #1)
   - Generate, convert, wire, verify
   - Full manual test of onboarding flow
2. **Dashboard Shell second** (lower risk — visual wrapper only)
   - Generate, convert, wire, verify
   - Test all dashboard pages render correctly

Can also run in parallel if subagents coordinate on:
- `layout.tsx` — Dashboard Shell owns this
- `page.tsx` + `onboarding/page.tsx` — Setup Wizard owns these
- No actual file overlap

---

## Success Criteria

- [ ] Setup Wizard Stitch HTML generated and saved
- [ ] Setup Wizard amber theme applied, all 5 steps functional
- [ ] Setup Wizard API routes preserved (verify/save/test-heygen/test-resend/save-credentials/list-credentials)
- [ ] Setup Wizard manual test: new user onboarding completes, redirects to /dashboard
- [ ] Setup Wizard MASTER auto-complete redirects correctly
- [ ] Dashboard Shell Stitch HTML generated and saved
- [ ] Dashboard Shell amber theme applied — sidebar, header, KPI cards
- [ ] Dashboard all conditional rendering preserved (first-time, returning, zero-run, MASTER)
- [ ] Both screens: bilingual VN+EN
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes with 0 errors
- [ ] Zero Protected Flow #1 breakage

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wizard API routes break during visual update | Low | Critical | Only change CSS classes, never logic. Verify each step's API calls after conversion. |
| Dashboard conditional rendering breaks | Medium | High | Keep `page.tsx` logic untouched. Only wrap content component. |
| Stitch Setup Wizard prompt misses fields | Medium | High | Cross-reference wizard-client.tsx for exact field list before generating. Use prompt #11 validated in Phase 1. |
| Amber contrast on dark background insufficient | Low | Low | #D97706 on #0F0F11 passes WCAG AA at 4.6:1. Test with actual rendered output. |

## Rollback Plan

If Setup Wizard breaks:
1. `git checkout -- src/app/[locale]/dashboard/onboarding/ src/tree/components/setup-wizard/`
2. Fix the visual wrapper — do NOT touch logic files
3. Re-verify with manual test

If Dashboard Shell breaks:
1. `git checkout -- src/app/[locale]/dashboard/layout.tsx src/app/[locale]/dashboard/page.tsx`
2. Fix the visual wrapper
3. Re-verify with `npm run build`
