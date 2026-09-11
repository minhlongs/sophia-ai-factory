# CLAIMS VS. CODE REALITY: FORENSIC VERIFICATION AUDIT

**Document ID:** AUDIT-PHASE16-CLAIMS-VS-CODE  
**Work Context:** `apps/sophia-ai-factory/src/`  
**Evaluation Target:** Previous Audits, Handover Claims & Production Baseline (SHA `b77c5504`)  
**Audit Date:** 2026-09-11  
**Auditor:** Supreme Forensic Audit Panel (Lanes A, B, C, D, E Lead SREs)  
**Status:** COMPLETE — EMPIRICAL SOURCE CODE CITATIONS  

---

## 1. Executive Summary: The Reality Gap

Prior documentation—specifically `docs/audit/customer-readiness/FINAL-VERDICT.md`, `docs/audit/customer-readiness/GREEN-GRADUATION-CHECKLIST.md`, and `README.md`—proclaimed Sophia AI Factory as **"ENGINEERING: VERIFIED"**, **"SECURITY: VERIFIED"**, **"MISSION: VERIFIED"**, and **"PRODUCTION READY"** with "107/107 tests passing" and "Zero P0 engineering blockers remaining."

A forensic source code audit across all 10 architectural and functional lanes proves that this "GREEN" posture was largely an **architectural illusion**. While low-level primitives (AES-256-GCM encryption, founder email verification, and webhook HMAC signature checks) are cryptographically sound, critical business workflows are compromised by severe logic holes, universal bypasses, tautological tests, and cross-tenant security vulnerabilities.

### Summary Statistics of Audited Claims

| Claim Classification | Count | Percentage | Operational Meaning |
|---|---|---|---|
| **CONFIRMED ACCURATE** | 4 | 26.7% | Implementation matches documentation precisely in production code. |
| **PARTIALLY TRUE** | 4 | 26.7% | Claim holds under narrow conditions but carries critical caveats or edge failures. |
| **FALSE CLAIM / ILLUSION** | 7 | 46.6% | Code directly contradicts the claim or automated tests mask runtime brokenness. |
| **TOTAL MAJOR CLAIMS** | **15** | **100%** | **Overall Reality Score: 40.0% / 100** |

---

## 2. The Top 8 Critical Deceptions

Below are the eight most egregious divergences where published documentation claimed safety or completion, but the underlying TypeScript and SQL code revealed active exploits, financial leakage, or data corruption.

```
+----------------------------------------------------------------------------------------------------+
|                                    TOP 8 CRITICAL DECEPTIONS                                       |
+---+-----------------------------------+------------------------------------+-----------------------+
| # | Deception Name                    | Location                           | Impact / Exploit      |
+---+-----------------------------------+------------------------------------+-----------------------+
| 1 | Free Enterprise Tier Upgrade      | land/billing/actions/...           | $0 Instant Enterprise |
| 2 | Preflight Universal Bypass        | land/creative-mission/actions.ts   | skipPreflight: true   |
| 3 | Unlimited AI (Zero MCU Decrement) | forest/inngest/functions/...       | Free AI Generation    |
| 4 | Double-Billing on Inngest Retry   | forest/inngest/functions/...       | Re-billed AI Provider |
| 5 | Tautological Billing Tests        | land/billing/__tests__/...         | ?? 'premium' Asserts  |
| 6 | Hardcoded "Owner Verified" Badge  | tree/components/setup-wizard/...   | Unverified Spoofing   |
| 7 | Fictitious Modulo MRR Metrics     | app/api/admin/billing/summary/...  | Round-Robin Revenues  |
| 8 | Cross-Tenant Mission IDOR         | app/api/mission/[id]/route.ts      | Delete Tenant Missions|
+---+-----------------------------------+------------------------------------+-----------------------+
```

---

### Deception 1: Free Enterprise Tier Upgrade in Self-Service UI ($0 Exploit)
- **Documented Claim:** Billing is guarded; upgrades require verified checkout through NOWPayments or PayOS; 1 payment = 1 fulfillment (`FINAL-VERDICT.md:57-62`).
- **Code Reality:** The server action `changeTierAction` directly provisions immediate subscription tier upgrades in Cloudflare D1 without redirecting to a payment gateway, without collecting payment, and without awaiting webhook confirmation.
- **Evidence Path:** `src/land/billing/actions/change-tier-action.ts:280-305`:
  ```typescript
  // Upgrade: immediate provisioning with new period start
  const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await d1.batch([
    d1.prepare(
      'UPDATE subscriptions SET plan = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0, updated_at = ? WHERE org_id = ?',
    ).bind(targetTier.toLowerCase(), now, newPeriodEnd, now, orgId),
    d1.prepare(
      `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type) VALUES (?, ?, ?, ?, ?)`,
    ).bind(user.id, orgId, currentTier, targetTier, eventType),
    d1.prepare('UPDATE user_profiles SET settings = ?, updated_at = ? WHERE user_id = ?')
      .bind(JSON.stringify(settings), now, user.id),
  ]);
  ```
- **Exploit Vector:** Any authenticated user on the free tier can invoke `changeTierAction({ targetTier: 'ENTERPRISE', timing: 'immediate' })`. D1 immediately activates a 30-day Enterprise subscription for $0.
- **Classification:** **FALSE CLAIM / ILLUSION** (P0 Financial Vulnerability).

---

### Deception 2: Preflight Bypass via Client-Supplied `skipPreflight: true`
- **Documented Claim:** "7-Gate Preflight Engine: Created ... executing 7 fail-closed checks (Auth, Ownership, Entitlement, Credential, Capability, Storage, Queue) before any AI generation. Fail-Closed Integration: Wired into startMissionExecution" (`FINAL-VERDICT.md:71-75`).
- **Code Reality:** `StartMissionSchema` explicitly exposes a client-controlled `skipPreflight` boolean parameter. Supplying `skipPreflight: true` bypasses `runMissionPreflightCheck` entirely. Furthermore, this preflight check is called in **only 1 file** across the whole repository; other generation routes bypass it completely.
- **Evidence Path:** `src/land/creative-mission/actions.ts:440-461`:
  ```typescript
  const shouldRunPreflight =
    parsed.data.skipPreflight === false ||
    (process.env.NODE_ENV !== 'test' && !parsed.data.skipPreflight);

  if (shouldRunPreflight) {
    const preflight = await runMissionPreflightCheck({ ... });
    if (!preflight.passed) {
      return failure({ code: preflight.failureCode, message: preflight.failureReason });
    }
  }
  ```
- **Exploit Vector:** An attacker sends `POST` with `{ missionId: "...", skipPreflight: true }`. The preflight engine is bypassed, allowing mission execution with 0 MCU balance, invalid BYOK keys, or absent storage buckets.
- **Classification:** **FALSE CLAIM / ILLUSION** (P0 Guard Evasion).

---

### Deception 3: Unlimited AI Mission Execution Without MCU Credit Decrement
- **Documented Claim:** "Entitlement Gate ... Quota check: checks tier === 'MASTER' OR mcuBalance > 0. Fails with INSUFFICIENT_ENTITLEMENT if 0 MCU" (`FINAL-VERDICT.md:71-75`).
- **Code Reality:** While preflight checks that `mcuBalance > 0`, creative mission execution **never decrements MCU credits**. Spend is tracked only as `spent_cents` in USD cents on the `creative_missions` row. Neither `agentMissionExecutor` nor `recordSpend` ever invokes `deductCredits()` from `credits-repo.ts`.
- **Evidence Path:** `src/forest/inngest/functions/agent-mission-executor.ts:168-175`:
  ```typescript
  await updateAgentRun(runId, patch);
  // Record spend so subsequent runs see reduced budget
  try {
    await recordSpend(missionId, result.costCents);
  } catch (spendErr) { ... }
  ```
  And `src/forest/mission/preflight-check.ts:267-268`:
  ```typescript
  const hasQuota = isMaster || (typeof mcuBalance === 'number' && mcuBalance > 0);
  ```
- **Exploit Vector:** A user with exactly 1 MCU can launch thousands of AI missions. Their MCU balance never drops to 0, granting indefinite free execution.
- **Classification:** **FALSE CLAIM / ILLUSION** (P0 Metering Failure).

---

### Deception 4: Double-Billing Risk on Background Retry Without Step Checkpoints
- **Documented Claim:** Background execution runs on Inngest with durable retries and transactional execution safety (`README.md:39`, `FINAL-VERDICT.md:31`).
- **Code Reality:** `agentMissionExecutor` runs as a monolithic function without `step.run()` wrappers around external AI calls. If third-party AI generation succeeds (OpenRouter, ElevenLabs, fal.ai) but any subsequent database write fails (e.g. `updateAgentRun`, `advanceMissionToReview`, D1 timeout), the run fails. `agent-rollback-cron.ts` re-dispatches the job, triggering a **duplicate paid external API invocation**.
- **Evidence Path:** `src/forest/inngest/functions/agent-mission-executor.ts:148-266` and `src/forest/inngest/functions/agent-rollback-cron.ts:168-198`:
  ```typescript
  // executeAgent is called directly in function body (NO step.run checkpoint):
  const execution = await executeAgent(definition, context, providerRegistry);
  if (execution.ok) {
    const result = execution.value;
    await updateAgentRun(runId, patch); // <-- If D1 fails here...
    await advanceMissionToReview(missionId);
  }
  // ...catch block marks agent_runs 'failed'.
  // agent-rollback-cron finds 'failed' runs and re-emits 'agent.mission.started'!
  ```
- **Exploit / Failure Vector:** Flaky SQLite writes cause customer BYOK wallets to be billed 2–3 times for a single video.
- **Classification:** **FALSE CLAIM / ILLUSION** (P0 Economic Duplication).

---

### Deception 5: Tautological Test Assertions (`?? 'premium'`) Producing 100% Pass Rates
- **Documented Claim:** "Automated Test Gates: 15 test suites, 107/107 passing tests with 100% success rate" (`FINAL-VERDICT.md:30`).
- **Code Reality:** Mission-critical billing upgrade tests contain tautological fallback assertions (`lastSubscriptionUpdate.plan ?? 'premium'`). If the database update fails completely and `lastSubscriptionUpdate.plan` is `undefined`, the assertion evaluates `'premium' === 'premium'` and passes green.
- **Evidence Path:** `src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts:163, 191`:
  ```typescript
  // Line 163:
  expect(lastSubscriptionUpdate.plan ?? 'premium').toBe('premium')

  // Line 191:
  expect(lastSubscriptionUpdate.plan ?? 'master').toBe('master')
  ```
- **Failure Vector:** If a developer introduces a syntax error breaking the `UPDATE subscriptions` query, `npm test` still reports 100% passing tests.
- **Classification:** **FALSE CLAIM / ILLUSION** (P0 Test Corruption / False Confidence).

---

### Deception 6: Hardcoded "Owner Verified" Badge on Unverified Accounts
- **Documented Claim:** "Founder Bootstrap Anti-Spoofing: Enforced fail-closed emailVerified check ... Customer UX: VERIFIED ... Setup Wizard" (`FINAL-VERDICT.md:41-45, 76-80`).
- **Code Reality:** Step 1 (`AccountStep`) of the Setup Wizard renders a hardcoded, unconditional "Owner Verified / Đã xác thực chủ sở hữu" badge to any browser session, regardless of email verification or authentication state. Additionally, `readiness-checker.ts` ignores email verification entirely when evaluating readiness.
- **Evidence Path:** `src/tree/components/setup-wizard/steps/account-step.tsx:20-23`:
  ```tsx
  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
    <ShieldCheck className="w-3.5 h-3.5" />
    Owner Verified / Đã xác thực chủ sở hữu
  </div>
  ```
  And `src/tree/readiness/readiness-checker.ts:128-132`:
  ```typescript
  // emailVerified is completely omitted from the readiness formula:
  const readyForMissions = byokEncrypted && mcuBalance > 0 && capabilities.length > 0;
  ```
- **Exploit Vector:** An attacker with an unverified throwaway email is visually presented as a "Verified Owner" and marked ready for missions.
- **Classification:** **FALSE CLAIM / ILLUSION** (P1 UI Deception).

---

### Deception 7: Modulo-Based Fictitious MRR Calculation in Admin Dashboard
- **Documented Claim:** Administrative dashboard provides real-time business visibility and MRR metrics (`README.md:43-49`, `FINAL-VERDICT.md:86-90`).
- **Code Reality:** The admin MRR calculation query iterates over customers and distributes them evenly across `BASIC`, `PREMIUM`, `ENTERPRISE`, and `MASTER` using a modulo loop `tiers[index % tiers.length]`. It fabricates platform MRR without querying actual subscription plans from D1.
- **Evidence Path:** `src/app/api/admin/billing/summary/billing-summary-query.ts:73-90`:
  ```typescript
  export function calculateMRR(data: DunningCustomer[]): MRRResult {
    const breakdown: Record<string, number> = { BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 };
    const tiers = Object.keys(TIER_PRICING);
    let index = 0;
    for (let i = 0; i < data.length; i++) {
      const tier = tiers[index % tiers.length]; // <-- SYNTHETIC MODULO
      breakdown[tier]++;
      index++;
    }
    const totalCents = Object.entries(breakdown).reduce(
      (sum, [tier, count]) => sum + count * TIER_PRICING[tier], 0
    );
    return { totalCents, breakdown };
  }
  ```
- **Impact:** 4 starter customers ($199 each = $796 real MRR) are reported as $199 + $399 + $799 + $4,999 = **$6,396 MRR** (an 803% phantom inflation).
- **Classification:** **FALSE CLAIM / ILLUSION** (P2 Financial Metric Fabrication).

---

### Deception 8: Cross-Tenant IDOR on Mission Deletion and Viewing
- **Documented Claim:** "Multi-Tenant Isolation: Rigorous tenant isolation verified across BYOK keys, creative missions, storage assets, and billing records" (`FINAL-VERDICT.md:43-44`).
- **Code Reality:** In `/api/mission/[id]`, the endpoint accepts `workspaceId` and verifies the caller's membership in that workspace. However, `getMissionWithGoals(id)` and `deleteMission(id)` query `creative_missions WHERE id = ?1` without checking `mission.workspace_id === workspaceId`.
- **Evidence Path:** `src/app/api/mission/[id]/route.ts:47-57, 118-125`:
  ```typescript
  // 1. Verifies caller belongs to workspaceId passed in request:
  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 2. But deletes/gets mission strictly by mission id WITHOUT checking its workspace!
  await deleteMission(id); // Runs: DELETE FROM creative_missions WHERE id = ?1
  ```
  And `src/tree/mission/repository.ts:106`:
  ```typescript
  const row = await db.prepare(`SELECT * FROM creative_missions WHERE id = ?1 LIMIT 1`).bind(id).first<MissionRow>();
  ```
- **Exploit Vector:** User in Workspace A calls `DELETE /api/mission/msn_victim?workspaceId=ws_attacker`. The mission belonging to Workspace B is deleted.
- **Classification:** **FALSE CLAIM / ILLUSION** (P1 Cross-Tenant Data Destruction).

---

## 3. Comprehensive Claims vs. Code Reality Matrix

| # | Major Claim | Claim Source | Documented Status | Forensic Code Reality | Discrepancy Classification | File:Line Citations |
|---|---|---|---|---|---|---|
| **1** | Canonical 4-Layer Architecture (`seed -> tree -> forest -> land`) | `CLAUDE.md:12`, `FINAL-VERDICT.md:31` | **VERIFIED** | **Violated:** `better-auth-server.ts` uses dynamic imports to import `tree` and `land`. `creative-mission/actions.ts` imports `forest`. 28 files exempt in linter. | **FALSE CLAIM / ILLUSION** | `seed/auth/better-auth-server.ts:72,120,252`<br>`land/creative-mission/actions.ts:26`<br>`eslint.config.mjs:42-70` |
| **2** | Dual Tier Authority Consolidation | `CLAUDE.md:12`, `MEMORY.md:15` | **VERIFIED** | **Contradicted:** Two active conflicting functions exist: `getUserTier` (database subscription) vs `resolveUserTier` (calculates MAX of subscription and affiliate conversions). | **FALSE CLAIM / ILLUSION** | `seed/db/get-user-tier.ts:31`<br>`seed/db/resolve-user-tier.ts:48` |
| **3** | CF-Direct Production Deployment & SHA Match | `CLAUDE.md:35`, `FINAL-VERDICT.md:33-40` | **VERIFIED** | **Accurate:** Wrangler deploys `.open-next/worker.js`, `/api/version` returns exact commit SHA `b77c5504`, `/api/health` returns 200. | **CONFIRMED ACCURATE** | `scripts/deploy-with-sha.sh:12`<br>`app/api/version/route.ts:14` |
| **4** | D1 Migration Tracking & Replay Safety | `CLAUDE.md:39`, `FINAL-VERDICT.md:39` | **VERIFIED** | **Broken:** `apply-migrations.sh` never records applied migrations in `d1_migrations`. Re-runs crash on non-idempotent `CREATE TABLE` statements lacking `IF NOT EXISTS`. | **FALSE CLAIM / ILLUSION** | `scripts/apply-migrations.sh:103-125`<br>`migrations/0201-memory-consolidation.sql:9` |
| **5** | Founder Bootstrap Anti-Spoofing Gate | `FINAL-VERDICT.md:41-42` | **VERIFIED** | **Accurate:** Unverified users matching `FOUNDER_EMAIL` are fail-closed rejected. Privilege elevation requires `emailVerified === true` in D1. | **CONFIRMED ACCURATE** | `seed/auth/founder-bootstrap.ts:57-88` |
| **6** | Cross-Tenant BYOK Storage Cryptography | `FINAL-VERDICT.md:43-45` | **VERIFIED** | **Accurate:** AES-256-GCM authenticated encryption with random 96-bit IVs and AAD bound to `userId` prevents cross-tenant ciphertext decryption. | **CONFIRMED ACCURATE** | `tree/byok/byok-crypto.ts:201-228` |
| **7** | Dependents-First Cascade Account Deletion | `FINAL-VERDICT.md:81-85` | **VERIFIED** | **Broken:** `fetchOrgId` queries `SELECT org_id FROM user` (table name mismatch vs `users`). Returns null, setting `bindValue = ''`, leaving tenant subscriptions and API keys orphaned. | **FALSE CLAIM / ILLUSION** | `land/account/cascade-delete.ts:76-86,207-210` |
| **8** | Pricing Truth ($199, $399, $799, $4,999) | `FINAL-VERDICT.md:46-54` | **VERIFIED** | **Partially True:** Prices match across config files, but NOWPayments client hardcodes 4 static invoice IDs, causing dynamic checkouts to fail resolution upon IPN receipt. | **PARTIALLY TRUE** | `seed/config/tiers/unified-limits.ts:14-48`<br>`tree/clients/nowpayments-client.ts:252-288`<br>`land/billing/nowpayments-ipn-finished.ts:77-84` |
| **9** | Webhook Idempotency & Replay Defense | `FINAL-VERDICT.md:56-62` | **VERIFIED** | **Accurate:** Atomic `INSERT INTO payment_events ... ON CONFLICT(event_id) DO NOTHING` with 5-minute stale-lock recovery prevents duplicate fulfillment. | **CONFIRMED ACCURATE** | `land/billing/nowpayments-ipn-lock.ts:51-87` |
| **10** | NOWPayments IPN Verification on Workers | `FINAL-VERDICT.md:56-64` | **VERIFIED** | **Broken:** SDK factory checks `process.env.NOWPAYMENTS_IPN_SECRET` instead of `globalThis.__env`, failing signature validation on Cloudflare Workers edge runtime. | **FALSE CLAIM / ILLUSION** | `tree/clients/nowpayments-client.ts:35-44` |
| **11** | Fail-Closed Setup Wizard Progression | `FINAL-VERDICT.md:77-78` | **VERIFIED** | **Partially True:** Save failures halt advancement, but submitting 0 keys immediately returns `saved = true` without network requests, skipping key setup. | **PARTIALLY TRUE** | `tree/components/setup-wizard/steps/index.tsx:147-182` |
| **12** | Complete Readiness Scorecard | `FINAL-VERDICT.md:78-79` | **VERIFIED** | **Partially True:** Text-only OpenRouter key marks `readyForMissions: true` in UI, but executing video creation fails immediately in backend preflight. | **PARTIALLY TRUE** | `tree/readiness/readiness-checker.ts:128-132`<br>`forest/mission/preflight-check.ts:347-367` |
| **13** | Diagnostic Bundle Secret Redaction | `FINAL-VERDICT.md:89-90` | **VERIFIED** | **Accurate:** High-coverage regex patterns scrub API keys, bearer tokens, database connection URIs, and PII from support exports. | **CONFIRMED ACCURATE** | `tree/diagnostics/safe-bundle-generator.ts:69-96` |
| **14** | Inngest Background Job Concurrency | `README.md:39` | **PRODUCTION READY** | **Flawed:** Global concurrency limit (`concurrency: { limit: 3 }`) in `videoGenerate` starves all tenants when a single tenant renders multiple videos. | **PARTIALLY TRUE** | `forest/inngest/functions/video-generate.ts:85-88` |
| **15** | Automated Test Suite 100% Reliability | `FINAL-VERDICT.md:30` | **100% PASS** | **Compromised:** Test Reality Score is 62/100. Tautological assertions, mocked database failures, and webhook ack-only checks mask critical production flaws. | **FALSE CLAIM / ILLUSION** | `land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts:163` |

---

## 4. Root Cause Analysis: How the "GREEN" Illusion Was Built

The divergence between documented readiness and code reality stems from five distinct engineering and reporting failure modes:

```
                          ANATOMY OF THE "GREEN" ILLUSION
                          
  +-----------------------+     +-----------------------+     +-----------------------+
  |    MOCK INSULATION    |     |  MISSING CALL SITES   |     |  TAUTOLOGICAL ASSERTS |
  | Tests assert mock     | --> | Logic implemented in  | --> | Nullish fallbacks     |
  | behavior rather than  |     | isolation, wired to   |     | make broken queries   |
  | real SQLite execution |     | only 1 of 4 routes    |     | pass unconditionally  |
  +-----------------------+     +-----------------------+     +-----------------------+
                                            |
                                            v
  +-----------------------+     +-----------------------+
  |   COSMETIC BADGES     |     |   MODULO FABRICATION  |
  | Static UI labels      | <-- | Synthetic business    |
  | declare verification  |     | metrics computed via  |
  | with zero check logic |     | round-robin algorithms|
  +-----------------------+     +-----------------------+
```

1. **Mock Insulation & Assertion Degradation:** Tests in `land/billing/` mock database update calls and assert on local mock variables. In `nowpayments-ipn-atomic-upgrade.test.ts`, the developer added `?? 'premium'` to the assertion, transforming a broken test into an unbreakable tautology.
2. **Implementation Without Call-Site Integration:** The 7-gate preflight checker was created and extensively tested in isolation, but only wired to a single server action while `skipPreflight: true` was left open for callers.
3. **Cosmetic Frontend Indicators:** UI components were constructed with hardcoded labels ("Owner Verified") to satisfy design mockups without connecting them to backend state properties.
4. **Architectural Linter Evasion:** The 4-layer dependency rule (`seed -> tree -> forest -> land`) was maintained on the surface by adding dynamic `import()` calls inside foundational files to evade static ESLint AST checks.
5. **Synthetic Metrics:** When real database schema queries were not yet wired for business metrics (MRR), developers introduced modulo round-robin formulas as "simplified" placeholders that were subsequently forgotten and shipped.

---

## 5. Remediation Roadmap for True Customer Readiness

To graduate Sophia AI Factory from an **illusion of readiness** to **genuine production stability**, the following remediation steps must be executed in priority sequence:

### Priority 0: Critical Security & Financial Fixes (Blockers)

1. **Block Self-Service Free Enterprise Upgrades:**
   - In `src/land/billing/actions/change-tier-action.ts`, remove direct D1 updates.
   - Force all tier upgrade requests to return a checkout URL generated via `createNowPaymentsSDK().createCheckout()`.
   - Ensure D1 subscriptions are updated **only** within the cryptographically verified IPN webhook handler.
2. **Remove `skipPreflight` Parameter:**
   - In `src/land/creative-mission/actions.ts:440-461`, delete `skipPreflight` from `startMissionExecutionSchema`.
   - Ensure preflight execution is unconditional in all environments.
3. **Deduct MCU Credits on Mission Completion:**
   - In `src/forest/inngest/functions/agent-mission-executor.ts:172`, calculate MCU equivalent from `result.costCents` and atomically invoke `deductCredits()` in `src/tree/mcu/credits-repo.ts`.
4. **Wrap External AI Invocations in `step.run()`:**
   - In `agent-mission-executor.ts`, wrap `executeAgent()` inside `await step.run('execute-ai-provider', ...)`.
   - Ensure Inngest checkpoints the AI output so retries due to database glitches never re-invoke external APIs.
5. **Fix Cross-Tenant Mission IDOR:**
   - In `src/app/api/mission/[id]/route.ts`, modify `getMissionWithGoals` and `deleteMission` to enforce `WHERE id = ? AND workspace_id = ?`.

### Priority 1: High-Priority Integrity & Reliability Fixes

6. **Fix D1 Migration Tracking Automation:**
   - In `scripts/apply-migrations.sh:120`, add `INSERT INTO d1_migrations (name, applied_at) VALUES ('$MIGRATION_NAME', datetime('now'))` after successful execution.
   - Add `IF NOT EXISTS` to all historical migrations.
7. **Fix Cascade Account Deletion Table Resolution:**
   - In `src/land/account/cascade-delete.ts:76-86`, query the correct Better Auth table name and prevent execution when `bindValue === ''`.
8. **Fix Cloudflare Workers IPN Secret Resolution:**
   - In `src/tree/clients/nowpayments-client.ts:39`, update `ipnSecret` resolution to read `globalThis.__env?.NOWPAYMENTS_IPN_SECRET ?? process.env.NOWPAYMENTS_IPN_SECRET`.
9. **Eliminate Tautological Assertions:**
   - In `nowpayments-ipn-atomic-upgrade.test.ts`, remove all `??` fallbacks and assert raw properties.
10. **Replace Fictitious MRR Calculation:**
    - In `billing-summary-query.ts:73-90`, replace modulo distribution with an exact SQL query aggregating `subscriptions.plan`.

---

## 6. Conclusion & Final Audit Sign-Off

The forensic audit confirms that Sophia AI Factory possesses strong cryptographic building blocks and a robust Cloudflare Workers deployment pipeline. However, the claim that the platform is **"100% PRODUCTION READY"** or **"VERIFIED SAFE"** is **REFUTED BY CODE REALITY**. 

The system cannot safely accept commercial paying customers until the P0 vulnerabilities (particularly the $0 Enterprise upgrade exploit and the duplicate billing retry storm) are remediated in code and verified with non-tautological tests.

**Forensic Audit Phase 16 Status:** COMPLETE  
**Primary Deliverable:** `docs/audit/forensic/CLAIMS-VS-CODE.md`  

---
PHASE 16 COMPLETE: docs/audit/forensic/CLAIMS-VS-CODE.md
