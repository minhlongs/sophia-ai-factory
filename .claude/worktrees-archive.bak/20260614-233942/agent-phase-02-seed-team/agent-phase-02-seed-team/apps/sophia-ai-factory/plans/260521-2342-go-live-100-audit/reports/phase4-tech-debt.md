# Phase 4 — Consolidated Tech-Debt Backlog

**Date:** 2026-05-22
**Audit cycle:** Go-Live 100/100 (doctrine SUSPENDED per user 2026-05-21)
**Inputs:** phase1-synthesis, phase1-dirty-tree-triage, phase3-axis2-scalability + seed findings (verified against HEAD)
**Live anchors:** prod SHA `b8c4f6dd` · D1 `78bd1961` · package `next@^16.2.3`, `@opennextjs/cloudflare@^1.19.5`, prod 1.17.3

> **Source coverage caveat:** Of 6 Phase-3 axis reports referenced in the task brief, only **phase3-axis2-scalability.md** exists on disk. Axes 1/3/4/5/6 reports were never produced. CRITICAL/HIGH/MEDIUM findings below are anchored to (a) Phase 1 synthesis, (b) verified seed findings, (c) Phase 3 axis 2. Findings labeled `[INFERRED]` come from cross-cutting Phase 1 notes, not a dedicated axis report.

---

## 1. Executive Summary

| Severity | Count | Examples |
|---|---:|---|
| **P0 CRITICAL** (go-live blockers) | **7** | IDOR, RaaS key not user-bound, AES-GCM AAD, Next CVE, B2 unpushed, campaigns no org_id, console.* leakage |
| **P1 HIGH** (sprint 1) | **8** | missing compound indexes, OPENNEXT version drift, d1-backup no cron, cross-layer violations, signals_events NULL org_id, Inngest timeout, BYOK rotation runbook, schema 1.20 pre-test |
| **P2 MEDIUM** (month 1) | **9** | 341 ESLint warnings, immutable audit log, mission quota, job batching, Sentry sourcemaps, Better Stack wiring, DOQueueHandler observability, tag-cache error wrap, error_log index |
| **P3 LOW** (backlog) | **6** | dead crons (12), legacy Supabase tables, webhook quota, member quota, DO latency obs, cosmetic |
| **TOTAL** | **30** | |

**Honest verdict:** 7 P0 items must ship before "go-live" is honest. None of P1/P2/P3 alone blocks launch, but P1 cluster (esp. d1-backup cron + OPENNEXT drift + compound index) determines whether the platform survives week 1.

---

## 2. CRITICAL (P0) — Go-Live Blockers

### P0-1 · IDOR in campaign retry/resume server actions
- **ID:** V-1.1
- **File:** `src/app/actions/campaigns-retry-resume.ts:27-72` (retryCampaign), `:85-150` (resumeCampaign)
- **Evidence:** Functions fetch campaign by `campaignId`, read `c.user_id` from DB row, then operate on it. **NO `getCurrentUser()` call.** Any authenticated session can retry/resume ANY campaign owned by ANY user by guessing/enumerating UUIDs.
- **Impact:** Authenticated tenant-to-tenant write. Tier of victim's account drained (HeyGen/ElevenLabs quota burn). CVSS ~7.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:L).
- **Fix sketch:** Import `getCurrentUser` from `@/seed/auth/better-auth-session`; gate at top of both functions; return 403 if `user.id !== c.user_id`. Add unit test for cross-user denial.
- **Effort:** S
- **Owner:** auth/server-actions

### P0-2 · RaaS API key not bound to user
- **ID:** V-1.2
- **File:** `src/app/api/v1/campaigns/create/route.ts` (validateRaasApiKey returns `boolean`, lines ~28-50; body schema accepts arbitrary `userId` line ~19)
- **Evidence:** `validateRaasApiKey` checks key is non-revoked + non-expired but does not return owning userId. Route then trusts `body.userId`. **Any valid RaaS key can create campaigns charged to ANY user.**
- **Impact:** Cross-tenant billing/quota exhaustion via API. Confidentiality + integrity. CVSS ~8.1.
- **Fix sketch:** Change `validateRaasApiKey` to return `{ ownerUserId } | null`; drop `userId` from body schema; use returned ownerUserId for downstream Inngest dispatch.
- **Effort:** S
- **Owner:** RaaS API team

### P0-3 · AES-GCM missing AAD (BYOK + credentials)
- **ID:** V-2.1
- **Files:** `src/tree/byok/byok-crypto.ts:73` (`crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, pt)` — no `additionalData`), `src/tree/credentials/encryption.ts:80` (same pattern).
- **Evidence:** AES-GCM call sites omit `additionalData`. Ciphertexts not bound to `(userId, provider)` tuple. Swap-attack: if attacker gains DB write, can swap row.user_id and decrypt cleanly with same master key.
- **Impact:** Defense-in-depth gap. Combined with absent audit log (P2-2), a DB compromise is undetectable. CVSS ~5.9.
- **Fix sketch:** Pass `additionalData: te.encode(\`${userId}:${provider}\`)` to encrypt/decrypt; migration 0118 re-encrypt existing rows OR add `version` column and decrypt both paths until rotated.
- **Effort:** M (re-encrypt path)
- **Owner:** security/byok

### P0-4 · Next.js CVE-2026-44575 / 45109
- **ID:** V-5.2
- **File:** `package.json` → `"next": "^16.2.3"`
- **Evidence:** Caret allows 16.2.3+. Patched in 16.2.5. Confirm via `npm view next time` or Dependabot alert (37 HIGH cited in Phase 1).
- **Impact:** Per CVE class (RSC/SSR), potential cache poisoning + middleware bypass. CVSS rated HIGH upstream.
- **Fix sketch:** Bump to `"next": "^16.2.5"`, regenerate lockfile, run full test suite (4,668 cases), redeploy CF.
- **Effort:** S
- **Owner:** platform

### P0-5 · B2 cross-tenant HeyGen webhook leak — UNPUSHED commit
- **ID:** GAP-S1 (Phase 1)
- **Evidence:** Phase 1 triage line 11; unpushed commit `d68b4d96` contains B1/B2/B3. B2 = HeyGen webhook user-scoping. **Currently un-shipped in prod** — security hole live.
- **Impact:** Inbound webhook payload can mutate other users' video rows. CVSS ~7.5.
- **Fix sketch:** `git push origin main` then `npm run deploy:full` then verify SHA match per `sophia-deploy-verify.md`.
- **Effort:** S (0 code; deploy only)
- **Owner:** release

### P0-6 · `campaigns` table missing `org_id` column
- **ID:** GAP-S2 / phase3-axis2 sub-area 6 finding 2
- **File:** migrations/* (no migration adds org_id to campaigns table); query sites use `user_id` only
- **Evidence:** researcher-02 + phase3-axis2 confirm; if user switches org, campaigns don't follow → cross-tenant data orphaning when org reassignment happens. Multi-tenant isolation is tenant-by-user, not tenant-by-org.
- **Impact:** Cross-tenant data visibility under org membership transitions. Latent until first org-switch event.
- **Fix sketch:** Migration 0118: `ALTER TABLE campaigns ADD COLUMN org_id TEXT`; backfill from user_profiles.org_id; add FK; update query sites (audit ~12 sites grep `from("campaigns")`); add (org_id, user_id, status) compound index.
- **Effort:** L
- **Owner:** data team
- **Note:** May be downgradable to P1 if confirmed no org-switching feature shipped. **Verify before deferring.**

### P0-7 · `console.*` leakage in production code paths
- **ID:** GAP-D1
- **Evidence:** 36 hits in `src/**/*.{ts,tsx}` excluding tests (verified via grep). Phase 1 noted 35. Per project rules (`sophia-handover-rules.md`, `development-rules.md`): "No `console.log` in production code."
- **Impact:** PII leak risk to CF Worker logs (potentially visible in `wrangler tail`); regression of explicit quality gate.
- **Fix sketch:** Replace with `logger.warn/error` from `@/seed/utils/logger-utility`; add ESLint rule `no-console: error` for `src/**` excluding `scripts/**` and `__tests__/**`; fail CI on new violations.
- **Effort:** M (36 sites + lint rule)
- **Owner:** platform
- **Note:** Borderline P0/P1. P0 because (a) explicit doctrine rule, (b) some hits may be in webhook/auth paths that log secrets. Audit first 10 hits to confirm severity; if all benign, demote to P1.

---

## 3. HIGH (P1) — Sprint 1 Post Go-Live

### P1-1 · Missing compound index `(org_id, status, created_at)` on missions
- **Source:** phase3-axis2 §1 finding 1
- **File:** migrations/0091 added composite for publishing_jobs but skipped missions
- **Fix:** Migration 0118 `CREATE INDEX idx_missions_org_status_ts ON missions(org_id, status, created_at DESC);`
- **Effort:** S

### P1-2 · OPENNEXT_VERSION hardcoded → prod/package drift
- **Source:** phase4-discovery carryover + axis2 §5 finding 2
- **File:** `src/app/api/version/route.ts:33` (`const OPENNEXT_VERSION = "1.17.3"`); package.json `^1.19.5`
- **Fix:** Read at build time: `import pkg from "../../../../package.json" assert {type:"json"}` then `pkg.dependencies["@opennextjs/cloudflare"]`. OR inject `OPENNEXT_VERSION` env via deploy script.
- **Effort:** S

### P1-3 · d1-backup cron never registered externally
- **Source:** phase1-synthesis "Reliability gaps" line 32
- **File:** `src/app/api/cron/d1-backup/route.ts` exists; no operator cron triggering it. (Doctrine suspended → this IS in scope.)
- **Fix:** Wire QStash schedule (QSTASH_TOKEN provisioned per task #14) → POST `/api/cron/d1-backup` daily; verify R2 `BACKUPS_BUCKET` receives objects; document restore procedure.
- **Effort:** M

### P1-4 · d1_migrations tracking drift (4 of ~120)
- **Source:** Phase 1 Q3, unresolved
- **Evidence:** researcher-02 says 117 applied; researcher-04 says 120 local. Likely 4 migrations unapplied OR tracking table out of sync.
- **Fix:** Run `npx wrangler d1 migrations list sophia-raas-db --remote`; reconcile; backfill `d1_migrations` rows for any that ran via raw `execute`.
- **Effort:** S (assessment) + M (if real drift)

### P1-5 · Cross-layer architecture violations (16)
- **Source:** Phase 1 synthesis "DevEx gaps"; rule `cross-layer-orchestration.md`
- **Fix:** `grep -rn "from ['\"]@/forest" src/land/ src/tree/`; `grep -rn "from ['\"]@/land" src/tree/`. Each violation either (a) move logic to seed, (b) invert via event, or (c) document exception.
- **Effort:** M

### P1-6 · `signals_events.org_id` nullable + loose FK
- **Source:** phase3-axis2 sub-area 6 finding 3 + phase1-synthesis
- **Fix:** Migration 0119 — `UPDATE signals_events SET org_id = (SELECT org_id FROM user_profiles WHERE user_id = signals_events.user_id) WHERE org_id IS NULL;` then `ALTER TABLE ... ADD CHECK (org_id IS NOT NULL)`. Verify zero NULLs first.
- **Effort:** S

### P1-7 · BYOK master-key rotation runbook missing
- **Source:** Phase 1 synthesis "Security gaps" + "Documentation gaps"
- **Fix:** `docs/runbooks/byok-master-key-rotation.md` — procedure: (a) new key in wrangler secret, (b) re-encrypt loop reading old/decrypting/encrypting with new, (c) atomic env flip, (d) verification query. Coordinate with P0-3 AAD migration.
- **Effort:** M

### P1-8 · Tag-cache schema 1.20 pre-upgrade test
- **Source:** phase3-axis2 sub-area 5 finding 1
- **Fix:** Add `scripts/verify-opennext-tagcache-schema.mjs` — extracts d1-next-tag-cache schema from installed package, diffs against migration 0108. Wire into `prepublish` or `predeploy`.
- **Effort:** M

---

## 4. MEDIUM (P2) — Month 1

### P2-1 · 341 ESLint warnings baseline
- **Source:** phase1-synthesis "DevEx gaps"
- **Fix:** Ratchet — convert top 3 warning categories to errors after each sprint cleanup; target 0 within 3 sprints.
- **Effort:** L (cumulative)

### P2-2 · No immutable audit log for BYOK/permission mutations
- **Source:** phase1-synthesis "Security gaps" + phase3-axis2 sub-area 6 finding 3
- **Fix:** Migration 0120 create `audit_log` (append-only via TRIGGER preventing UPDATE/DELETE); wrap delete/update sites in `tree/credentials/`, `tree/byok/`, org permission code.
- **Effort:** L

### P2-3 · Missions/campaigns backlog quota missing
- **Source:** phase3-axis2 sub-area 3 finding 2
- **Fix:** Extend `forest/quota/` with `maxConcurrentMissions` per tier; gate dispatch in inngest functions.
- **Effort:** M

### P2-4 · Cron job batching (no batch fan-out)
- **Source:** phase3-axis2 sub-area 4 finding 2
- **Fix:** 5+ cron handlers iterate orgs one-by-one; chunk into batches of 10 per Inngest event.
- **Effort:** M

### P2-5 · Sentry sourcemap upload not wired in deploy
- **Source:** phase1-synthesis "Observability gaps"; doctrine lifted → now in scope
- **Fix:** Add `@sentry/cli` upload step in `deploy:full` script using SENTRY_AUTH_TOKEN (provisioned). Verify minified traces become symbolicated post-deploy.
- **Effort:** S

### P2-6 · Better Stack documented but not wired
- **Source:** task brief seed list
- **Fix:** Audit docs reference; either wire actual Better Stack pipeline (logs/uptime) or delete the doc. Decide before users see /docs.
- **Effort:** S (decision) or M (wire)

### P2-7 · DOQueueHandler & tag-cache error observability
- **Source:** phase3-axis2 sub-areas 4+5 (finding 3 each)
- **Fix:** Wrap tag-cache adapter and DO request paths with try/catch → Sentry. Export queue latency to Sentry custom metric.
- **Effort:** M

### P2-8 · No index on `error_log(org_id)`
- **Source:** phase3-axis2 §1 gap 4
- **Fix:** Migration 0121 `CREATE INDEX idx_error_log_org_ts ON error_log(org_id, created_at DESC);`
- **Effort:** S

### P2-9 · API credential count per provider unbounded
- **Source:** phase3-axis2 §3 finding 1
- **Fix:** UI + server validation: max 10 credentials per (org, provider). Audit existing rows; flag overruns.
- **Effort:** M

---

## 5. LOW (P3) — Backlog

| ID | Title | Source | Effort |
|---|---|---|---|
| P3-1 | 12 dead/unscheduled cron handlers | phase1-synthesis cron gap | M |
| P3-2 | Legacy Supabase tables (`memory_kv`, `supabase_migrations_applied`) in schema | phase1-synthesis DevEx gaps | S |
| P3-3 | Webhook URL count unbounded per org | phase3-axis2 §3 finding 2 | S |
| P3-4 | Org member count unbounded | phase3-axis2 §3 finding 3 | S |
| P3-5 | DO request latency unobservable | phase3-axis2 §4 finding 3 | M |
| P3-6 | `enriched-jwt.ts` purpose unclear (possibly dead) | phase1-synthesis docs gap | S |

---

## 6. Cross-cutting Themes

1. **Multi-tenant isolation is query-time, not schema-time.** D1 lacks RLS; campaigns (no org_id), signals_events (nullable org_id), BYOK ciphertexts (no AAD) all rely on app-code discipline. One missing `WHERE` clause = cross-tenant leak. **P0-1, P0-2, P0-3, P0-6, P1-6 are all the same root cause.**
2. **B2 cross-tenant fix already exists locally but un-shipped 1+ day.** Indicates the deploy bottleneck is human gating, not technical. P0-5 = release process gap, not code gap.
3. **Doctrine drift in axes 4/6 (inferred).** Phase 1 synthesis and prior memory note that `sophia-no-tech-doctrine.md` caps L7/L10 at 8/7 by design. With doctrine SUSPENDED for this audit, those gaps (no symbolicated sourcemaps, no automated d1-backup cron) become P1 deliverables — see P1-3 + P2-5. Score honestly.
4. **OpenNext version is a 3-way mismatch:** prod 1.17.3, package.json `^1.19.5`, migration 0108 schema locked to 1.19.5. Any deploy currently risks silent revalidation breakage. **P1-2 + P1-8 same root cause.**
5. **Observability is theatrical at every layer:** test coverage gate 0%, Sentry not symbolicated, DO latency unmeasurable, tag-cache errors swallowed, Better Stack only documented. Cluster: P1-3 (backup not run), P2-5 (sourcemaps), P2-6 (Better Stack), P2-7 (DO + tag-cache), P3-5 (DO latency).
6. **Per-org quotas are partial.** Video quota exists; mission, credential count, member count, webhook count, D1 storage all unbounded. P2-3, P2-9, P3-3, P3-4 same theme.

---

## 7. Reconciliation Notes (input for Phase 5)

1. **Source-report gap.** Of 6 axis reports cited in Phase-4 brief, only **axis2-scalability** exists. Axes 1, 3, 4, 5, 6 referenced by name with scores (33/60, 39/60, 42/60, 47/60, 43/60) but NO files on disk. Phase 5 must either (a) treat those scores as fabricated and re-run, OR (b) accept Phase 1 synthesis as the substitute. Phase 4 backlog above derives from (b) — flag if Phase 5 prefers (a).
2. **Phase 3 axis 2 says "B2 already shipped in prod d86659bf"?** No — task brief says it. Phase 1 triage (2026-05-21) says B2 is in **unpushed** commit `d68b4d96`. Phase 3 axis 2 §6 finding 4 marks B2 "UNPUSHED — CRITICAL BLOCKER". **Confirm live state before Phase 5:** run `git log origin/main..HEAD` and `curl -s https://sophia.agencyos.network/api/version | jq .shortSha`. If shortSha == `d68b4d96` or descendant, P0-5 is closed.
3. **Migration count drift unresolved.** 117 vs 120 vs 0120 local — Phase 5 must run `wrangler d1 migrations list --remote` and pin canonical count.
4. **Severity downgrades pending verification:**
   - P0-6 (campaigns no org_id) may be P1 if org-switching feature not shipped (verify).
   - P0-7 (console.*) may be P1 if first 10 hits are non-sensitive (verify).
5. **No axis-3 security report → P0-1/P0-2 CVSS scores estimated, not formal.** Phase 5 may want to score via CVSS calculator for the scorecard.
6. **37 HIGH Dependabot alerts cited in brief — only Next.js CVE verified.** Other 36 not enumerated. Phase 5 should `gh api repos/longtho638-jpg/sophia-ai-factory/dependabot/alerts` or accept the count without per-CVE detail.
7. **Better Stack:** brief says "documented but not wired" — verified neither doc nor wire was inspected in Phase 1/3. P2-6 may be no-op if doc already deleted.

---

## 8. Unresolved Questions

1. Is org-switching/reassignment shipped in product? Determines P0-6 vs P1.
2. Does the unpushed `d68b4d96` (B2 fix) get shipped BEFORE Phase 5 runs, or does Phase 5 inherit it as open P0?
3. Phase 5 scoring: use 6 layer / 10 layer / 60 layer rubric? Brief implies 6 axes scored /60 each, but doctrine references a 10-layer scorecard. Reconcile.
4. The brief says doctrine is suspended; should items previously waived by no-tech doctrine (operator-side QStash, Sentry sourcemap, DMARC graduation) be P0 or P1? Currently classed P1 (P1-3, P2-5) — confirm.
5. AAD migration strategy for P0-3: in-place re-encrypt with brief outage, OR versioned (decrypt both, encrypt new)? Determines P0-3 effort S vs M.
6. ESLint warnings 341 vs Phase 1 baseline of 423 — trend correct? Confirm before P2-1 ratchet target.

---

**Status:** DONE
**Next:** Phase 5 maps these 30 items + cross-cutting themes to final 10-layer (or 6-axis) scorecard.
