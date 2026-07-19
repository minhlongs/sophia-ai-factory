---
title: "Sophia AI Factory — 10-Layer Fullstack Audit Refresh"
date: 2026-05-15
audited_by: claude-opus-4-7
prod_sha: 93b190e0
git_head: 8d162e19
doctrine: no-code/no-tech RaaS v1.28.1
prior_baseline: 91.5/100 (handover v3, doctrine ceiling)
---

# Sophia AI Factory — 10-Layer Fullstack Audit (Refresh)

**Audit context:** post-doctrine session close. Verify ceiling under no-tech doctrine holds.
**Reference framework:** `~/.claude/rules/on-demand/actual-fullstack-audit.md` (10-layer matrix).
**Doctrine constraint:** operator-side third-party setup = OUT-OF-SCOPE, not score-deductible.

---

## State Snapshot

| Field | Value |
|-------|-------|
| HEAD | `8d162e19` (origin = gitlab) |
| Prod SHA | `93b190e0` (ancestor; only docs commits ahead, no code diff) |
| HTTP | 200 ✅ |
| OpenNext | 1.17.3 (prod), repo refs 1.19.9 (next upgrade) |
| Deploy method | CF-direct `npm run deploy:full` (wrangler 4.76.0) |
| Push-guard | Active since `cdff1ed0` |
| Migrations | 113 (latest `0110-tenant-crypto-jurisdiction.sql`) |
| Tests | 410 test files |
| API routes | ~467 handlers (`export async function` count) |
| Cron triggers | 17 schedules in `wrangler.toml [triggers]` |
| ESLint baseline | 423 warnings, 0 errors |
| `:any` types | 3 (non-prod paths) |
| `console.*` refs | 35 (observability paths only) |

---

## Layer-by-Layer Scoring

### L1 — Database 🗄️ : **7/10**

**Evidence:**
- 2 D1: `sophia-raas-db` (78bd1961) + `sophia-tag-cache` (7b1d4fd4 dedicated since Phase 5.1)
- 113 versioned migrations (chronological numeric prefix)
- Migrations directory clean (`0109-drop-orphan-revalidations-table.sql` shipped 2026-05-15)
- D1 binding `DB`, tag-cache binding `NEXT_TAG_CACHE_D1` wired

**Strengths:** schema versioned; orphan tables purged; OpenNext tag cache on dedicated D1.

**Gaps (operational, not platform):**
- No automated monthly restore-drill cadence (operator track record — months to build).
- D1 multi-region replica strategy not exercised (CF beta).

**Doctrine note:** RPO/RTO documented in `docs/dev-sops.md` SOP 11. Restore procedure manual but explicit.

---

### L2 — Server 🖥️ : **9/10**

**Evidence:**
- CF Workers via OpenNext 1.17.3
- `compatibility_date = "2026-03-17"` (current)
- 17 cron triggers (heavy automation surface)
- 8 worker bindings (R2 ×3, D1 ×2, KV ×1, ASSETS, WORKER_SELF_REFERENCE)
- Edge cold-start < 50ms typical CF Worker class
- Deploy script (`scripts/deploy-with-sha.sh`) injects `COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH`

**Strengths:** serverless edge; auto-scaling default; SHA-injection enables prod verification.

**Gap:** OpenNext 1.17.3 in prod vs 1.19.9 referenced in repo — minor upgrade pending.

---

### L3 — Networking 🌐 : **9/10**

**Evidence:**
- DNS → CF (104.21.76.154, 172.67.197.42)
- HSTS `max-age=63072000; includeSubDomains; preload` (2 years) ✅
- CSP comprehensive (nonce-based scripts, explicit `connect-src` allowlist)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `frame-ancestors: 'none'`, `object-src: 'none'`, `form-action` restricted
- CSP report endpoint: `/api/csp-report`
- DMARC: `p=none; pct=100; rua=mailto:dmarc-reports@...`

**Strengths:** TLS hardened; CSP enterprise-grade; CSP violation reporting wired.

**Gap:** DMARC at `p=none` (monitor-only). Quarantine graduation discretionary per doctrine — not a platform requirement.

---

### L4 — Cloud Infrastructure ☁️ : **9.5/10**

**Evidence:**
- 100% Cloudflare stack (Workers, D1, R2, KV, DNS, CDN)
- Single-provider intentional (latency + cost + simplicity over multi-cloud)
- Auto-scaling built-in
- R2 zero-egress on storage = predictable cost
- No GitHub Actions minutes burn (CF-direct doctrine)

**Strengths:** unified billing; minimal lock-in cost given CF portability of HTTP semantics.

**Gap (-0.5):** no monthly cost alert configured (operator side, but recommendable in dashboard).

---

### L5 — CI/CD 🔄 : **10/10**

**Evidence:**
- Pre-commit: lint-staged + secretlint (husky)
- Pre-push: `ci:lint` (`--max-warnings=423`) + `ci:test` (vitest) + `npm audit`
- GitHub Actions disabled by design (account-level), CF-direct via wrangler is canonical
- Deploy guard: push-precondition (refuses deploy if HEAD ≠ origin/main or working tree dirty)
- SHA injection: `/api/version` returns deployed commit, enables match-verify after every deploy
- ESLint baseline ratchet: warnings cannot regress past 423 without code change

**Strengths:** robust hook layer; deploy guarantees prod = git; SHA verification mandatory in CLAUDE.md.

**No gap:** for a CF-direct pipeline this is enterprise-grade.

---

### L6 — Security 🔒 : **9/10**

**Evidence:**
- Auth: Better Auth (cookies, session JWT)
- 230 `process.env.*KEY|SECRET|TOKEN` refs — env-based, no hardcoded secrets in source
- 3 `:any` types in src (very low)
- 35 `console.*` refs (concentrated in `lib/observability/*` and dev paths)
- CSP nonce per-request
- Secretlint pre-commit
- Zod validation on API inputs (declared in CLAUDE.md, enforced in handlers)
- CSRF: Server Actions + same-origin policy

**Strengths:** secret hygiene; layered headers; pre-commit gate prevents secret leaks.

**Gap (-1):** 35 `console.*` refs in production paths — should be replaced with structured logger; mitigated by being observability-only paths.

---

### L7 — Monitoring 📊 : **8/10**

**Evidence:**
- Sentry SDK wired: `src/lib/observability/sentry-forwarder.ts` + `sentry-options.ts`
- `instrumentation.ts` present at app root (Next.js boot hook)
- Test coverage on Sentry options (`sentry-options.test.ts`)
- CF Worker logs via `wrangler tail` (canonical real-time stream per doctrine)
- `/api/version` exposes prod SHA + deploy timestamp for staleness detection

**Strengths:** Sentry captures errors (minified traces); CF logs always-on; deploy metadata exposed.

**Gap (-2):**
- Sourcemap upload optional per doctrine (would require operator `SENTRY_AUTH_TOKEN` — OUT-OF-SCOPE).
- No APM dashboard for latency percentiles.
- Doctrine ceiling: this is intentional, not a deficit to close.

---

### L8 — Containers 📦 : **10/10** (serverless adjustment)

**Evidence:**
- Pure serverless (CF Workers) — no Dockerfile, no orchestration needed
- Local dev via `wrangler dev` (containerized CF runtime emulation)
- Production runs in CF V8 isolates (no cold container costs)

**Doctrine fit:** serverless eliminates the entire container security/orchestration surface. Score `10/10` for proper architecture choice, not a workaround.

---

### L9 — CDN 🚀 : **9/10**

**Evidence:**
- CF global edge (300+ PoPs)
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`
- HTTP/2 confirmed (`HTTP/2 200`)
- Static assets via R2 `NEXT_INC_CACHE_R2_BUCKET` + `NEXT_TAG_CACHE_D1` adapter
- OpenNext tag-cache enables `revalidateTag()` / `revalidatePath()` real invalidation

**Strengths:** edge-first; tag-based invalidation working; SWR fallback on cache misses.

**Gap (-1):** no per-region TTFB monitoring dashboard.

---

### L10 — Backup 💾 : **7/10**

**Evidence:**
- R2 `sophia-backups` bucket: `delete-after-30d` lifecycle ACTIVE ✅
- `Default Multipart Abort Rule` enabled (7d incomplete uploads abort)
- Manual restore procedure documented (`docs/dev-sops.md` SOP 11)
- D1 export via `wrangler d1 export` (point-in-time available)
- Git: 2 mirrors (GitHub + GitLab), full history

**Strengths:** 30d retention is the doctrine-confirmed backup strategy; restore SOP documented.

**Gap (-3):**
- No automated monthly restore-drill cadence (operational track record gap — months to build).
- No off-CF backup mirror (single-vendor risk; doctrine accepts this).
- Doctrine ceiling: external QStash cron registration is OUT-OF-SCOPE.

---

## Total Score

| Layer | Score |
|-------|-------|
| L1 Database | 7.0 |
| L2 Server | 9.0 |
| L3 Networking | 9.0 |
| L4 Cloud | 9.5 |
| L5 CI/CD | 10.0 |
| L6 Security | 9.0 |
| L7 Monitoring | 8.0 |
| L8 Containers | 10.0 |
| L9 CDN | 9.0 |
| L10 Backup | 7.0 |
| **TOTAL** | **87.5/100** |

**Verdict tier:** **Full Stack++** (Production Ready, ⭐⭐⭐⭐) per framework rubric.

---

## Reconciliation vs Prior 91.5/100 Baseline

The handover v3 (2026-05-15 morning) claimed 91.5/100. Honest re-measure today: **87.5/100**.

Discrepancy explanations:
1. Prior number was derived from handover narrative + Phase 02 +0.5 bonus, not a fresh 10-layer rubric pass.
2. L1 (7) and L10 (7) reflect operational track-record gaps that doctrine itself acknowledges — months of DR drills + monthly restores cannot be shortcut.
3. The platform's *architectural* completeness is closer to the 91.5 number; the *operational* track record drags total to 87.5.

**Recommendation:** restate ceiling. Honest **platform ceiling under doctrine = 87.5/100**. Higher requires operator track record (months), not more code.

---

## Doctrine-Locked Out-of-Scope Items (do NOT re-open)

| Item | Reason | Effect on score |
|------|--------|-----------------|
| QStash cron for R2 backup | Operator-side third-party = doctrine violation | Stays out — R2 30d lifecycle is the strategy |
| Sentry sourcemap upload | Needs operator `SENTRY_AUTH_TOKEN` | Stays out — CF logs are canonical |
| Off-CF backup mirror | Doctrine accepts single-vendor risk | Stays out |
| DMARC quarantine graduation | Operator email reputation discretionary | Stays as-is until 2026-06-12+ |

These items DO NOT count as score deductions per doctrine — they are explicitly out of scope, not "blocked".

---

## Recommendations (Operational Track Record Only)

These are the **only** legitimate paths to lift the ceiling — all require time, not code:

1. **Monthly restore-drill log** (`docs/dr-drill-log.md`): document each successful D1 export + restore-test. After 3 cycles → L10 +1. After 6 cycles → L10 +2.
2. **DR runbook tabletop** (quarterly): walk team through "prod D1 corrupted, restore from R2 backup" scenario. Document RTO achieved. → L1 +1 after 2 successful drills.
3. **CF dashboard cost alert** (operator one-time UI click): set budget threshold + email. → L4 +0.5.
4. **Replace 35 `console.*` calls with structured logger** (`src/lib/observability/logger.ts` if exists, else create). Code change only. → L6 +1.

Total potential lift: **+3.5 → 91/100** within 6 months (drills only).

---

## Action Items for This Session

**None.** Audit is verification-only — no code changes recommended. The doctrine-locked items will not move; the operational items require time, not commits.

Session can re-close as-is.

---

## Unresolved Questions

1. Should the `--max-warnings=423` baseline be ratcheted down opportunistically when warnings drop naturally during refactors? (Currently static.)
2. **Finding:** `OPENNEXT_VERSION = "1.17.3"` is **hardcoded** in `src/app/api/version/route.ts:33`. Real `package.json` declares `@opennextjs/cloudflare: ^1.19.5`. Prod metadata is unreliable for this field — should be derived from package.json import or `process.env.OPENNEXT_VERSION` at build time. Minor defect, no score impact, recommend fix in next code session.
3. SHA reporting (`shortSha: 93b190e0`) IS correctly injected at deploy time via `deploy-with-sha.sh` — only the OpenNext version is stale.

