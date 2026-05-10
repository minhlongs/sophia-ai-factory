# Phase 07 — Production Hardening + Nice-to-Haves (DEFER-ELIGIBLE)

## Context Links

- Plan overview: `./plan.md`
- Note: This phase is **defer-eligible**. If Day 5 budget is tight, slip to Wave 20 unless any item escalates to P1 in retrospective.

## Overview

- **Priority:** P2
- **Effort:** 1d (full) or skippable
- **Status:** pending
- **Description:** Polish items not blocking FREE100 happy path. Track each as independent sub-task; cherry-pick by value.

## Items (Independent, Parallelizable)

### 7A — Telegram MarkdownV2 Escaping (~2h)

- **What:** Replace current strip-markdown approach with proper MarkdownV2 escaping per Telegram Bot API spec.
- **Why:** Strip approach loses formatting; users complain copy looks plain.
- **Where:** `src/tree/telegram/format-markdown-v2.ts` (new) + caller in `publish-execute.ts` Telegram branch.
- **Test:** Unit test for `_*[]()~\`>#+-=|{}.!` escaping.

### 7B — Account Page Actions (~3h)

- **What:** Add "Delete account" (soft-delete + 30-day grace), "Export data" (queue Inngest job), "Change email" (Better Auth flow).
- **Why:** GDPR-leaning UX; CEO already requested.
- **Where:** `src/app/[locale]/dashboard/account/page.tsx` + new server actions.
- **Risk:** Delete account is destructive — require typed confirmation + 24h cooldown.

### 7C — Sidebar Quota Usage Widget (~2h)

- **What:** Small widget in sidebar showing `<X>/<limit>` videos this month.
- **Why:** FREE100 user wants visibility on quota burn.
- **Where:** `src/components/sidebar/quota-usage-widget.tsx` calls `checkVideoQuota(user.id, tier)`.

### 7D — MASTER Lifetime Badge in Billing (~1h)

- **What:** On `/dashboard/billing`, when tier is MASTER, show "Lifetime" badge instead of monthly date.
- **Why:** Communicates the FREE100/MASTER value to user clearly.
- **Where:** `src/app/[locale]/dashboard/billing/page.tsx` + i18n key.

### 7E — `.env.example` Complete (~30m)

- **What:** Document every env var the app reads (DB_URL, NEXTAUTH_SECRET, NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, SENTRY_DSN, TELEGRAM_BOT_TOKEN, OPENROUTER_KEY, ELEVENLABS_KEY, D_ID_API_KEY, R2 bindings).
- **Why:** Onboarding new dev / CI/CD config sanity.
- **Where:** root `.env.example`.

### 7F — Telegram retry_after Honoring (~2h, depends on Phase 05)

- **What:** Use `step.sleep(retryAfterSec)` in Inngest before rethrow on 429.
- **Why:** Inngest default backoff doesn't match Telegram's required wait.
- **Where:** `forest/inngest/functions/publish-execute.ts`.

## Implementation Sequencing

If executing all: 7E → 7D → 7C → 7A → 7B → 7F (cheapest first).

## Related Code Files

### Modify
- (per item — see each)

### Create
- `src/tree/telegram/format-markdown-v2.ts` (7A)
- `src/components/sidebar/quota-usage-widget.tsx` (7C)
- Various account page action files (7B)

### Delete
None.

## Todo List (per item)

- [ ] 7A — MarkdownV2 escaper + tests
- [ ] 7B — Account page Delete/Export/ChangeEmail actions
- [ ] 7C — Quota usage widget
- [ ] 7D — MASTER lifetime badge
- [ ] 7E — `.env.example` complete
- [ ] 7F — Telegram retry_after honoring

## Success Criteria

Each independently:
- 7A: Telegram message with `*bold*` renders bold, not raw `*bold*`.
- 7B: Delete account flow works end-to-end with confirmation + audit log entry.
- 7C: Sidebar widget shows accurate count (matches `/api/v1/quota/video` response).
- 7D: MASTER user sees "Lifetime" instead of "Renews 2026-06-01".
- 7E: `cp .env.example .env` + `npm run dev` starts cleanly.
- 7F: Telegram 429 → Inngest run timeline shows sleep delay matching `retry_after`.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| 7B Delete account corrupts data | M | H | Soft-delete only (mark `deleted_at`); never hard-delete inside same request. Add admin restore action. |
| 7A escape edge cases (nested formatting) breaks message | M | L | Use Telegram's official MarkdownV2 doc as test fixtures; cover the full special-char list. |
| 7E exposes secrets if real values leak in | L | H | Use only placeholder values (`your-key-here`); never paste real secrets. Pre-commit hook scan. |
| 7C performance if loaded on every page | L | L | Cache via React `cache()` per request. |

## Security Considerations

- 7B Delete account: rate-limit (1 attempt per hour); require fresh password re-auth.
- 7B Export data: signed S3 URL valid 24h; never email plaintext payload.
- 7E: scan `.env.example` for any pattern matching `[A-Za-z0-9_-]{32,}` before commit.

## Next Steps

- After Wave 19 closes, retrospect which Phase 07 items deserve promotion to Wave 20 P1.
- 7F directly extends Phase 05 — natural follow-up.
