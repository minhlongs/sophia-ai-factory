# Phase 03 — `/onboarding` 3-Step Resumable Flow

## Context Links
- `apps/sophia-ai-factory/src/app/[locale]/welcome/[token]/page.tsx` — magic-link landing (existing)
- `apps/sophia-ai-factory/src/app/api/welcome/status/route.ts` — milestone status endpoint (existing)
- `apps/sophia-ai-factory/src/lib/handover/handover-types.ts` — `customer_first_login_at`, `customer_first_sop_install_at`, `customer_first_run_at`

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 60m

After magic-link consumes token + creates session, redirect to `/onboarding`. Three steps, each persisted as a milestone in `customer_handovers` so user can leave + resume on any device. Final step demos a real API call so user sees "it works" before hitting dashboard.

## Key Insights
- D1 already tracks 3 milestones in `customer_handovers` (login, sop_install, run) — repurpose as onboarding steps
- `welcome/status` endpoint returns these — use as resumability source of truth
- Step 3 ("first run") = trigger a sample API call against `/api/v1/agent-chat` and stream result inline; that completes onboarding

## Requirements
- 3 steps: **API connectivity check** → **API key issued** (Phase 04) → **first call demo**
- Resumable: returning user lands on first incomplete step
- Skippable advanced fields, but core 3 not skippable
- i18n vi/en
- Mobile responsive

## Architecture
```
/[locale]/onboarding/page.tsx      Server Component — auth gate, fetch /api/welcome/status, route to step
/[locale]/onboarding/onboarding-stepper.tsx     Client Component — progress bar + step renderer
/[locale]/onboarding/steps/
  step-1-connectivity-check.tsx    pings /api/health, shows latency, marks complete
  step-2-issue-api-key.tsx         calls /api/v1/api-keys/create (Phase 04 scope), shows key once
  step-3-first-call-demo.tsx       form → POST /api/v1/agent-chat with streaming response
```

State sync:
- Each step on completion → `POST /api/welcome/milestone` (NEW) with `{step: 'connectivity'|'api_key'|'first_run'}`
- Server updates corresponding `customer_first_*_at` column

## Related Files
**Create:**
- `src/app/[locale]/onboarding/page.tsx`
- `src/app/[locale]/onboarding/onboarding-stepper.tsx`
- `src/app/[locale]/onboarding/steps/step-1-connectivity-check.tsx`
- `src/app/[locale]/onboarding/steps/step-2-issue-api-key.tsx`
- `src/app/[locale]/onboarding/steps/step-3-first-call-demo.tsx`
- `src/app/api/welcome/milestone/route.ts` — POST handler with zod
- `src/app/[locale]/onboarding/onboarding-strings.ts` — i18n keys
- `messages/en.json` + `messages/vi.json` — onboarding namespace

**Modify:**
- `src/app/api/welcome/validate/[token]/route.ts` — POST returns `redirectTo: '/onboarding'` (currently lands on dashboard)
- `src/components/dashboard/handover-onboarding-banner.tsx` — link "Continue setup" → `/onboarding`

## Implementation Steps
1. Wire route + auth: server component reads session, calls internal `getHandoverStatus(userId)`, computes nextStep
2. Stepper UI: 3 dots + active step body; disable Continue until step `done`
3. Step 1: `useQuery(['health'])` → show OK/latency, auto-mark complete after 2s
4. Step 2: button "Generate API key" → call `/api/v1/api-keys/create`, show key in copy-once panel, ack toggles complete
5. Step 3: chat-style form, POST `/api/v1/agent-chat` (existing), render streaming text; first chunk received → mark complete
6. Milestone endpoint: zod validate `{step}`, lookup user, UPDATE customer_handovers SET customer_first_<x>_at = strftime('%s','now')*1000 WHERE customer_user_id = ?
7. After step 3 → "Open dashboard" CTA → `/dashboard`
8. i18n: add `onboarding.step1.title|desc`, `onboarding.step2.*`, `onboarding.step3.*`, `onboarding.completed`

## Todo
- [ ] Server page + auth gate
- [ ] Stepper UI (responsive)
- [ ] Step 1 connectivity
- [ ] Step 2 API key issue (uses Phase 04 endpoint)
- [ ] Step 3 first call demo
- [ ] `POST /api/welcome/milestone` with zod
- [ ] i18n vi + en
- [ ] Resumability verified (close tab → reopen → land on incomplete step)

## Success Criteria
- Fresh user clicks magic-link → redirected to `/onboarding` step 1
- Returning user with step 1 done → lands on step 2 directly
- All 3 steps complete → CTA opens dashboard
- Mobile screen 375px width: no overflow

## Risk Assessment
- **Step 3 streaming may fail on Cloudflare Workers** if response is full-buffer — verify `/api/v1/agent-chat` supports `Transfer-Encoding: chunked`
- **Magic-link redirect change** could break existing flows — keep `?next=` param honored

## Security Considerations
- Milestone endpoint requires Better Auth session (no public POST)
- Zod input validation: step ∈ {`connectivity`, `api_key`, `first_run`}
- CSRF protection via existing CSRF middleware

## Next
Phase 04 builds the API key endpoint that Step 2 calls.
