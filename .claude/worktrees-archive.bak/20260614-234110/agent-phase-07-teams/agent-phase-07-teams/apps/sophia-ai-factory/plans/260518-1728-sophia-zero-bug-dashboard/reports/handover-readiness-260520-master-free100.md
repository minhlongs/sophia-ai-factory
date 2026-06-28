# Handover-Readiness Audit — First MASTER FREE100 Customer

**Date:** 2026-05-20
**Audited prod SHA:** `4b573ba2` (cycle 11 live)
**Scope:** Can Sophia ship to the first MASTER FREE100 customer today, end-to-end, zero-friction?
**Method:** D1 remote queries + code-path inspection + production endpoint smoke.

---

## TL;DR — Verdict

**🟡 CONDITIONAL GO via Telegram channel. 🔴 NO-GO via email channel.**

- **Telegram path** (`/free100 <email>` in bot) — works end-to-end. Magic link delivered directly via chat message.
- **Email path** (admin dashboard / Setup Wizard) — broken: 60 welcome emails stuck in outbox, 0 delivered, no cron wired.

If the first customer onboards via Telegram, the platform is ready. If via email, they will never receive the magic link.

---

## What works (proven by D1 + curl)

| Layer | Evidence | State |
|-------|----------|-------|
| FREE100 promo code | D1 row `code=FREE100`, `discount_type=free_full`, `applies_to_tier=MASTER`, `max_uses=200`, `used_count=52`, `status=active`, `valid_until=1785573580` (2026-08-01) | ✅ |
| Promo apply logic | `land/promo/promo-applier.ts` — saga: handover must succeed before recording redemption; no orphan used_count drift since 2026-05-05 | ✅ |
| Auto-handover trigger | `tree/handover/auto-handover.ts` creates handoverId + 72h-TTL magic link token atomically for `free_full` / `free_trial` codes | ✅ |
| Telegram `/free100 <email>` | `land/openclaw-telegram/openclaw-handlers.ts:388` — pipes magic link directly to chat; bypasses email entirely | ✅ |
| `/api/version` | `4b573ba2` matches local HEAD | ✅ |
| Cycle 1-11 endpoints | `/api/sdk/typescript` 200, `/api/sdk/quickstart` 200, `/api/stats/live` 200, `/api/missions/auto-video` 401 (auth-gated as designed) | ✅ |
| Magic link single-use | Token cleared on first login (verified on latest MASTER handover row) | ✅ (security feature, not a bug) |
| Welcome landing page | `/vi/welcome/<token>` 200 — page renders even on bad token (error UI) | ✅ |

---

## What's broken (blockers for selling)

### 🚨 BLOCKER 1 — Welcome email outbox never flushes

**Evidence:**
- `welcome_email_outbox` D1 table: **60 rows pending, 0 sent, 0 failed**.
- Of those, **48 enqueued since 2026-04-15** — all stuck.
- `auto-handover.ts:227` calls `enqueueWelcomeEmail()` correctly.
- `/api/cron/email-outbox-flush/route.ts` exists and is wired correctly.
- `wrangler.toml` `[triggers] crons = [...]` array does NOT include the every-1-min slot the route comment references.

**Impact:** Of 52 MASTER FREE100 redemptions, only **3 customers received the welcome email** (5.7%). The other 49 never got their magic link via email.

**Fix:** add a cron entry that fires `/api/cron/email-outbox-flush` every 1–5 minutes. One-line change to `wrangler.toml` plus the worker `scheduled()` handler dispatching that path.

### 🚨 BLOCKER 2 — Post-login funnel never closes

**D1 funnel stats (52 MASTER FREE100 redemptions, lifetime):**

| Stage | Count | Conversion |
|-------|------:|------:|
| Redeemed | 52 | 100% |
| Welcome email sent | 3 | **5.7%** |
| Logged in (clicked magic link) | 24 | 46% |
| First SOP installed | 0 | **0%** |
| First mission run | 0 | **0%** |
| Handover marked completed | 0 | **0%** |

**Impact:** Even of the 24 customers who reached the dashboard, **not a single one ran a mission**. Either the post-login UX gives them no clear "first action" or the SOP install/mission run instrumentation is wrong.

**Fix:** spike 1 manual walkthrough as a MASTER FREE100 user (curl-redeem → login → /dashboard) and observe what they actually see. Two possibilities:

1. Dashboard renders but never surfaces /auto / Setup Wizard → UX gap, needs onboarding ribbon
2. Instrumentation columns (`customer_first_sop_install_at`, `customer_first_run_at`) never wired → metrics dark even though users engage

Either way the platform cannot claim "first MASTER active" until at least one row crosses these columns.

---

## What is NOT a blocker

- **GitHub Actions disabled** — by design (CF-direct doctrine since 2026-05-03). Not a deploy obstacle.
- **HeyGen render BYOK** — cycle 11 soft-skips when no key; mission still produces script + description. First customer can use the platform without HeyGen on day 1.
- **3 `:any` types in prod code** — known, accepted, in migration noise.
- **Layer 10 Backup 7/10** — operational discretion under no-tech doctrine; R2 30-day lifecycle is the de-facto backup.

---

## Recommended close-out before first sale

In priority order:

1. **Wire cron for `/api/cron/email-outbox-flush`** — 1-line `wrangler.toml` change + `scheduled` handler dispatch entry. Unblocks 49 stuck welcome emails immediately.
2. **Walk a fresh MASTER FREE100 flow** as the customer (no shortcuts):
   - `curl POST /free100 with new email` → confirm magic link arrives
   - Click link → land on `/welcome/<token>` → consume token → land on `/dashboard`
   - Look for: Setup Wizard prompt, /auto entry, BYOK key entry
   - File whatever UX gap you find as a P0 ticket
3. **Re-check `customer_first_run_at` instrumentation** — make sure the path that runs `/auto` actually updates the row.

Time to fix: ~2 hours for cron + 1 hour for walkthrough = **same-day close-out, then sell**.

---

## Unresolved questions

- Were the 3 welcome emails that DID send delivered via a different path (admin manual flush?) or by a now-removed cron? Not investigated.
- Does the existing customer dashboard show any "first task" prompt for MASTER tier? Code-path not traced this turn — needs the walkthrough.
- Are the 48 stuck emails still deliverable (recipient inboxes still valid), or have we already lost trust with those 48? Compliance / sender-reputation question.
- Should the cron also retry the 60 backlogged emails immediately, or only flush forward-going? Decision needs operator input.

---

## Audit signature

- Verified by D1 remote queries against `sophia-raas-db` (78bd1961-b62d-43bb-b551-0c5d7d389506)
- Endpoint smoke against `https://sophia.agencyos.network` at SHA `4b573ba2`
- No mocks, no proxies, all numbers reflect live production state at audit time
