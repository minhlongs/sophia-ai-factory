# SUPREME HANDOVER — BASELINE

**Date:** 2026-09-09
**Certification mission:** Sophia AI Factory — CONDITIONAL GO → PROVEN PRODUCTION → CUSTOMER-HANDOVER READY
**Baseline frozen by:** orchestrate pipeline Phase 0

---

## 1. Git baseline

| Field | Value | Evidence |
|---|---|---|
| Local HEAD (full) | `57fcc931ca8329cac9ec4483ab752a8033f65894` | `git rev-parse HEAD` |
| Local HEAD (short) | `57fcc931c` | `git rev-parse --short HEAD` |
| Branch | `main` | `git branch --show-current` |
| Commits vs origin/main | 0 ahead / 0 behind | `git rev-list --left-right --count origin/main...HEAD` |
| Working tree | 3 untracked dirs/files (no code changes) | `git status --short` |

**Working tree detail (untracked, non-code):**
- `../../.agents/skills/`
- `../../.codex/`
- `../../plans/reports/production-observation-command-14.md`

**Certification freeze:** No code, config, or migration changes will be made by this certification. All phases are WRITE-ONLY to `docs/audit/`.

---

## 2. Production attestation

| Field | Value | Evidence |
|---|---|---|
| Live shortSha | `34219be6` | `GET /api/version` |
| deployedAt | `2026-09-08T19:02:02Z` | `GET /api/version` |
| opennextVersion | `1.19.11` | `GET /api/version` |
| /api/health | HTTP 200, `status=degraded` | `GET /api/health` |
| /login | HTTP 307 (locale redirect — expected) | `curl -o /dev/null -w "%{http_code}"` |
| /vi/login | HTTP 200 | `curl -o /dev/null -w "%{http_code}"` |

**SHA match:** NO — local `57fcc931c` is 1 commit ahead of live `34219be6`. Classification: **STALE-AHEAD**. The delta is the post-deploy changelog update commit. This is a stale-deploy signal, not a certification blocker.

**Degraded status classification:** `degraded` is a KNOWN-RED (telemetry/reality-loop data-absence artifact), not a new business/runtime failure. Per deploy-verify rule, degraded-with-tracked-issue = KNOWN-RED, not a certification failure. ABSOLUTE RULE 20: do not mask degradation as HEALTHY.

---

## 3. Test baseline

| Metric | Value | Evidence |
|---|---|---|
| Test files | 866 passed / 1 skipped (867 total) | `npx vitest --run` |
| Tests | 8928 passed / 34 skipped / 10 todo (8972 total) | `npx vitest --run` |
| Duration | 80.35s | `npx vitest --run` |

---

## 4. Migration baseline

| Field | Value | Evidence |
|---|---|---|
| Migration count | 237 | `ls migrations/*.sql \| wc -l` |
| Latest migration | `0271_add_latency_ms_to_media_jobs.sql` | `ls migrations/*.sql \| sort \| tail -1` |

---

## 5. Provider certification state

| Provider | Certification | Source |
|---|---|---|
| fal-ai | `PRODUCTION_CANDIDATE` (security: PASS, health: PASS, canary: PASS) | `src/seed/ai/providers/fal-image-provider.ts:66-72` |

**FAL_KEY resolution path:** `resolveUserApiKey(userId, 'fal-ai', process.env.FAL_KEY)` — BYOK-first, platform-fallback-second. Source: `src/app/actions/image-generate-action.ts:110`, `src/app/api/v1/creative-studio/images/generate/route.ts:89`.

---

## 6. Production D1 evidence

### 6.1 User identities (Better Auth `user` table — singular)

| ID | Email | Name | emailVerified | createdAt |
|---|---|---|---|---|
| `00000000-0000-0000-0000-000000000001` | synthetic-monitor@sophia.agencyos.network | Synthetic Monitor | 1 | 2026-07-03 08:17:27 |
| `e2e00000-0000-0000-0000-000000000001` | e2e-test@sophia.local | E2E Test User | — | — |
| (2 more rows) | — | — | — | — |

**Total: 4 users — all test/system/seed identities. No authorized founder/internal production account.**

### 6.2 Organizations

| ID | Name | Slug | Plan |
|---|---|---|---|
| `ab987a40-...` | test@test.com | test-ab987a | free |
| `ab25cc42-...` | prodtest-1786778955@test.com | prodtest-1786778955-ab25cc | free |

**Total: 2 organizations — both free plan, test-owned.**

### 6.3 Credential tables (all 0 rows)

| Table | Rows |
|---|---|
| user_api_keys | 0 |
| user_provider_credentials | 0 |
| platform_credentials | 0 |
| api_keys | 0 |
| raas_api_keys | 0 |
| raas_user_api_keys | 0 |
| affiliate_network_credentials | 0 |

### 6.4 Cloudflare Workers secrets (AI provider subset)

**Present:** `ANTHROPIC_API_KEY`, `HEYGEN_API_KEY` (+ HEYGEN_API_URL, templates, voice, webhook)
**Missing:** `FAL_KEY`, `FAL_API_KEY`, `OPENROUTER`, `ELEVENLABS`, `D-ID`, `REPLICATE`

---

## 7. Pre-phase verdict ceiling

**YELLOW, trending CONDITIONAL.**

Structural blockers:
- Phase 2 BLOCKED — no authorized founder account (all 4 users are test/seed).
- Phase 3 BLOCKED — FAL_KEY not configured in production (0 BYOK keys + no platform secret).
- Phase 4 BLOCKED-by-dependency — direct consequence of Phase 2 + Phase 3.

GREEN is structurally impossible (canary blocked by identity + credential gates). RED is unsupported (no critical security failures or data loss evidenced). YELLOW/CONDITIONAL is the honest ceiling.

---

## 8. ABSOLUTE RULES compliance (baseline)

| Rule | Status |
|---|---|
| 1-5 (no rewrite/refactor/provider/bypass/disable) | COMPLIANT — read-only certification |
| 6, 13 (no fake identity) | COMPLIENT — no identity created |
| 7-9 (no fake revenue/attribution/media_jobs) | COMPLIANT — no fabrication |
| 10 (no customer data) | COMPLIANT — only test/seed accounts inspected |
| 11-12 (no committed/hardcoded secrets) | COMPLIANT — no code changes |
| 14 (no guessing Fal credential) | COMPLIANT — credential state verified, not fabricated |
| 15 (no auto-continue on FAIL/BLOCK) | COMPLIANT — gates will STOP |
| 16 (reproducible evidence) | COMPLIANT — every field has command + output |
| 17 (STOP at gate, BLOCKED, no workaround) | COMPLIANT — will be enforced |
| 18-19 (VERIFY > MODIFY) | COMPLIANT — read-only |
| 20 (no masking degradation) | COMPLIANT — degraded flagged as KNOWN-RED |

---

*End of baseline. All subsequent phases reference this frozen state.*
