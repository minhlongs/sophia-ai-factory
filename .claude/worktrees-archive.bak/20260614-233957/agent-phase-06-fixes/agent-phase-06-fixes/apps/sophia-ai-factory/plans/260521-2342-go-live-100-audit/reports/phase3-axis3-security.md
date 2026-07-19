# Phase 3 — Axis 3: Security Audit (Honest)

**Date:** 2026-05-22
**Prod SHA:** `d86659bf`
**Doctrine:** sophia-no-tech SUSPENDED for this audit. Score reflects code reality, not narrative ceiling.
**Auditor:** automated review against live source at `apps/sophia-ai-factory/src/`

---

## Total Score: **35.5 / 60**

| # | Sub-area | Score |
|---|---|---:|
| 1 | AuthN / session integrity | 6.5/10 |
| 2 | AuthZ / IDOR / multi-tenant isolation | 3/10 |
| 3 | Secrets & key management (BYOK, master key rotation) | 6/10 |
| 4 | Crypto correctness (AES-GCM AAD, IV, sig verify) | 6/10 |
| 5 | Dependency hygiene | 5/10 |
| 6 | Input validation (Zod) | 9/10 |

---

## 1. AuthN / Session Integrity — 6.5/10

**Evidence:**
- `src/seed/auth/better-auth-server.ts:82-85` — `session.expiresIn = 7 * 24 * 60 * 60` (7 days), cookieCache 5 min.
- `src/seed/auth/better-auth-server.ts:112-125` — MFA hook (`requireMfaIfEnabled`) wired but NON-BLOCKING: comment `"Non-blocking — log but don't prevent session creation"` → MFA failure does not block session. Soft-fail by design.
- `src/seed/auth/better-auth-session.ts` is the single canonical helper; `lib/auth.ts` deleted (per consolidation 2026-04-14).

**Findings:**
- **A-1.1 [MEDIUM]** 7-day fixed session w/ no sliding rotation, no idle timeout. For a RaaS platform handling money + BYOK creds, target ≤24h absolute + 30-min idle or rotate-on-use.
- **A-1.2 [MEDIUM]** MFA gate is observational (`markSessionMfaPending` but session still issued). User with stolen password + MFA enabled can still get a usable session if hook errors. Should hard-fail.
- **A-1.3 [LOW]** No evidence of session-fixation rotation on login (Better Auth default behavior — verify version 1.6.2 rotates).

**Strengths:** Single canonical helper, no scattered auth implementations, cookieCache short.

---

## 2. AuthZ / IDOR / Multi-tenant Isolation — 3/10 (CRITICAL — P0)

**Evidence:**

### V-1.1 IDOR retry/resume (CVSS 9.1) — CONFIRMED
- `src/app/actions/campaigns-retry-resume.ts:27-80` `retryCampaign(campaignId)`:
  - Line 31-35: fetches campaign by id only, NO `getCurrentUser()` call anywhere in file.
  - Line 50: reads target `c.user_id` from row, uses it for tier lookup + event dispatch — attacker triggers reprocessing of victim's campaign, consuming victim's quota + costing victim money for LLM/TTS/render.
- Same pattern in `resumeCampaign` (line 85-158).
- **Net:** any authenticated user can replay/resume ANY campaign by guessing/leaking UUID. Server Action exposed via React form-action.

### V-1.2 RaaS API key not user-bound (CVSS 9.6) — CONFIRMED
- `src/app/api/v1/campaigns/create/route.ts:27-51` `validateRaasApiKey` returns `boolean`, queries `raas_licenses` for `is_revoked` + `expires_at` only — does NOT return owning user_id.
- Line 93: `userId` taken from **request body** (Zod-validated as non-empty string but no identity binding).
- Line 110, 127, 152: campaign written with attacker-supplied userId; campaign quota consumed against arbitrary victim; Inngest dispatched against victim's tier.
- **Net:** any valid RaaS license = full impersonation of any platform user.

### V-1.3 Tenancy boundary collapse — CONFIRMED
- `migrations/0018-campaigns.sql`: `campaigns` table has `user_id TEXT NOT NULL` but NO `org_id` column. Multi-tenant org isolation not enforced at row level.
- `migrations/0005-signals-events.sql:7`: `signals_events.org_id` is **nullable** with comment `loosely to org_members.org_id` — `NULL` org_id rows are unbounded.
- D1 has no native RLS; org_id must be a hard WHERE on every query. No central guard. Spot-check shows `.eq("user_id", ...)` only.

**Findings:**
- **V-1.1 P0** retryCampaign/resumeCampaign — add `getCurrentUser()` + `WHERE user_id = session.userId` check.
- **V-1.2 P0** validateRaasApiKey must return `{ valid: true, user_id }` and route must REJECT body.userId mismatch.
- **V-1.3 P0** campaigns missing org_id FK; signals_events.org_id nullable. Add NOT NULL + backfill + index `(org_id, user_id)`. Without it any per-org feature is theoretical.

**Score rationale:** Three concurrent P0 IDOR/tenant defects. 3/10 is generous — production should not ship in this state.

---

## 3. Secrets & Key Management — 6/10

**Evidence:**
- `src/tree/byok/byok-crypto.ts:40-58` — master key from `process.env.BYOK_MASTER_KEY`, base64, 32 bytes, AES-GCM-256. Single env var, no KMS, no envelope encryption.
- `src/tree/credentials/encryption.ts:46-69` — accepts EITHER `CREDENTIALS_MASTER_KEY` (hex) OR `BYOK_MASTER_KEY` (b64) as fallback — two key formats / two paths for same primitive.
- No rotation strategy in repo: no `key_version` column on `user_api_keys` or `user_provider_credentials`, no rewrap routine, no dual-decrypt path. Rotating BYOK_MASTER_KEY = irreversibly bricks all stored creds.
- IV is correctly random per encrypt (`crypto.getRandomValues`), 12 bytes — no IV reuse risk under random sampling.
- Master key stored as Cloudflare Worker secret (per CLAUDE.md). No HSM, no Cloud KMS.

**Findings:**
- **S-3.1 [HIGH]** No key rotation possible without data loss. Add `key_version` column + dual-key decrypt window.
- **S-3.2 [MEDIUM]** Dual env var path (CREDENTIALS_MASTER_KEY vs BYOK_MASTER_KEY) increases misconfiguration risk; consolidate.
- **S-3.3 [LOW]** No envelope encryption (DEK/KEK split) — single key compromise = total compromise of all stored creds across all tenants.

---

## 4. Crypto Correctness — 6/10

**Evidence:**

### V-2.1 AES-GCM missing AAD (CVSS 7.4) — CONFIRMED
- `src/tree/byok/byok-crypto.ts:73` — `crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt)` — NO `additionalData` field.
- `src/tree/credentials/encryption.ts:80` — same omission.
- `docs/SECURITY.md:143` documents `aad=userId` → doc/code mismatch.
- Without AAD bound to `user_id` (or row PK), ciphertext can be relocated between rows without detection. Insider DB write or backup-restore mishap can swap user A's encrypted key into user B's row; both decrypt cleanly.

**Other:**
- IV generation correct (random 12-byte per call).
- NOWPayments IPN signature: `src/tree/clients/nowpayments-client.ts:98-110` uses HMAC-SHA512 over sorted JSON keys via `verifyInboundWebhook`. Route guards `if (!signature) → 400`, `if (!NOWPAYMENTS_IPN_SECRET) → 500`. Signature verify is correct.
- Auth tag automatic (AES-GCM 128-bit).

**Findings:**
- **V-2.1 P1** add AAD = `TextEncoder().encode(\`${userId}:${rowId}\`)` to both `byok-crypto.ts` and `encryption.ts`. Migration: re-encrypt existing rows or accept-AAD-optional decrypt window.

---

## 5. Dependency Hygiene — 5/10

**Evidence (live as of 2026-05-22):**
- `gh api dependabot/alerts?state=open&severity=high` → **12 HIGH** (NOT 37 — seed count was stale or counted dismissed). All 12 are `next` package CVEs:
  - Middleware/Proxy bypass i18n Pages Router (×4 dupes across branches)
  - DoS via Server Components (×4)
  - SSRF via WebSocket upgrades (×4)
  - DoS connection exhaustion (Cache Components) (×4)
  - Middleware bypass App Router segment-prefetch (×4)
- Plus 10 MEDIUM + 8 LOW.
- `npm audit --audit-level=high` returns 0 (different surface — Dependabot scans GitHub graph, audit scans local lockfile). `npm audit` shows moderate-only: `miniflare`, `protobufjs`, `wrangler`.
- Current `next: ^16.2.3`. Seed mentioned bump to `^16.2.5`. **Verify ^16.2.5 actually closes ALL 5 advisories** — last advisory (Cache Components DoS) may need newer.

**Findings:**
- **D-5.1 P1** bump `next` to latest patch (verify against each of 5 CVEs); single bump closes all 12 HIGH alerts.
- **D-5.2 [MEDIUM]** No `npm audit` in CI (CI disabled per CF-direct doctrine). Add `npm audit --audit-level=high` to pre-push hook.
- **D-5.3 [LOW]** No SBOM, no signed commits enforcement, no supply-chain pinning (Renovate not visible).

---

## 6. Input Validation (Zod) — 9/10

**Evidence:**
- 135 of 372 API route.ts files contain `z.object|z.parse|safeParse` (~36% routes use Zod by file count; many sub-routes share validators via barrel imports → real coverage higher).
- Sample inspection: `src/app/api/v1/campaigns/create/route.ts:14-20` uses `createCampaignBodySchema` with `safeParse` + structured error response.
- Server actions: 8/15 `src/app/actions/*.ts` import Zod. retry/resume action takes raw string campaignId — but the IDOR is the killer, not validation.
- 4 `: any` types in prod (excluding tests/migrations) — very low.
- Zero `console.log` per project rule.

**Findings:**
- **I-6.1 [LOW]** Server Actions that accept user input directly without Zod (retry/resume just takes a raw string). Cheap fix.
- **I-6.2 [LOW]** Per-route audit not exhaustive — recommend a CI lint rule requiring `z.parse|safeParse` in any `route.ts` with POST/PUT/PATCH.

**Strengths:** Strong Zod culture, minimal `:any`, structured error responses with `fieldErrors`.

---

## P0 Blocker List (must fix before 100/100 GO-LIVE)

1. **V-1.1 IDOR retryCampaign/resumeCampaign** — `src/app/actions/campaigns-retry-resume.ts:27,85` — add session check + WHERE user_id.
2. **V-1.2 RaaS API key impersonation** — `src/app/api/v1/campaigns/create/route.ts:27,93` — bind license to user_id, reject body.userId mismatch.
3. **V-1.3 Multi-tenant schema** — `migrations/0018-campaigns.sql` add `org_id NOT NULL` + FK + backfill; `migrations/0005-signals-events.sql` make `org_id` NOT NULL after backfill.
4. **V-2.1 AES-GCM AAD** — `src/tree/byok/byok-crypto.ts:73`, `src/tree/credentials/encryption.ts:80` — pass `additionalData = encode(userId|rowId)`; align with `docs/SECURITY.md:143`.
5. **D-5.1 Next.js HIGH CVEs** — bump `next` past 16.2.5 to version covering all 5 advisories (verify Cache Components DoS fix version specifically).

## P1 (post-GO-LIVE within 30 days)

- A-1.2 MFA hard-fail
- A-1.1 session lifetime tightening + sliding rotation
- S-3.1 key rotation infrastructure (key_version column)
- D-5.2 npm audit pre-push hook

---

## Unresolved Questions

1. Seed claimed 37 HIGH Dependabot alerts; live API shows 12 HIGH. Did 25 get dismissed/auto-closed since seed snapshot, or was seed counting differently (e.g. including dismissed/fixed)?
2. Does `next@16.2.5` actually patch ALL 5 advisory clusters, or is one (e.g. Cache Components DoS) only fixed in a later 16.2.x? Need to confirm against Vercel advisory feed before bump PR.
3. Is `requireMfaIfEnabled` non-blocking by deliberate product decision (UX) or by oversight? Affects whether A-1.2 is P0 or P1.
4. RaaS `raas_licenses` table — does the schema actually have a `user_id` / `owner_id` column that V-1.2 fix can reference, or does it need a migration?
5. signals_events org_id backfill source: where does the org_id come from for historical NULL rows? Need product input.

---

**File:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/plans/260521-2342-go-live-100-audit/reports/phase3-axis3-security.md`
**Total: 35.5/60** — current state is NOT 100/100-eligible. 5 P0 blockers gate the green light.
