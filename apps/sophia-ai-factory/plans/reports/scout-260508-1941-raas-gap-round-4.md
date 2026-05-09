# Scout Round 4 — RaaS GAP Audit

**Date:** 2026-05-08 19:41 PT
**Branch:** main @ `b62ad2ab` (live, verified `/api/version`)
**Scope:** FREE100 MASTER user journey: redeem → onboard → SOP install → video gen → multi-platform publish.

## Summary (TOP-8 ranked)

User journey is mostly intact post-Phase-1, but **two P0 functional blockers** remain plus **two P0 hardcoded-strings/i18n issues** and one critical **multi-platform publish coverage gap**. Stub mission handlers (lead/voice) are gracefully labeled (`is_stub:true` + upgrade_path) so they degrade safely. Severity dist: 2 P0 / 4 P1 / 2 P2. Estimated fix effort 4–7h total.

| #   | Title                                          | Sev | Loc                                                    | Effort |
| --- | ---------------------------------------------- | --- | ------------------------------------------------------ | ------ |
| F-1 | `redirect('/auth/login')` 404s in 9 pages      | P0  | dashboard/{page,credits,account,byok,integrations/*}   | S      |
| F-2 | publish-execute missing pinterest/linkedin/zalo | P0  | forest/inngest/functions/publish-execute.ts:54         | S      |
| F-3 | /api/proposals 501 stub blocks form submission | P1  | app/api/proposals/route.ts:25                          | M      |
| F-4 | credits page hardcoded EN strings (no t())     | P1  | app/[locale]/dashboard/credits/page.tsx:38-128         | XS     |
| F-5 | video MISSING_KEY error not user-friendly      | P1  | dashboard/videos/new/components/video-creator-wizard.tsx:109 | XS |
| F-6 | proposals page hardcoded EN error labels       | P1  | dashboard/proposals/page.tsx:109                       | XS     |
| F-7 | admin/invite returns 501 (Better Auth gap)     | P2  | app/api/admin/invite/route.ts:68                       | M      |
| F-8 | url-revenue-handler stale TODO comment         | P2  | forest/inngest/functions/url-revenue-video-handler.ts:10 | XS  |

---

## F-1 [P0] `redirect('/auth/login')` 404 — 9 dashboard pages

**Evidence:** Live `curl -sI https://sophia.agencyos.network/auth/login` → `HTTP/2 404`. Production-validated.

```
src/app/[locale]/dashboard/page.tsx:50:  if (!user) redirect('/auth/login');
src/app/[locale]/dashboard/credits/page.tsx:20:  if (!user) redirect('/auth/login');
src/app/[locale]/dashboard/byok/page.tsx:25:  if (!user) redirect('/auth/login');
src/app/[locale]/dashboard/account/page.tsx:36:  if (!user) redirect('/auth/login');
src/app/[locale]/dashboard/integrations/page.tsx:24:  redirect('/auth/login');
src/app/[locale]/dashboard/integrations/channels/page.tsx:15:  redirect('/auth/login');
src/app/[locale]/dashboard/integrations/affiliate-networks/page.tsx:15:  redirect('/auth/login');
src/app/[locale]/dashboard/integrations/webhooks/page.tsx:39:  redirect('/auth/login');
src/app/[locale]/dashboard/integrations/webhooks/docs/page.tsx:165:  redirect('/auth/login');
```

Real route: `[locale]/login`. middleware.ts uses `/login` (next-intl rewrites with locale). When session expires mid-session, all 9 pages send user to a 404 page — broken UX.

**Fix:** Replace `redirect('/auth/login')` with `redirect(localizedHref(locale, '/login'))` (canonical pattern already used by `videos/page.tsx:27` and `videos/new/page.tsx:18`). Each page already has `params` → can resolve locale.

**Effort:** S (~30min — 9 file edit, mechanical). 

---

## F-2 [P0] Multi-platform publish missing 3 publishers

**Evidence:** `src/forest/inngest/functions/publish-execute.ts:54-68` switch supports only tiktok/youtube/instagram/facebook/twitter. Throws `Unknown provider` for pinterest/linkedin/zalo. BUT:
- `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx:33-47` shows them as connectable
- OAuth routes exist: `src/app/api/oauth/{pinterest,linkedin,zalo}/route.ts`
- Publisher modules exist: `src/lib/publishing/{pinterest,linkedin,zalo}-publisher.ts`
- Type `ChannelProvider = 'tiktok'|...|'pinterest'|'linkedin'|'zalo'|...` (publisher-interface.ts)

User connects Pinterest → schedules publish → Inngest job throws → no notification → mute failure.

**Fix:** Add 3 cases to `buildPublisher()` switch (lines 54-68) + `buildPostUrl()` (lines 71-81). All publisher classes already exported.

**Effort:** S (~1h — surgical switch additions + smoke test).

---

## F-3 [P1] /api/proposals returns 501 — form submission lands in error

**Evidence:** `src/app/api/proposals/route.ts:25` returns 501 `PROPOSALS_NOT_IMPLEMENTED`. `src/app/[locale]/dashboard/proposals/page.tsx:57` POSTs to `/api/proposals` → catches → renders generic "Failed to generate proposal" alert.

User sees fully functional proposal form, fills it out, hits Generate, gets red error. No upfront "Coming Soon" UX.

**Fix (surgical):** Either (a) add upfront `<TierGateCard>` or "Beta" banner on proposals page client-side checking 501 capability flag, or (b) implement minimal LLM-backed proposal gen with existing OpenRouter BYOK pipeline (handler `proposal-create.ts` already exists in `src/forest/missions/handlers/`). Option a XS, option b M.

**Effort:** XS (banner) or M (real impl).

---

## F-4 [P1] credits page — hardcoded English (no t())

**Evidence:** `src/app/[locale]/dashboard/credits/page.tsx`:
- L38: `<h1>MCU Credits</h1>` — hardcoded
- L40: `Model Compute Units (MCU) power your AI commands` — hardcoded
- L46/53/58: `Available` / `Total Purchased` / `Total Used` — hardcoded
- L85: `Command Pricing` — hardcoded
- L86: `MCU cost per AI command execution` — hardcoded
- L100: `Free` literal — hardcoded
- L111: `Recent Transactions` — hardcoded
- L114: `No transactions yet` — hardcoded
- L123: `Mission ${id.slice(0,8)}` — partially hardcoded

Vietnamese MASTER user (predominantly Vi locale) sees raw English on credits page. `t('dashboard.credits_low_banner')` IS imported (L23) but only used for low-balance banner.

**Fix:** Add `dashboard.credits.{title,subtitle,available,totalPurchased,totalUsed,...}` keys to `messages/{vi,en}.json` and migrate JSX to t() calls. Mechanical.

**Effort:** XS (~30min — single file, single i18n namespace).

---

## F-5 [P1] Video creator MISSING_KEY error not actionable

**Evidence:** `src/app/api/heygen/create-video/route.ts:74-78` returns 503 `code:'MISSING_KEY'` when env HEYGEN_API_KEY unset AND no user BYOK. `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx:74,109` catches → shows raw `e.message` ("video_service_unavailable") in red `<p className="text-sm text-destructive">`.

FREE100 MASTER user assumes platform-managed HeyGen (correct expectation per CLAUDE.md note "heygen is server-only" in BYOK page). If operator forgot to set HEYGEN_API_KEY in CF secrets, ALL FREE100 video gens fail with cryptic message — no upgrade hint, no setup-wizard CTA.

**Fix:** In wizard catch: detect `code === 'MISSING_KEY'` from response JSON → show targeted UI with link to `/setup-wizard` and contact support. (Operator already documented in `.env.production.example`.)

**Effort:** XS (~20min — single component, parse response.code, conditional message).

---

## F-6 [P1] Proposals page hardcoded EN strings

**Evidence:** `src/app/[locale]/dashboard/proposals/page.tsx:109`:
```jsx
<p className="font-medium">Failed to generate proposal</p>
```
And L73: `'Unknown error'` literal. Page imports `useTranslations('dashboard.proposals')` BUT only uses for header — error UX hardcoded.

**Fix:** Add `dashboard.proposals.errors.{generic,unknownError}` to messages/{vi,en}.json. Mechanical.

**Effort:** XS (~10min).

---

## F-7 [P2] /api/admin/invite returns 501 — Better Auth gap

**Evidence:** `src/app/api/admin/invite/route.ts:60-69` returns 501 because Supabase `admin.inviteUserByEmail` was removed in Better Auth migration. Comment "Re-implement via Better Auth invite flow when product needs it." UI still references this endpoint somewhere (unverified).

**Note:** Admin-only feature, not on FREE100 MASTER user journey. P2 only.

**Effort:** M (~3h — design + implement Better Auth invite flow).

---

## F-8 [P2] Stale TODO in url-revenue-video-handler

**Evidence:** `src/forest/inngest/functions/url-revenue-video-handler.ts:10-13`:
```
TODO (git-manager / infra): Register this function in src/app/api/inngest/route.ts
```
But `src/app/api/inngest/route.ts:19,44` ALREADY imports + registers `urlRevenueVideoHandler`. TODO is stale doc lint.

**Fix:** Delete lines 10-13 of header comment.

**Effort:** XS (<5min).

---

## State of RaaS Dashboard (1 paragraph)

FREE100 MASTER end-to-end user journey is mostly functional with Phase 1 just live (FB+X publishers, Sentry route, 8 native publishers). Two production-confirmed P0 blockers remain: (a) `/auth/login` redirect-on-session-expiry sends users to a live 404, breaking 9 dashboard pages mid-session and (b) 3 of 8 connectable social channels (pinterest/linkedin/zalo) reach the publish-execute Inngest job and silently fail with `Unknown provider` despite full OAuth wiring + publisher classes. Hardcoded English strings in credits + proposals pages reduce Vietnamese user polish (P1). Mission handlers (lead/voice/etc) are correctly stubbed with `is_stub:true` flags + upgrade paths so degrade gracefully — not blockers. Proposals API 501 is the only API path where a working UI lands on a server error without UX fallback. Recommend a 2–4h sweep: F-1 (mechanical 9-file edit) + F-2 (3-case publisher switch) unblocks all known P0; F-4/F-5/F-6 i18n+error-UX pass takes another 1h.

---

## Unresolved Questions

1. **F-3 scope** — implement real proposal LLM gen (M effort, reuses existing `proposal-create.ts` mission handler) or just gate UI with "Coming Soon" banner (XS)?
2. **F-2 verification** — do staging Pinterest/LinkedIn/Zalo OAuth callbacks actually persist tokens to `publishing_channels` table? (assumed yes since OAuth routes exist; not verified.)
3. **F-1 alternative** — should middleware also rewrite `/auth/login` → `/[locale]/login` as defense-in-depth, or fix at source? (Recommend source-only — 9 files, fast.)
4. **F-7 priority** — does any active admin UI/dashboard call `/api/admin/invite`? If yes, escalate to P1.
