# Phase 01 — Tier-1 Quick Wins

**Status:** ✅ Completed (2026-04-28 03:20 UTC-7)
**Estimate:** 1 session (~3-4h with parallel)
**Score Lift:** 67/100 → ~80/100

## Context Links

- Audit: `plans/reports/audit-260428-0253-go-live-100.md`
- Backend audit: `plans/reports/audit-backend-260428-0253.md`
- Frontend audit: `plans/reports/audit-frontend-260428-0253.md`
- Infra audit: `plans/reports/audit-infra-260428-0253.md`

## Overview

**Priority:** CRITICAL
**Scope:** Surface fixes for go-live readiness. Skips deep architectural changes (deferred to Phase 02).

## Workstreams

### A — Backend / CI / DevOps (1 agent)
**Owner files:**
- `.github/workflows/test.yml`
- `.github/workflows/d1-backup.yml`
- `apps/sophia-ai-factory/next.config.ts`
- `apps/sophia-ai-factory/src/lib/security/content-security-policy-configuration.ts`
- `apps/sophia-ai-factory/src/app/api/coupons/apply/route.ts`
- `apps/sophia-ai-factory/src/app/api/errors/report/route.ts`
- `apps/sophia-ai-factory/src/app/api/setup/save/route.ts`
- `apps/sophia-ai-factory/src/app/api/realtime/alerts/route.ts`
- `apps/sophia-ai-factory/migrations/0025-coupon-redemptions.sql` (new)

**Tasks:**
- [x] T1 — Remove `continue-on-error: true` from Lint+Test in `test.yml`; SHA-pin actions
- [x] T2 — Add R2 upload step to `d1-backup.yml`
- [x] T3 — Add `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/:path*` in `next.config.ts`
- [x] T4 — Drop `https://*.supabase.co` from CSP `connect-src`
- [x] T5a — Auth-gate `coupons/apply` + DB redemption count + new migration
- [x] T5b — Auth-gate `errors/report` + 1KB cap + CR/LF strip
- [x] T5c — Auth-gate `setup/save`
- [x] T5d — Cron-secret gate `realtime/alerts`
- [x] T6 — `npm run build` + `npm test` green

### B — Frontend / UX (1 agent)
**Owner files:**
- `apps/sophia-ai-factory/messages/en.json`
- `apps/sophia-ai-factory/messages/vi.json`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/[id]/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/new/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/components/video-gallery.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/components/video-detail-client.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/new/components/script-step.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/new/components/asset-picker.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/new/components/render-status.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/error.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/error.tsx` (new)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/loading.tsx` (new)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/[id]/not-found.tsx` (new)

**Tasks:**
- [x] T1 — Add `dashboard.videos.*` namespace (35+ keys) to en.json + vi.json; wrap 9 video files
- [x] T2 — Localize `dashboard/error.tsx` (currently Vietnamese-only)
- [x] T3 — Fix 4 hardcoded `/login` redirects → `localizedHref`
- [x] T4 — Create 3 boundary files (error/loading/not-found)
- [x] T5 — `aria-pressed` + focus ring on asset-picker toggles
- [x] T6 — Touch targets `min-h-[44px]` on primary CTAs
- [x] T7 — `<img>` → `next/image` (gallery + asset-picker)
- [x] T8 — `npm run build` + `npm test` green

## Success Criteria

- All checkboxes ticked
- 100% existing test pass
- Build exit 0 (existing `ignoreBuildErrors: true` flag stays for now — Phase 02 fixes 462 TS errors)
- No regression in production smoke after deploy

## Risk Assessment

- **R1** — Migration `0025-coupon-redemptions.sql` may conflict with concurrent migration work. Mitigation: agent claims slot, single sequential apply.
- **R2** — `next/image` may need `unoptimized` flag on Cloudflare Workers. Agent handles via inspection of existing config.
- **R3** — Vietnamese translations quality. Agent guided to natural Vietnamese, not Google Translate. Manual review post-deploy.
- **R4** — i18n key naming may diverge from existing convention. Agent referenced `dashboard/missions/page.tsx` pattern.

## Security Considerations

- Auth-gate fixes prevent IDOR + log-injection + credential-leak vectors
- Coupon redemption count prevents `FREE50` infinite redeem
- CSP cleanup shrinks attack surface
- CDN immutable cache headers do NOT change auth posture (assets only)

## Completion Summary

**Outcome:**
- Backend: 8 modified + migration `0025-coupon-redemptions.sql` shipped
- Frontend: 12 modified + 3 new boundary files (`error/loading/not-found`) shipped
- Tests: 1584 pass / 31 skipped / 0 failed (+2 new auth coverage tests added by tester)
- Build: exit 0
- Diff: +526/-167 across 21 files
- Code review: 28/30 (9.33/10), 0 BLOCKING, APPROVE verdict
- 2 minor inline fixes applied post-review:
  - `videos/[id]/not-found.tsx` — locale-aware Link via `localizedHref`
  - `coupons/apply/route.ts` — `console.error` instrumentation in catch

**Reports:**
- Implementation: `plans/reports/tier1-backend-260428-0253.md` + `tier1-frontend-260428-0253.md`
- Verification: `plans/reports/tester-tier1-260428-0253.md`
- Review: `plans/reports/code-review-tier1-260428-0253.md`

## Next Steps

After Tier-1 GREEN: proceed to Phase 02 (Tier-2 backlog). User must:
1. Provision Sentry account + DSN
2. Create CF R2 bucket `sophia-backups`
3. Resolve GH Actions block (`longtho638-jpg`)
4. Add CAA + SPF DNS records
5. Apply migration: `wrangler d1 migrations apply sophia-raas-db --remote`
