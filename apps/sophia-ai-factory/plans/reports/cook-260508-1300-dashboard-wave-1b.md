# Cook Report — Dashboard Wave 1B (post-scout fresh)

**Date:** 2026-05-08 13:00 PT
**Trigger:** `/cook next` → AskUserQuestion → "Re-scout GAP fresh" → Wave 1B implementation.

## Scope

Re-scout 4 góc (Structural / A11y / Mobile-edge / Tier-UX) → 61 GAPs total. Filter ≤4 files, no migration, không UX-debate items → 6 fixes.

| # | Fix | File(s) | Lines diff |
|---|---|---|---|
| F1a | Hide "Nâng Cấp Gói" sidebar footer cho MASTER | `layout.tsx` | ~6 |
| F1b | Hide "Upgrade Plan" button trên billing cho MASTER | `billing/page.tsx` | ~3 |
| F3 | Wallet empty state thêm CTA "Connect affiliate network" | `wallet/page.tsx` | ~12 |
| F4 | Emoji `aria-hidden` 3 banners (🚀 ⚠️ ⏳ 🎬 📋 📖) | 3 files | ~6 |
| F5 | Replace `console.log` trong webhook docs Express snippet với comment | `webhooks/docs/page.tsx` | ~1 |
| F6 | Tier badge dưới brand trong dashboard sidebar | `layout.tsx` + i18n | ~16 |

i18n: thêm `dashboard.sidebar.upgradePlan` + `dashboard.sidebar.tierBadge` (en + vi).

## False positives detected (not shipped)

| GAP | Why not |
|---|---|
| Structural #15 — Admin nav always visible | `{isAdmin && (...)}` đã gate ở line 222 |
| Structural #2 — `console.log` trong webhook docs | Là string template snippet — replace với comment giữ pedagogy |
| Mobile #14 — Tier prop trên billing | `usageData.license.tier` đã có sẵn trong response type |

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 2796/2827 (baseline preserved, 0 regressions) |
| `npm run build` | ✅ OpenNext compile success |
| Console.log scan src/ | ✅ 26 instances, all pre-existing test fixtures (0 new) |
| code-reviewer | ✅ 9.7/10, 0 critical, APPROVE |

## Deferred (not in this wave)

| Item | Reason |
|---|---|
| Wholesale i18n wallet/billing | Large scope (~50+ keys); separate Wave 1C |
| Currency Intl formatting | Design decision (USD vs VND vs locale-aware) |
| Mobile responsive polish | Low priority P2 |
| Proposals API persistence | P0-real but needs DB schema design |
| BYOK over-permissive gate | Design decision (intentional?) |
| Trial countdown for MASTER | UX-debate (urgency vs free-year messaging) |
| Admin role-vs-tier architecture | Architecture decision |

## Unresolved questions

- Wave 1C: nên sweep i18n toàn bộ wallet/billing/account pages 1 lần, hay accept mixed bilingual UI per existing pattern?
- Wave 3 (payout flow) vẫn pending: ship `user_wallets`/`payouts` migration prod trước, hay refactor thành `payout_requests` table riêng (status pending → approved → paid)?
- `@/lib` vs `@/seed` aliases: collapse 1 trong 2 thành canonical theo `sophia-layer-architecture.md` "Unresolved" section?
- Proposals API: build full `/api/proposals` route + DB schema, hay tạm hide button trên `/dashboard/proposals/page.tsx` cho đến khi có schema?
