# Scout Report — RaaS GAP Round 5

**Date:** 2026-05-08 20:10
**Branch:** main @ `23bd08a3`
**Live verified:** `/api/version` shortSha=23bd08a3, deployedAt=2026-05-09T03:07:59Z
**Scope:** focus areas not touched by waves 1-2 (setup wizard, telegram, sop-marketplace, mission detail, billing page, public APIs, dashboard widgets, payment-success).

---

## State of dashboard summary

Round-5 surface scan focuses on areas waves 1-4 did not cover: setup-wizard locale routing, telegram bot UX docs, mission detail PEV labels, billing page hardcoded VI strings, dashboard widgets dead links, public v1 APIs, support page tier copy. Setup wizard is solidly i18n'd at component level but not under `[locale]` — VI users hit `/vi/setup-wizard` 404. Mission control widget links to non-existent `/dashboard/usage`. Mission detail PEV stage labels (Queued/Planning/Executing/Verifying/Completed) are hardcoded English despite `dashboard.missions` i18n namespace existing. Billing page mixes English headings with bare-VI loading/error/section strings (no t() wrapper). Telegram guide page is Vietnamese-only — no `/en/guide/telegram` content. Public v1 integrations APIs (channels, affiliate-networks) leak 500s instead of 401 unauth. Master welcome banner CTAs verified — links resolve. Onboarding-status-widget bilingual via `isVi` prop, OK.

---

## TOP 8 GAPs (ranked P0 → P2)

### F-1 — Setup wizard not in [locale] routing → /vi/setup-wizard 404
- **Severity:** P0 (blocks VI MASTER FREE100 user from using their preferred locale link)
- **Location:** `src/app/setup-wizard/page.tsx` (path is bare, NOT under `src/app/[locale]/`)
- **Evidence:** `curl /vi/setup-wizard` → 404; `curl /setup-wizard` → 307 to login. Wizard component itself uses `useLocale()` so it self-locales, but external/redirect-from-VI links break.
- **Fix:** Move file to `src/app/[locale]/setup-wizard/page.tsx`, OR add a redirect in middleware mapping `/vi/setup-wizard` → `/setup-wizard?lang=vi`.
- **Effort:** S

### F-2 — Mission control widget dead link `/dashboard/usage`
- **Severity:** P0 (broken nav from primary hero card on dashboard)
- **Location:** `src/forest/components/dashboard/mission-control-widget.tsx:43`
- **Evidence:** `<a href="/dashboard/usage" className="text-xs text-violet-400 hover:underline">` — but `find ... -type d -name 'usage'` shows zero `dashboard/usage` route. Only `admin/analytics/usage` and various `/api/*/usage` exist.
- **Fix:** Repoint to `/dashboard/billing` (existing usage breakdown lives there) or `/dashboard/credits`. Same file: change href.
- **Effort:** XS

### F-3 — Public v1 integrations APIs return 500 instead of 401 when unauth
- **Severity:** P1 (security/observability — looks like server crash to attacker, hides legit auth requirement)
- **Location:** `src/app/api/v1/integrations/channels/route.ts`, `src/app/api/v1/integrations/affiliate-networks/[network]/route.ts`
- **Evidence:** `curl /api/v1/integrations/channels` → "Internal Server Error" (500). `curl /api/v1/integrations/mcp` → 401 (correct). Suggests `getCurrentUserFromHeaders` throws when `req.headers` lacks Better Auth session, propagating uncaught.
- **Fix:** Wrap `getCurrentUserFromHeaders(req.headers)` in try/catch returning `NextResponse.json({error:'Unauthorized'}, {status:401})` consistently across v1 routes.
- **Effort:** S

### F-4 — Mission detail PEV stage labels hardcoded English
- **Severity:** P1 (VI MASTER user sees "Queued/Planning/Executing/Verifying/Completed" untranslated on every mission)
- **Location:** `src/forest/components/raas/mission-detail.tsx:29-35`
- **Evidence:** `const PEV_STAGES = [{ key:'queued', label:'Queued', ... }, ...]` — `useTranslations('dashboard.missions')` already available in same file but stages bypass it. vi.json lines 469-476 show neighboring keys translated; only stage labels missing.
- **Fix:** Add `t(`pev_stage.${stage.key}`)` lookup; add `pev_stage` keys to vi.json/en.json `dashboard.missions` block.
- **Effort:** S

### F-5 — Billing page mixed locale: English headings + bare-VI strings without t()
- **Severity:** P1 (Locale switch does nothing for these strings; EN user sees raw VN, VI user sees raw EN)
- **Location:** `src/app/[locale]/dashboard/billing/page.tsx:32, 60, 99, 104, 122, 127, 130, 131`
- **Evidence:**
  - L32 `Đang tải dữ liệu thanh toán...` (hardcoded VI)
  - L60 `Không thể tải dữ liệu thanh toán...` (hardcoded VI)
  - L99 `Monitor your usage, overage charges, and billing status` (hardcoded EN)
  - L104 `Upgrade Plan`, L122 `Usage Breakdown` (hardcoded EN)
  - L127 `Sử Dụng Hạn Mức`, L130 `Mức Dùng Tài Nguyên`, L131 `Biểu đồ trực quan...` (hardcoded VI)
- **Fix:** Wrap all in `t('dashboard.billing.*')`. `useTranslations('dashboard.billing')` already imported.
- **Effort:** S

### F-6 — Telegram guide page Vietnamese-only (no /en/guide/telegram content)
- **Severity:** P1 (English MASTER FREE100 user reaches Telegram guide and sees only Vietnamese)
- **Location:** `src/app/[locale]/guide/telegram/page.tsx` lines 8-141
- **Evidence:** Hardcoded `Hướng Dẫn Telegram Bot`, `Thiết Lập Ban Đầu`, `Cài Đặt Telegram`, `Liên Kết Tài Khoản`, etc. No `getTranslations()` call. Production: `curl /vi/guide/telegram` → 200, content all Vietnamese; `/en/guide/telegram` redirects to same VI content.
- **Fix:** Convert to `getTranslations('guide.telegram')`. Add `guide.telegram` namespace to en.json + vi.json. Move botCommands/commandTable into translation arrays.
- **Effort:** M

### F-7 — Setup wizard alerts use browser native `alert()` (UX hostile)
- **Severity:** P2 (works, but jarring on mobile, blocks JS, ugly)
- **Location:** `src/app/setup-wizard/page.tsx:233, 240, 250`
- **Evidence:** `alert(t('alerts.invalidKey'))`, `alert(t('alerts.missingLlm'))`, `alert(t('alerts.missingHeygen'))`. FREE100 MASTER first-impression UX.
- **Fix:** Replace with inline error banner above Next button (same pattern as `webhookWarning` at L396) or toast (`@/seed/components/ui/toast` exists).
- **Effort:** S

### F-8 — AgentTeamPanel "Loading agents..." not internationalized
- **Severity:** P2 (cosmetic; visible briefly during 5s polling cycle)
- **Location:** `src/forest/components/missions/agent-team-panel.tsx:65`
- **Evidence:** `<p className="text-xs text-muted-foreground">Loading agents...</p>` — file imports `useTranslations` and uses t() for all other strings (agent_idle/working/blocked/error, agent_team, no_agents) except this one fallback.
- **Fix:** Add `t('agent_loading')` key; use it.
- **Effort:** XS

---

## Summary table

| Code | Title | Severity | Effort |
|------|-------|----------|--------|
| F-1  | Setup wizard not in [locale] → /vi/setup-wizard 404 | P0 | S |
| F-2  | MissionControlWidget dead link `/dashboard/usage` | P0 | XS |
| F-3  | v1 integrations APIs return 500 unauth (should be 401) | P1 | S |
| F-4  | Mission detail PEV stage labels hardcoded EN | P1 | S |
| F-5  | Billing page mixed locale strings (no t() wrapper) | P1 | S |
| F-6  | Telegram guide page VI-only, no EN namespace | P1 | M |
| F-7  | Setup wizard uses native alert() instead of inline | P2 | S |
| F-8  | AgentTeamPanel "Loading agents..." hardcoded EN | P2 | XS |

**Total P0:** 2 (both block primary FREE100 MASTER flow). **P1:** 4. **P2:** 2.

---

## Production verification (TOP 3)

1. **F-1** `/vi/setup-wizard`: curl returned 404 (expected); `/setup-wizard` returned 307→login. Confirms route only registered at app-root.
2. **F-2** `/dashboard/usage`: curl 307→login, but no actual page (no `src/app/[locale]/dashboard/usage/`). Logged-in users would hit 404.
3. **F-3** `/api/v1/integrations/channels`: curl returned `Internal Server Error` (500). `/api/v1/integrations/mcp` returned `{"error":"Unauthorized"}` (401, correct). Inconsistent unauth behavior confirmed.

---

## Unresolved questions

- **Q1:** Is `/dashboard/usage` route intentionally unimplemented (placeholder for future), or should F-2 repoint to `/dashboard/billing`? The billing page already shows usage breakdown via `FullUsageSummary` + `QuotaGaugeList`.
- **Q2:** F-3 500 errors — is `getCurrentUserFromHeaders` throwing on missing cookie or on D1 binding access? Need stack trace from Sentry to confirm root cause.
- **Q3:** F-6 — is Telegram guide intentionally VI-only because @Sophia_Bbot is VN-market focused? If yes, should EN users be redirected to `/guide/integrations` or hidden from EN nav?
- **Q4:** Should `/api/v1/integrations/channels` even exist as v1 public surface, or should it remain admin-only? Currently SUPPORTED_PROVIDERS list in route includes `facebook` and `twitter` (added Wave 2) — verify these are wanted in public API.
- **Q5:** Setup-wizard's `alerts.invalidKey/missingLlm/missingHeygen` — do these keys exist in en.json (vi.json confirmed has them)? Quick grep recommended before F-7 fix.
