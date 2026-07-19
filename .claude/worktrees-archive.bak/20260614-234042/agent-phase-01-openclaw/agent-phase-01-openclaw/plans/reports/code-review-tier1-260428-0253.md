# Code Review — Tier-1 Quick Wins (Sophia AI Factory go-live)

**Date:** 2026-04-28
**Plan:** plans/260428-0253-go-live-100-fixes/phase-01-tier1-quick-wins.md
**Scope:** 21 files changed (526 + / 167 −) — 8 backend modified + 1 new SQL migration + 12 frontend modified + 3 new boundary files + CI workflows

---

## Scores

| Category | Score | Notes |
|---|---|---|
| **Security** | **9.5/10** | Auth gates correct, CSP scoped, cache headers safe, secret comparison consistent with codebase baseline. |
| **Sophia Conventions** | **9.5/10** | Canonical imports, 0 `any`, 0 `console.*`, all <200 LOC, server/client next-intl split correct, `localizedHref` for `/login`. |
| **Code Quality** | **9.0/10** | Boundary files correct, i18n parity perfect (en/vi keys equal), tests cover 401 paths. Minor nits below. |
| **Aggregate** | **28.0 / 30** (=9.33/10) | |

---

## Verification Results

### Auth gates (4 routes)
- `coupons/apply` — `getCurrentUser` from `@/lib/better-auth-session` ✓ — 401 with `error: 'Unauthorized'`, no info leak ✓
- `errors/report` — anon allowed but rate-limited per IP (10/min) ✓ — `userId` attached to log when present ✓
- `setup/save` — 401 returned before any body parsing ✓
- `realtime/alerts` GET/POST/DELETE — `verifyCronSecret` on all 3 verbs; dev bypass intact ✓

### Cron secret verification
`verifyCronSecret` uses `auth === \`Bearer ${secret}\`` (plain `===`). **Consistent with existing pattern** in `api/ingestion/trigger/route.ts` and `api/intelligence/score/route.ts`. Edge runtime (Cloudflare Workers) doesn't expose Node `timingSafeEqual` natively. Risk: theoretical timing oracle on a high-entropy random secret — practically negligible. **Accepted as baseline; tracked for B4 follow-up.**

### Coupon redemption atomicity (TOCTOU)
- `UNIQUE(user_id, coupon_code)` constraint ✓ in migration 0025 — guarantees no duplicate row even under race
- `COUNT(*) >= maxUses` check is non-atomic, but the **`apply` route only previews** — no INSERT happens here. The unique-constraint atomicity matters only when a writer route exists.
- **Gap (NON-BLOCKING):** No code path writes to `coupon_redemptions` yet. `coupons/activate` and `coupons/activate-redirect` still bump MCU/tier without recording redemption. Per-user reuse check therefore catches **nothing in production today**. Schema is correct and ready; the writer is missing — Tier-2 follow-up.

### Errors/report sanitization
- `MAX_MESSAGE_LEN = 1024` cap applied via `sanitize()` ✓
- `sanitize` strips `\r\n` BEFORE `.slice()` and is called BEFORE `logger.error` ✓
- `stack` capped at 500 chars + CRLF strip ✓; `userAgent` capped at 200 chars + CRLF strip ✓
- Order is correct: sanitize → log; no log-injection vector remains.

### Migration 0025
- `UNIQUE(user_id, coupon_code)` ✓
- Two indexes (`code`, `user`) ✓
- Sequential numbering (0024 → 0025), no gap ✓
- **NIT:** No FOREIGN KEY to `users.id`. D1/SQLite supports `FOREIGN KEY ... REFERENCES users(id)`. Acceptable since `user_id` is opaque from Better Auth, but documenting the relationship in a comment would help future readers. NON-BLOCKING.

### CSP cleanup
- Only `https://*.supabase.co` removed from `connectSrc` ✓ — no overshoot
- `'unsafe-inline'` retained with explicit `TODO(audit B4)` comment ✓
- All other allowed origins preserved (heygen, openai, polar, etc.)

### Cache headers
- `/_next/static/:path*` → immutable 1y ✓ (Next.js content-hashed)
- `/static/:path*` → immutable 1y ✓ (public assets)
- HTML routes (`/:path*`) untouched — only security headers applied ✓

### CI workflow
- `continue-on-error: true` removed from Lint and Test ✓ — true gating
- Action SHAs pinned with version comments ✓
- D1 backup R2 upload uses `continue-on-error: true` (artifact remains primary) ✓

### Frontend (videos)
- All 12 files: 0 `any`, 0 `console.*`, all <200 LOC
- next-intl: server pages use `getTranslations`, client components use `useTranslations` ✓
- `next/image` with explicit `width/height/alt`, `unoptimized` for cross-origin thumbs ✓
- Tap-target a11y: `min-h-[44px]` on actionable buttons/links ✓
- Motion: `motion-reduce:animate-none` on spinners ✓
- `localizedHref(locale, "/login")` used in `videos/page.tsx` and `dashboard/error.tsx` ✓

### Boundary files (NEW)
- `videos/error.tsx` — `"use client"`, `role="alert"`, retry button ✓
- `videos/loading.tsx` — server component, animated spinner with motion-reduce ✓
- `videos/[id]/not-found.tsx` — async server component, uses `getTranslations` ✓

### i18n parity
- en.json keys == vi.json keys (no drift) ✓
- All 25 keys consumed by changed files exist in both locales ✓

---

## BLOCKING Issues
**None.**

---

## NON-BLOCKING Suggestions

1. **Coupon writer missing.** `coupons/activate` and `coupons/activate-redirect` should `INSERT INTO coupon_redemptions(user_id, coupon_code)` (with `ON CONFLICT DO NOTHING`) so the per-user check in `apply` actually has data. Currently the table is read-only. Track as Tier-2.

2. **`videos/[id]/not-found.tsx` link uses raw `/dashboard/videos`.** With `localePrefix: 'as-needed'` (default), `vi` users hit a redirect hop (`/dashboard/videos` → `/vi/dashboard/videos`). Pass `locale` via params and use `localizedHref` for parity with `dashboard/error.tsx`. Cosmetic.

3. **Migration 0025 lacks FK comment.** Add `-- user_id references better-auth users.id (no FK because users live in separate D1 binding)` for future readers.

4. **`errors/report` rate limiter is per-isolate.** `anonRateMap` resets when CF Workers cold-starts a new isolate. Acceptable noise for now; if abuse appears, move to Cloudflare Durable Objects or KV. Comment in code already acknowledges this.

5. **`realtime/alerts` POST signature change.** `POST(request: NextRequest)` now forwards real request to `GET` instead of synthesizing a localhost URL — good fix; ensures the cron secret header propagates. Add a note in the JSDoc that POST and GET share the same auth.

6. **No tests for `errors/report` or `realtime/alerts`.** Auth happy-path and 401 path test would round out coverage. Low risk — handler logic is small.

7. **`coupons/apply` `try { ... } catch {}`** swallows the error variable. Add `logger.error('coupons/apply failed', toError(e))` for forensics. Currently silent on D1 failures.

---

## Verdict

**APPROVE** ✅ (28.0/30 = 9.33/10, 0 blocking)

Auto-approve threshold met (≥9.0/10 + 0 BLOCKING). All Tier-1 security and convention objectives are achieved. Nits above are tracked for Tier-2 / follow-up phases.

---

## Unresolved Questions

- Is the absence of a `coupon_redemptions` writer intentional for Tier-1, or should it move to Tier-2 explicitly? (Schema is in place but unused.)
- Should `verifyCronSecret` be promoted to a shared helper in `@/lib/security/` since 4+ routes now duplicate the same Bearer check?
