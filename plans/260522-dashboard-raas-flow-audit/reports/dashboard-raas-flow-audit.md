# Sophia Dashboard RaaS Flow Audit

Date: 260522
Scope: user dashboard -> onboarding/BYOK -> RaaS mission creation -> video/distribution proof gates
Repo: `/Users/macbook/projects/sophia-ai-factory`
App: `apps/sophia-ai-factory`
Local HEAD before uncommitted fixes: `3b3bbcac`
Production SHA observed: `3b3bbcac` via `/api/version`

## Verdict

Current local code is stronger than deployed production after this pass.

Confirmed issue fixed locally: `/api/raas/missions*` used `user.id` as `missions.org_id`. Schema and signup flow use a separate organization id from `org_members`, so direct RaaS mission list/create/detail/update/retry/usage could miss or mis-scope tenant missions for normal users.

Live production is healthy at the public/auth-boundary level, but the local fix is not deployed yet.

## Evidence

Code map:
- Dashboard home reads current user, user profile, tier, credits, SOP install state, and redirects incomplete MASTER users to `/dashboard/onboarding`: `apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx`.
- Canonical onboarding wizard is `/dashboard/onboarding`; localized `/setup-wizard` redirects there.
- RaaS mission creation validates input, checks tier quota, checks BYOK provider presence, inserts mission, and optionally triggers internal execution.
- User-video proof script covers BYOK, auto-video, publish, and OpenClaw primitives: `apps/sophia-ai-factory/scripts/verify-user-video-flow.mjs`.

Local gates:
- `npm test -- src/app/api/raas/missions/__tests__/route.test.ts` -> 7/7 pass.
- `npm run type-check` -> pass.
- `npm run verify:user-video-flow` -> pass:
  - i18n validate pass
  - TypeScript pass
  - ESLint zero-error gate pass
  - targeted tests: 29 files, 205 tests pass
- `npm run build` -> pass. Warning observed: Turbopack NFT trace warning from `api/admin/audit/run`; build also logs `D1 database binding not available` while static generation touches auth-bound code, but exits 0 and generates the route manifest.

Production public checks:
- `curl -sS https://sophia.agencyos.network/api/version` -> `{"shortSha":"3b3bbcac","deployedAt":"2026-05-23T02:07:35Z","opennextVersion":"1.17.3"}`
- `curl -sS -I -x '' https://sophia.agencyos.network` -> HTTP/2 200, HSTS, CSP, X-Frame-Options DENY, nosniff present.
- Unauthenticated `/api/setup-wizard/list-credentials` -> 401, expected.
- Unauthenticated `/api/raas/missions` -> 401, expected.

Production browser smoke:
- Real throwaway user created through `/api/auth/sign-up/email` -> 200.
- Same user signed in through `/api/auth/sign-in/email` -> 200, cookies `__Secure-better-auth.session_token` and `__Secure-better-auth.session_data`.
- Chromium authenticated routes:
  - `/en/dashboard` -> 200, redirected to `/dashboard`, BASIC sidebar visible.
  - `/en/dashboard/onboarding` -> 200, onboarding route reachable.
  - `/en/dashboard/missions` -> 200, missions route reachable.
  - `/en/dashboard/api-docs` -> 200, API docs route reachable.
  - `/en/dashboard/billing` -> 200, billing route reachable.
- Screenshot: `plans/260522-dashboard-raas-flow-audit/reports/prod-dashboard-browser-smoke.png`.

Local browser harness note:
- `npm run dev` starts, but Better Auth signup/signin fails locally with `D1 database binding not available`. For auth-backed browser proof, use Wrangler/Cloudflare dev or production target; plain `next dev` is not CF/D1 parity.

## Fixes Applied

RaaS tenant scoping:
- `src/app/api/raas/missions/route.ts`
  - GET resolves `orgId` with `resolveOrgId(user.id)` and filters `missions.org_id = orgId`.
  - POST resolves `orgId`, counts mission quota against org scope, and inserts `org_id: orgId`.
  - Missing org membership returns `422 org_not_found` instead of writing bad tenant data.
- `src/app/api/raas/missions/[id]/route.ts`
  - GET/PATCH now scope by resolved `orgId`.
- `src/app/api/raas/missions/[id]/retry/route.ts`
  - Retry fetch/update now scope by resolved `orgId`.
- `src/app/api/raas/usage/route.ts`
  - Usage now resolves org scope and uses canonical `getUserTier`, not stale `profiles` table lookup.
- `src/forest/quota/mission-quota.ts`
  - Clarified owner scope: `missions` counts by org id, `engine_missions` counts by user id.

Tests:
- `src/app/api/raas/missions/__tests__/route.test.ts`
  - Proves mission insert uses resolved org id, not user id.
  - Proves missing org membership returns 422 and does not insert.

Lint gate blockers fixed:
- `src/app/[locale]/dashboard/sop-creator/new/sop-create-form.tsx` uses `next/link` for internal navigation.
- `src/app/ref/[code]/page.tsx` uses `next/link` for internal navigation.
- `src/forest/sops/sop-executor.ts` removes invalid `as Error` casts.

## Remaining Gaps

Not complete for full GREEN production:
- Local fixes are not deployed. Production still serves SHA `3b3bbcac`, which is the pre-fix HEAD plus current uncommitted local edits.
- Full live provider flow was not run. `npm run verify:user-video-flow:live` requires real account credentials, provider keys, active publish channels, and `SOPHIA_LIVE_CONFIRM=run-real-provider-flow`; it can spend real provider credits.
- Authenticated production browser smoke has run for dashboard/onboarding/missions/API-docs/billing. It does not prove the local RaaS tenant-scope fix because that fix is not deployed.

## Recommended Next

1. Run local dev/browser smoke for authenticated dashboard routes after these fixes.
2. Commit focused changes.
3. Deploy via app doctrine: push first, then `npm run deploy:full`.
4. Verify production SHA match, HTTP 200, and selected authenticated dashboard/RaaS routes.
5. Only run `verify:user-video-flow:live` after confirming test user credentials, provider keys, and active publish channels.

## Unresolved Questions

- Which live test account should be used for provider-credit proof?
- Should direct `/api/raas/missions` remain exposed as a user-facing endpoint, or should workflow creation be the preferred public RaaS entry?
- Should `org_not_found` auto-heal by creating an org for legacy users, or remain a hard 422 for auditability?
