# Bug Sweep & UX Flow — Sophia AI Factory

**Date:** 2026-05-04
**Trigger:** D1 missing `user_api_keys` table → setup wizard step 5 D1_ERROR
**Scope:** All P1 + P2 issues (24 items) approved by user

## Pre-fix context

- Migration `0011-user-api-keys.sql` applied to remote D1 at 01:27 PST (idempotent CREATE TABLE IF NOT EXISTS)
- D1 has 106 tables; legacy schema migrated via Supabase originally; `d1_migrations` tracking incomplete (cosmetic, not breaking)

## Phases

| # | Phase | Files | Status |
|---|-------|-------|--------|
| A+C | Wizard gate DB-based + HeyGen fail-safe | middleware.ts, save/route.ts, save-credentials/route.ts | pending |
| B+E | Wizard UX hardening + bilingual error.tsx | setup-wizard/page.tsx, /api/setup/verify, /api/setup-wizard/test-*, 7 error.tsx, locales/{vi,en}.ts | pending |
| D | Dashboard CTA + form fixes | integrations/page.tsx, campaign-form.tsx, template-selector.tsx | pending |
| F+G | Signup polish + OAuth → D1 | signup-form.tsx, better-auth-server.ts, youtube/tiktok callback routes | pending |
| H | Type safety + console cleanup (13 `:any`) | dunning/*, billing/*, D1 helpers, license-sync, admin violations, usage-summary-card | pending |

## Issue inventory (24 items)

**Auth/Signup (P1×3, P2×2):**
- A1 P1: middleware uses cookie not DB → multi-device re-onboarding
- A2 P1: 1200ms setTimeout post-signup
- A3 P1: no subscription row insert in user.create hook
- A4 P2: onboarding_completed_at column unused
- A5 P2: OAuth callbacks (YT/TikTok) → Supabase instead of D1

**Setup wizard (P1×3, P2×5):**
- B1 P1: Step 2 verify errors swallowed
- B2 P1: Step 5 save loop infinite, no retry
- B3 P1: HeyGen webhook silent fail (success=true)
- B4 P2: state lost on F5
- B5 P2: no step transition loader
- B6 P2: provider test errors English-only
- B7 P2: LocalMode poll no JSON guard
- B8 P2: VerifyKeyResponse type mismatch (valid vs ok)

**Dashboard (P1×3, P2×3):**
- D1 P1: Coming Soon buttons href="#"
- D2 P1: affiliate offer required no error msg
- D3 P1: duplicate hidden offer_id field
- D4 P2: 7 error.tsx hardcoded Vietnamese
- D5 P2: template-selector no empty state
- D6 P2: campaign list CTA inconsistent

**Tech debt (P0×3, P1×0, P2×6):**
- H1-H3 P0 (per Sophia rule): 13 `:any` casts (dunning/billing/D1/components)
- H4 P2: 1 console.log in telegram webhook
- H5-H10 P2: 6 documented TODOs (postback HMAC, cron HTTP, R2 wiring, commission %, Inngest, KV) — DEFER (not user-blocking)

## Deferred (out of scope this session)

- 6 documented TODOs (architectural — separate roadmap)
- d1_migrations tracking cleanup (cosmetic)
- 84 "pending" migrations false-positive (schema actually in sync via supabase_migrations_applied)

## Success criteria

- `npm run build` → 0 TypeScript errors
- `npm test` → 844+ tests pass
- 0 `:any` types added; remove existing 13
- 0 console.log in production paths
- All error.tsx bilingual (VI + EN)
- Setup wizard step 5 retry path works with clear error UI
- Browser test: signup → wizard → dashboard → campaign flow uninterrupted

## Deploy

Per CF-direct doctrine (project CLAUDE.md): `npm run deploy:full` after all phases pass. NO git push trigger. Verify SHA match via `/api/version`.
