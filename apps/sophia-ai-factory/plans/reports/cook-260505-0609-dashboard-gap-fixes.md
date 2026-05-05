# Cook Report — Dashboard GAP fixes (Wave 1A + 2A)

**Date:** 2026-05-05 06:09 PT
**Trigger:** `/cook all` follow-up to GAP scout. Auto mode ("khỏi trả lời").

## Scope

GAP scout xác định 14 items. Sau verify code thực tế:
- 1 GAP **false-positive** (Analytics MASTER gate đã đúng — `canAccessRevenue` line 183)
- 2 GAP **shipped** trong iteration này (Wave 1A + 2A)
- 5 GAP **deferred** (Wave 1B/2B đã có cover, Wave 3 blocked, P2 polish)

## Changes (2 files)

### 1. MasterWelcomeBanner — CTAs có link
**File:** `src/app/[locale]/dashboard/components/master-welcome-banner.tsx`

Trước: 4 feature cards là `<li>` informational, không click được → MASTER user nhìn thấy "Affiliate Engine, Admin Dashboard, API Access, Priority Support" nhưng không biết đi đâu.

Sau: mỗi card là `<Link>` với href:

| Feature | Href |
|---|---|
| Affiliate Engine | `/dashboard/wallet` |
| Admin Dashboard | `/dashboard/admin` |
| API Access | `/dashboard/byok` |
| Priority Support | `/dashboard/support` |

Hover: border highlight `[var(--neon-cyan)]/50` + `ArrowRight` icon fade-in (affordance). Existing dismiss/localStorage logic giữ nguyên.

### 2. Promo applier — saga fix (used_count drift prevention)
**File:** `src/land/promo/promo-applier.ts`

Trước: `triggerAutoHandover` failure cho `free_full`/`free_trial` được swallow bằng `logger.warn` → flow tiếp tục → `incrementAndRecord` chạy → `promo_codes.used_count++` dù handover NULL → drift.

Sau: handover failure cho free tier **throw** error → `incrementAndRecord` không chạy → `used_count` không inflate.

Saga ordering hiện đúng:
```
1. triggerAutoHandover() — must succeed
2. setUserTrialExpiry() — only if handover OK (free_trial)
3. incrementAndRecord() — atomic D1 batch (used_count++ + redemption row)
```

Caller `src/app/api/promo/redeem-free/route.ts:128` đã wrap trong try/catch, return 400 với error message — graceful.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` (full suite) | ✅ 2796/2827 pass (baseline) |
| `npm run build` | ✅ OpenNext compile success |
| code-reviewer score | 9.5/10, 0 critical |

## GAPs deferred (with reason)

| # | GAP | Status | Reason |
|---|---|---|---|
| ~~1~~ | Analytics MASTER gate | FALSE-POSITIVE | `canAccessRevenue` đã include MASTER (rbac.ts:183) |
| 1B | Tier-aware quick-start CTA | Skipped | Banner CTAs đã cover; DashboardFirstCampaignCta generic OK |
| 2B | Audit log promo redemption | Already exists | DB row `promo_code_redemptions` + `logger.info('[PromoApplier] Code applied')` |
| 3 | Request Payout button + API | BLOCKED | Tables `payouts`/`user_wallets` chưa lên prod (per fk-audit). Cần migration trước |
| 4 | Proposals persist | Out of scope | Cần thiết kế DB schema riêng |
| P2x | Bilingual error msgs, OnboardingStatusWidget, affiliate page, email drip | Skipped | P2 polish, không impact MASTER UX core |

## Unresolved questions

- Wave 3 (payout request flow): nên ship migration tạo `user_wallets`/`payouts` lên prod trước, hay refactor schema thành `payout_requests` riêng (status pending → approved → paid)?
- Wave 1B: có nên tách `DashboardFirstCampaignCta` thành tier-aware variant cho MASTER (ví dụ "Setup wallet" thay vì "Create campaign")? Hiện banner đã cover nên priority thấp.
- Source migration drift (7 file `0015-0024` vẫn `REFERENCES users(id)`): chấp nhận hay clean? Hiện không impact prod.
