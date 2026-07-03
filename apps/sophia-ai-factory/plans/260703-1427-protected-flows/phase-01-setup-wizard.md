# Phase 01 — Setup Wizard Visual Update

**Priority:** P0 Critical | **Effort:** 2-3h | **Status:** pending

## Context

The Setup Wizard (`src/tree/components/setup-wizard/`) is the BYOK onboarding gate. It uses Tailwind semantic tokens (`bg-primary`, `text-primary`, `border-primary`) — NOT hardcoded indigo. The color update is a change to CSS custom properties in the global stylesheet, with per-component tweaks for amber accent tones.

## What Changes

1. **Global CSS variables** — Change `--primary` from indigo (#6366F1) to amber (#D97706)
2. **Wizard-specific amber accents** — Buttons, stepper active/completed states, focus rings, links
3. **Card/dialog surfaces** — Ensure `bg-card` / `bg-muted` match the new #18181B design surface
4. **Background** — Ensure `bg-background` resolves to #0F0F11

## What STAYS (Preservation Checklist)

- [ ] All 5 wizard steps: welcome, api-keys, provider-credentials, review, system-check, finish
- [ ] `wizard-stepper.tsx` step navigation logic (currentStep, onNext, onBack)
- [ ] `api-key-input.tsx` validation flow (idle → validating → valid → invalid)
- [ ] API route `/api/setup-wizard/save-credentials` — POST, encrypts keys
- [ ] API route `/api/setup-wizard/list-credentials` — GET, lists saved providers
- [ ] API route `/api/setup-wizard/test-heygen` — POST, tests API connectivity
- [ ] API route `/api/setup-wizard/test-resend` — POST, tests email service
- [ ] API route `/api/setup-wizard/heygen/auto-register` — POST, auto-creates HeyGen account
- [ ] API route `/api/user/byok` — Legacy BYOK endpoint
- [ ] `localStorage` persistence for draft keys
- [ ] Tier-awareness logic (shows appropriate providers per tier)
- [ ] `byok-doctrine-banner.tsx` informational banner
- [ ] i18n keys in `messages/en.json` and `messages/vi.json` (namespace: `setupWizard`)
- [ ] `api-key-input.test.tsx` vitest + `api-keys-step.test.tsx` vitest

## Files to Modify

### Wizard Components (visual changes only)

| File | What changes |
|------|-------------|
| `src/tree/components/setup-wizard/wizard-stepper.tsx` | Completed step circle: `bg-primary` → must render amber. Active step: `border-primary` → amber. Progress bar: `bg-primary` → amber gradient. |
| `src/tree/components/setup-wizard/api-key-input.tsx` | Focus ring `ring-primary` → amber. Confirm button style. Valid status dot `text-primary` → amber. |
| `src/tree/components/setup-wizard/byok-doctrine-banner.tsx` | Border/accent color. Info icon color. |
| `src/tree/components/setup-wizard/steps/welcome-step.tsx` | Feature icon circles `bg-primary/10` → amber tint. "Get Started" button `bg-primary` → amber. |
| `src/tree/components/setup-wizard/steps/api-keys-step.tsx` | Verify button, status indicators. |
| `src/tree/components/setup-wizard/steps/provider-credentials-step.tsx` | Card borders, input focus rings. |
| `src/tree/components/setup-wizard/steps/review-step.tsx` | Status badges, confirm button. |
| `src/tree/components/setup-wizard/steps/system-check-step.tsx` | Progress indicators, checkmark colors. |
| `src/tree/components/setup-wizard/steps/finish-step.tsx` | Success animation, CTA button. |

### Global Theme (if not yet applied)

| File | What changes |
|------|-------------|
| `src/app/globals.css` | CSS custom properties: `--primary`, `--primary-foreground`, `--ring` to amber values |

### Test Files (verify still pass)

| File | Action |
|------|--------|
| `src/tree/components/setup-wizard/api-key-input.test.tsx` | Run, fix if DOM assertions depend on old class names |
| `src/tree/components/setup-wizard/steps/api-keys-step.test.tsx` | Run, fix if needed |

## Implementation Sequence

1. Verify global CSS variables resolve to amber (if Phase 1 redesign already applied, skip; if not, update `globals.css`)
2. Read `wizard-stepper.tsx` — verify semantic token usage, add amber gradient to progress bar if needed
3. Update `wizard-stepper.tsx` — progress bar color, completed/active step styles
4. Read `api-key-input.tsx` — change verify button accent, focus ring
5. Update `api-key-input.tsx` — button hover, focus ring amber
6. Read `byok-doctrine-banner.tsx` — icon, border accent
7. Update `byok-doctrine-banner.tsx` — amber accents
8. Read + update `welcome-step.tsx` — feature cards, CTA button
9. Read + update `api-keys-step.tsx` — verify buttons, check indicators
10. Read + update `provider-credentials-step.tsx` — input focus, card borders
11. Read + update `review-step.tsx` — status badges, confirm button
12. Read + update `system-check-step.tsx` — checkmarks, progress
13. Read + update `finish-step.tsx` — success display, CTA
14. Run `npm test -- src/tree/components/setup-wizard/` — verify unit tests pass
15. Run `npm run build` — verify 0 errors
16. Manual walkthrough: open `/en/setup-wizard` or `/dashboard/onboarding` in dev server
17. Verify: all 5 steps render, stepper shows amber, buttons amber, inputs focus amber
18. Verify: API key input, verify flow, save to localStorage still work
19. Verify: `/vi/setup-wizard` (Vietnamese locale) works identically

## Stitch Prompt for Setup Wizard

The existing `docs/stitch-prompts-remaining-pages.md` lacks a Setup Wizard prompt. If a full Stitch redesign is desired later, use this prompt:

```
Desktop High-Fidelity setup wizard / onboarding flow for Sophia AI Factory — a Next.js 16 SaaS platform for AI video generation with Revenue-as-a-Service BYOK model. Clean, Professional, Modern, SaaS aesthetic. Tonal amber spot accent on neutral base. Dark mode. Background: Deep charcoal (#0F0F11). Primary: Amber (#D97706). Headline font: Inter 28px/700. Body font: Inter 15px/400. Label font: IBM Plex Sans 13px/500. Roundness: 8px. Comfortable spacing.

Centered card layout (max-width 640px, centered vertically and horizontally). Dark surface #18181B card with subtle zinc-800 border, 24px padding, 12px rounding.

Top: Step indicator — horizontal stepper with 5 dots connected by a line: (1) Welcome, (2) API Keys, (3) Providers, (4) Verify, (5) Done. Current step: amber filled dot with ring. Completed step: amber filled dot with checkmark. Future step: grey empty dot. Labels under each dot in 11px/500 grey.

Step 1 content — Welcome:
- Hero icon (Rocket in amber circle, 48px).
- "Welcome to Sophia" 24px/700 white centered.
- "Set up your AI video factory in 5 minutes" 14px/400 grey centered.
- 3 feature cards in a row: (Key icon) "Bring Your Own Keys — Use your own API keys for full control", (Shield icon) "Enterprise Security — Keys encrypted at rest, never shared", (Rocket icon) "Launch Ready — Start generating AI videos immediately". Cards: #18181B, zinc-800 border, 16px padding, 8px rounding.
- "What You Need" box: checkmark list — OpenRouter API key, ElevenLabs key, D-ID or HeyGen key, 5 minutes of your time. Box: muted surface with amber left border.
- "Get Started" → primary amber button, full-width, 48px height, arrow-right icon.

Step 2 content — API Keys:
- "Connect Your AI Services" 24px/700 white.
- Info banner: "Your keys are encrypted and never shared. You can skip any provider and configure it later." Amber left border accent, 14px/400 grey text.
- API key input rows (3 providers):
  OpenRouter (LLM) — key input with show/hide toggle, "Verify" ghost button, status: idle/loading spinner/valid green check/error red X with latency in ms badge.
  ElevenLabs (TTS) — same pattern.
  D-ID / HeyGen (Video Avatar) — same pattern with provider selector dropdown.
- "Continue" → primary amber button, full-width. "Skip for now" ghost link below.

Step 3 content — Provider Credentials:
- "Configure Provider Settings" 24px/700 white.
- Cards per provider: HeyGen template ID input, ElevenLabs voice ID selector, D-ID source URL input.
- Each card: #18181B surface, zinc-800 border, 16px padding, label 13px/500 grey, input 44px height dark surface.
- "Continue" → amber button.

Step 4 content — System Check:
- "Verifying Your Setup" 24px/700 white.
- Progress checklist with animated checkmarks as each provider verifies:
  OpenRouter ✓ (green, 124ms), ElevenLabs ✓ (green, 89ms), HeyGen ⏳ (amber spinner).
- "All Systems Ready" success state with all green checks.
- "Complete Setup" → amber button.

Step 5 content — Finish:
- Large green checkmark in circle (64px).
- "You're All Set!" 28px/700 white.
- "Your AI video factory is ready. Start creating campaigns now." 14px/400 grey.
- "Go to Dashboard" → primary amber button, full-width.
- "Configure More Providers" → ghost button below.

Right sidebar (optional): Progress indicator showing which step is current, with a "Need help?" card at bottom.
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSS variable name conflict with other components | Low | Medium | Wizard uses Tailwind `bg-primary` etc — same as rest of app. If global CSS var change affects other pages, scope wizard-specific overrides. |
| `invert`/dark-mode color inversion | Low | High | Wizard already renders in dark mode. Check `dark:` variants. |
| Unit test DOM assertions break | Medium | Low | Tests check behavior (validation states), not colors. Snapshot update if needed. |
| Stitch prompt is too large for token limits | Low | Low | Prompt is 3500 chars — well under Stitch limits. Split into per-step prompts if needed. |

## Rollback

```bash
git revert <commit-hash>
# All changes are CSS class swaps and token updates. No data migration.
```

## Success Criteria

- [ ] `npm run build` exits 0
- [ ] `npm test -- src/tree/components/setup-wizard/` passes
- [ ] Manual walkthrough: all 5 steps render with amber theme
- [ ] API keys save + verify via existing API routes
- [ ] localStorage persistence works across page refresh
- [ ] Vietnamese locale renders identically
- [ ] Responsive layout: mobile (375px), tablet (768px), desktop (1280px)
