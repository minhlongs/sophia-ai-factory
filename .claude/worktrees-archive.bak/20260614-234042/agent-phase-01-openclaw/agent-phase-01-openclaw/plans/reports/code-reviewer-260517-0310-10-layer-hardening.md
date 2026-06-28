# Phase 03 — 10-Layer Hardening Audit (Ceiling-Preserving)

**Date:** 2026-05-17
**Reviewer:** code-reviewer agent
**Scope:** `apps/sophia-ai-factory/`
**Ceiling rule:** Honest score remains **87.5/100** per doctrine v1.28.1. Lift requires months of ops track record, not code.

---

## 1. Layer-by-layer findings

| # | Layer | Audit result | Classification |
|---|---|---|---|
| L1 | Database (D1) | `/api/cron/d1-backup` exists; R2 lifecycle 30-day; no drift detector script | Added `scripts/verify-d1-backup.sh` (MUST-FIX, NEW) |
| L2 | Server (CF Workers) | OpenNext build, no subrequest issues found | OK |
| L3 | Networking | curl prod confirms 5 headers + CSP nonce-based, NO `unsafe-inline` in script-src (only style-src for Tailwind, scoped & documented), `unsafe-eval` only in dev | OK |
| L4 | Cloud | Sentry sourcemaps disabled per doctrine (operator-optional); no leaked secrets | OK |
| L5 | CI/CD | CF-direct doctrine; `deploy-with-sha.sh` exit-2 guard for unpushed | OK |
| L6 | Security | Rate limit on `/api/webhooks/clickbank` ✅; **GAP**: `/api/user/byok/test` & `/api/v1/missions/*` lack explicit `checkRateLimit` decorator (relies on cap-per-min comment only) | FLAGGED (NICE-TO-FIX) |
| L7 | Monitoring | `scrubPII`/`scrubPIIDeep` existed in `lib/telemetry/pii-scrubber.ts` but was **NOT wired into the primary logger** — raw metadata/messages flowed to Sentry & console | **MUST-FIX (applied)** |
| L8 | Containers | N/A (serverless) | N/A |
| L9 | CDN | `_next/static` immutable `max-age=31536000`; public pages `s-maxage=60 SWR=600` | OK |
| L10 | Backup | R2 lifecycle 30d + `/api/cron/d1-backup` route + idempotency guard | OK (added drift script) |

---

## 2. Remediations applied

| File | Change | LOC delta |
|---|---|---|
| `src/seed/utils/logger-internals.ts` | Imported `scrubPII`/`scrubPIIDeep`; added `redactSecretKeys()` (key-name allowlist regex); wrapped message + metadata + error.message/stack/details/hint at log entry construction | +30 / -6 |
| `scripts/verify-d1-backup.sh` (NEW) | Drift detector: exports remote `.schema`, lists tables, diffs vs `migrations/*.sql`, exits 1 on unexpected drift. Read-only — NO restore | +107 (new) |

**Total: ~131 LOC across 2 files. Both <50 LOC of business-logic delta (script is bash, not app code).**

### Logger redaction detail
- Secret-key regex covers: `secret|password|passwd|token|api_key|cron_secret|auth_token|access_key|private_key|signing_key` (case-insensitive, word-boundary on `_`)
- Value-shape patterns (sk-/pk_/eyJ JWT/Bearer/email/phone) handled by existing `scrubPII`
- Applied to: `message`, `metadata`, `error.message`, `error.stack`, `error.details`, `error.hint`
- Defence in depth — both key-name AND value-shape filters run

### Drift script detail
- No new deps (uses `npx wrangler` already in repo)
- Output gitignored (`/tmp/`)
- Doc-comment notes "drift during in-flight migration is EXPECTED" to avoid false-positive alerts

---

## 3. Remediations flagged for follow-up

| Layer | Finding | Why deferred |
|---|---|---|
| L3 (CSP) | `style-src 'unsafe-inline'` present | **Required by Tailwind** dynamic class injection — removing would break rendering. Documented in `content-security-policy-configuration.ts:5,32`. Not a vulnerability. |
| L3 (CSP) | `script-src 'unsafe-eval'` in dev only | Required by Next.js HMR. Already conditional on `NODE_ENV !== 'production'`. Safe. |
| L6 (rate limit) | `/api/user/byok/test/route.ts` has cap-comment but no `checkRateLimit()` call | Out-of-scope per phase plan ("DO NOT add new rate-limit code"). Open a follow-up phase to add `checkRateLimit('byok-test:${userId}', 10, 60)` after `getCurrentUser()` at line 67. |
| L6 (rate limit) | `/api/v1/missions/*` lacks explicit limiter | Tier-based quota enforcement happens upstream via `forest/quota` — may be sufficient. Needs deliberate review before adding overlapping limits. |
| L10 | `/api/cron/d1-backup` requires external cron (Upstash QStash) | **OUT-OF-DOCTRINE** — operator action required. Per doctrine, R2 lifecycle IS the backup strategy. Manual curl trigger remains for ad-hoc DR drills. |

---

## 4. Updated honest score per layer

| Layer | Pre | Post | Notes |
|---|---:|---:|---|
| L1 Database | 7/10 | 7/10 | Drift script is monitoring, not backup capability |
| L2 Server | 9/10 | 9/10 | No change |
| L3 Networking | 9/10 | 9/10 | Headers already complete |
| L4 Cloud | 9.5/10 | 9.5/10 | No change |
| L5 CI/CD | 10/10 | 10/10 | No change |
| L6 Security | 9/10 | 9/10 | Rate-limit gap flagged but unchanged |
| L7 Monitoring | 8/10 | 8/10 | PII scrub now wired but ops track record unchanged |
| L8 Containers | 10/10 | 10/10 | N/A by framework |
| L9 CDN | 9/10 | 9/10 | No change |
| L10 Backup | 7/10 | 7/10 | Lifecycle-based |
| **TOTAL** | **87.5/100** | **87.5/100** | **Ceiling preserved per doctrine** |

**No score lift claimed.** Logger redaction tightens posture but doctrine ceiling is gated on operational evidence, not code quality alone.

---

## 5. Unresolved questions

1. Should the byok-test endpoint adopt `tree/telegram/sql-rate-limiter`'s `checkRateLimit` pattern, or is the implicit per-user tier quota sufficient? (Owner: security follow-up phase.)
2. Does `scrubPII`'s phone-pattern `\+?[0-9]{8,15}` over-redact innocent numeric IDs in logs (e.g., user_id, timestamps)? Worth running a 24h prod sample against the new logger to confirm no observability blind spots.
3. `verify-d1-backup.sh` was not run end-to-end against prod (would require operator wrangler auth). Operator should run once and confirm zero-drift baseline before relying on it in pipelines.

---

**Files touched:**
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/utils/logger-internals.ts` (modified)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/verify-d1-backup.sh` (new, +x)

**Not touched (intentionally):**
- `next.config.ts` — all required headers already present
- `src/seed/security/content-security-policy-configuration.ts` — `unsafe-inline`/`unsafe-eval` scoped & justified
- Any rate-limit decorator — out of phase scope
- No deploy, no commit (per instructions)
