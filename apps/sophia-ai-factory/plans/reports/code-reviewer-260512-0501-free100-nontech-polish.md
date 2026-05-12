# Code Review — FREE100 Non-Tech UX Polish (3 commits)

**Date**: 2026-05-12 PT
**Scope**: `6d6ba64b` (BYOK onboarding) → `0288145c` (pricing i18n) → `2dcc2e13` (telegram pairing)
**LOC**: +638 / -38 across 14 files
**Reviewer**: code-reviewer

---

## Verdict

**APPROVE-WITH-FIXES** — Score **8.7 / 10**

No critical defects, no security holes, no layer violations. Code compiles (`tsc` clean), all 34 new tests pass, baseline tests (setup wizard 7/7, pricing 11/11) green. Minor i18n hygiene issues (dead keys) and one micro-race in token consumption that is bounded to a no-op outcome. Safe to push after optional cleanup.

---

## Critical Issues — none

No security holes, no layer violations, no breaking changes, no banned imports.

---

## Major Issues

### M1. Dead i18n keys — `welcome.telegram.*` (12 keys total: 6 vi + 6 en)

Commit `2dcc2e13` adds `welcome.telegram.title/description/connectButton/linkedSuccess/errorTokenInvalid/errorTokenExpired` to both messages files but `welcome-page-client.tsx` never calls `useTranslations`. The file uses inline `isVi ? 'VN' : 'EN'` ternary pattern, same as pre-existing welcome text.

**Impact**: VN/EN drift risk — strings shown to users are hardcoded in component, while messages files have separate copies. Translator updates only one and not the other.

**Fix**: Either delete the 12 keys OR refactor component to use `useTranslations('welcome.telegram')`. Recommend the latter for consistency with rest of codebase.

### M2. Dead i18n keys — `tour.beginner.*` and `templates.beginnerTag` (6 keys total)

Commit `0288145c` adds `tour.beginner.audit_note`, `tour.beginner.step_distribute_hint` and `templates.beginnerTag.label` — none consumed by any component (`grep -rn` returns 0 hits in `src/`).

Commit message acknowledges these are "audit traceability" placeholders. They're documentation hidden in production JSON ship. Adds bundle weight, confuses future readers.

**Fix**: Move audit notes to plan/report markdown, OR consume them in a tour-audit utility file.

### M3. Pairing token consumption is not atomic

`consumePairingToken` in `pairing-token-service.ts`:
```ts
const { data } = await db.from('telegram_pairing_tokens').select(...).eq('token', token).maybeSingle()
if (row.used_at !== null) return null      // (1) check
await db.from(...).upsert({ ...row, used_at: now })  // (2) write
```

Window between (1) and (2) allows TOCTOU: two `/start <token>` messages racing through the webhook could both pass the null-check and both call upsert. **Risk: LOW** in practice because:
- D1 single-region serializes writes anyway
- Outcome is idempotent: second upsert just rewrites same `paired_chats` row with same `paired_by`
- `withMiddleware(chatId)` rate-limits per chat

**Recommendation**: Replace with single SQL `UPDATE telegram_pairing_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id` for atomicity. Not blocking — current code is safe for the threat model (legit user clicks button twice). Leave a TODO comment.

### M4. Welcome page CTA: `BOT_USERNAME` fallback fragile

```ts
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Sophia_Bbot';
```

If env var is set with `@` prefix or trailing space, `t.me/${BOT_USERNAME}` URL breaks silently. No validation.

**Fix**: Strip `@` and whitespace: `(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'Sophia_Bbot').replace(/^@/, '').trim()`.

---

## Minor Issues

### m1. Duplicate `createServerClient()` call

`route.ts:174, 186` — `const db` and `const db2`. Use one. (Sync, no I/O cost, but ugly.)

### m2. ByokHelpTip uses unsafe type-cast pattern

`t('toggleHide' as HelpKeys)` — type-cast workaround instead of proper next-intl strict keys. Acceptable, but consider declaring `useTranslations<HelpKeys>` if the codebase has typed namespaces elsewhere.

### m3. Silent fail in `handleConnectTelegram`

```ts
} catch {
  // Silent fail — user can retry
}
```

User sees no feedback if server action throws (network/auth/db error). At minimum, log to console or surface a toast.

### m4. `paired_by` field semantics overloaded

`telegram_paired_chats.paired_by` already means "admin who approved the pairing" in the existing flow (`pairing.ts:139` uses `approverId`). The new flow stuffs `userId` (the web account owner) into the same column. Semantically inconsistent — should it be `paired_user_id` or a new column? Migration 0100 added `UNIQUE(paired_by)`, so two flows now share the same unique-key constraint. **Functionally OK** but data dictionary lies.

### m5. `byok-help-tip.tsx` lives outside 4-layer (`src/components/onboarding/`)

Layer rules say `seed | tree | forest | land`. `src/components/` is not a recognized layer. Pre-existing `src/components/distribute/` set the precedent so this is consistent with existing pattern — not a regression. Worth raising in a separate refactor.

### m6. README placeholder file `public/byok-guide/README.md`

Adds a markdown file to `/public` (served as static). Either delete (commit as plan doc), or move screenshots-instruction to `docs/`.

---

## Per-Commit Notes

### 6d6ba64b — `feat(onboarding): inline BYOK key acquisition guide`

- **Clean.** New `ByokHelpTip` component (100 LOC) is well-scoped, accessible (`aria-expanded`, `aria-hidden`), handles missing PNG gracefully.
- i18n parity: 17/17 keys present in both vi.json + en.json ✅
- Properly wired into `api-keys-step.tsx` after openrouter / elevenlabs / d-id inputs
- All 7 setup wizard tests still pass
- No tests added for the component itself (m: nice-to-have — snapshot or basic interaction)

### 0288145c — `fix(pricing): bilingual UX polish + tour beginner audit`

- `pricing.promo.*` (2 keys), `pricing.error.*` (5 keys) — all consumed in `coupon-input.tsx` / `FreeRedemptionModal` ✅
- `tour.beginner.*` (2 keys) + `templates.beginnerTag.label` (1 key) — **DEAD** (see M2)
- Replaces 4 hardcoded English strings in `FreeRedemptionModal` with `useTranslations("pricing.error")` ✅
- Adds `tError("free_trial_days", { days: modal.discountValue })` — proper ICU param interpolation
- All 11 pricing tests still pass

### 2dcc2e13 — `feat(telegram): pairing token + welcome page connect CTA`

- **Security**: 128-bit CSPRNG token, 1h TTL, single-use, rate-limited via `withMiddleware`. Server action auth-gated via `getCurrentUser()`. Zod-strict `{}` schema (future-proof). ✅
- **Layer**: tree → seed only (clean). Server action in `src/app/actions/` imports from `@/seed/*` + `@/tree/telegram/*` (correct: app dir orchestrates seed/tree). ✅
- **Tests**: 6 unit tests for pairing-token-service + 3 webhook integration tests. Edge cases covered: unknown / expired / already-used / no-token / valid / invalid. ✅
- **Issues**: M1 (dead welcome.telegram keys), M3 (TOCTOU window), M4 (BOT_USERNAME fallback), m1, m3, m4

---

## Migration Safety

**Migration 0107 (D1): SAFE.**

- File: `migrations/0107-telegram-pairing-tokens.sql`
- Idempotent: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` ✅
- Sequence number follows existing pattern (0106 → 0107) ✅
- Compatible with `scripts/apply-migrations.sh` (uses `git diff` HEAD~1 to detect changed `.sql` files, then `wrangler d1 execute --file=<m> --remote`) ✅
- Indexes on `user_id` and `expires_at` — both useful (cleanup queries + per-user lookup) ✅
- Schema mirrored at `src/seed/db/migrations/20260512_telegram_pairing_tokens.sql` for local dev (matches existing dual-location pattern) ✅
- No drop / rename / data-altering ops — pure additive ✅

**Apply on deploy**: `bash scripts/apply-migrations.sh` (already part of CF-direct doctrine post-deploy step).

---

## Push Gate

**GREEN** with optional fixes deferred.

### Verified
- `npx tsc --noEmit` → 0 errors
- `vitest run` on changed files → 34/34 pass (6 new + 28 baseline webhook)
- Setup wizard tests 7/7 ✅
- Pricing component tests 11/11 ✅
- No `:any` introduced in production code
- No banned imports (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`)
- No cross-layer violations (tree → forest/land = 0 hits)
- i18n parity: all consumed keys present in both vi.json + en.json
- Migration 0107 is idempotent + additive
- Protected flows unbroken: Setup Wizard intact, Telegram webhook `/start` (no token) path preserved, Payment flow untouched

### Recommended before push
1. **M3** — Add a TODO comment in `consumePairingToken` documenting the TOCTOU window (or convert to single atomic UPDATE if D1 client supports it)
2. **M4** — Sanitize `BOT_USERNAME` env var (strip `@` and whitespace)
3. **m3** — At least `console.error(err)` in welcome page catch block

### Defer to follow-up
- **M1/M2** — Delete dead i18n keys OR wire them through `useTranslations` (next polish PR)
- **m5** — Decide where `src/components/` fits in the 4-layer model (`seed/components`?)

---

## Unresolved Questions

1. **Token rotation policy**: should `generatePairingToken` invalidate prior un-used tokens for same `user_id`? Current impl allows N concurrent tokens (multi-tab support). Acceptable but enables session-replay if attacker scrapes Telegram chat history from a shared device.
2. **paired_by column**: should the schema add a separate `paired_user_id` for the web-account flow, or accept the overload? Affects audit clarity.
3. **PNG screenshots for ByokHelpTip**: `public/byok-guide/*.png` files don't exist yet (component handles `onError` gracefully). When will real screenshots ship? README placeholder suggests "later" but no owner.
4. **Welcome page i18n strategy**: refactor entire welcome page to `useTranslations` (with `welcome.*` namespace) or keep the `isVi` ternary pattern site-wide? Codebase has mixed precedent.

---

## Metrics

- TS errors: 0
- New `:any`: 0
- Test pass: 34/34 (new) + 7/7 (setup wizard) + 11/11 (pricing) = 52/52
- Files added: 9
- Files modified: 5
- i18n keys added: vi=46, en=46 — parity verified
- i18n keys dead (unused by code): 18 of 46 (~40%) — cleanup opportunity
