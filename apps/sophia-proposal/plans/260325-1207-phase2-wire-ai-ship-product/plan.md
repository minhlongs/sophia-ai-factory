# Phase 2: Wire Real AI → Ship Product

**Status**: In Progress
**Created**: 2026-03-25
**Branch**: claude/setup-sophia-proposal-app-fo7IH

## Context
Sprint 1 complete: 18 commands, 205 tests, 0 `:any`, health + CF Analytics. All 17 commands already wired to real AI via `llmGenerate()` with graceful fallbacks.

## Gap Analysis (Post-Scout)

| Gap | Impact | Track |
|-----|--------|-------|
| No model routing per command (all use default) | Cost optimization missing | 1 |
| No token usage tracking to D1 | Can't bill accurately | 1 |
| `sendMagicLink` doesn't send email | Auth broken | 2 |
| No `/api/auth/callback` route | Magic link flow incomplete | 2 |
| No middleware for `/dashboard/*` | Auth not enforced | 2 |
| SSE only polls D1, no Claude streaming | Bad UX for long missions | 3 |
| No "New Mission" form in dashboard | Can't create from UI | 3 |
| No daily usage chart | Limited visibility | 3 |

## Phases

### Phase 1: AI Model Routing + Token Tracking (Track 1) — `in_progress`
- [x] Create `lib/ai/model-routing.ts` with per-command model + maxTokens config
- [x] Add `model` param to `llmGenerate()` in `llm-router.ts`
- [x] Thread model selection through all AI generators
- [x] Add token usage tracking after AI calls

### Phase 2: Email Auth + Magic Link (Track 2) — `in_progress`
- [x] Wire `sendMagicLink` in `lib/db/auth.ts` to send via Resend
- [x] Create `app/api/auth/callback/route.ts` for magic link verification
- [x] Create `middleware.ts` to protect `/dashboard/*` routes

### Phase 3: SSE Streaming + Dashboard Polish (Track 3) — `in_progress`
- [x] Add Claude token streaming to SSE endpoint
- [x] Add "New Mission" form component
- [x] Add daily usage bar chart to usage dashboard

### Phase 4: Verification — `pending`
- [ ] `npm run type-check && npm run build` passes
- [ ] `npm test` passes (target 215+)
- [ ] Commit and push

## File Ownership (No Conflicts)

| Track | Owns |
|-------|------|
| 1 | `lib/ai/model-routing.ts` (NEW), `lib/ai/llm-router.ts`, `lib/ai/claude-proposal-generator.ts`, `lib/ai/claude-sales-intelligence.ts`, `lib/ai/lead-hunter.ts` |
| 2 | `lib/db/auth.ts`, `app/api/auth/callback/route.ts` (NEW), `middleware.ts` (NEW) |
| 3 | `app/api/v1/missions/[id]/stream/route.ts`, `components/dashboard/missions-list.tsx`, `components/dashboard/usage-dashboard.tsx`, `components/dashboard/new-mission-form.tsx` (NEW) |
