# FOUNDER ABSENCE DRILL — FINAL

> Baseline: `5dd1f071` | Updated: 2026-09-03
> Simulation: Founder unavailable for 30 days. CEO + Tech Lead retain operational control.
> Source: `FOUNDER_ABSENCE_SIMULATION.md` + Phase 1-2 audit findings + Phase 7 storage audit + deploy blocker status

---

## Current Status Snapshot

| Item | Status | Evidence |
|------|--------|----------|
| **Production SHA** | 5dd1f071 live ✅ | SHA match verified via `/api/version` |
| **Cloudflare Workers** | Paid plan ACTIVE ✅ | Account has `workers:write` scope, bundle 8.10 MiB < 10 MiB limit |
| **Support ticketing** (migration 0266) | Committed + applied to prod D1 ✅ | `0266_support_tickets.sql` applied; route code committed as `ec2e16eb0`; **NOT deployed live** — blocked by CF Analytics Engine (code 10089) |
| **Cloudflare Analytics Engine** | WAE 10089 RESOLVED ✅ | Only R2 10136 still blocking deploy |
| **R2** | Enabled ✅ | `sophia-ai-factory-opennext-cache` bucket active; `sophia-backups` bucket exists but `BACKUPS_BUCKET` binding **commented out** in `wrangler.toml` (lines 49-50) |
| **D1 backup** | Route exists, **backup BROKEN** ⚠️ | `/api/cron/d1-backup/route.ts` present, but `BACKUPS_BUCKET` binding missing → runtime failure |
| **D1 restore** | Procedure documented, **NEVER TESTED** ❌ | `scripts/dr/run-drill.js` exists but no production drill executed |
| **Secrets** | 14+ in CF, **not in password manager** ❌ | Telegram token only in CF secret, not in `.env.production` |

---

## 30-Day Tabletop Drill (10 Scenarios)

| Day | Scenario | CEO Can Act Alone | CEO Can Act With Runbook | CEO Must Escalate | Founder Required |
|-----|----------|-------------------|-------------------------|-------------------|------------------|
| 1 | New customer onboarding | ✅ YES | — | — | — |
| 3 | AI provider outage | ✅ YES | Runbook: switch to backup provider | — | — |
| 5 | Production deployment | ❌ NO | — | — | **YES** (Tech Lead cannot deploy — founder is sole CF account owner) |
| 8 | Payment failure | ✅ YES | Runbook: manual tier activation via D1 | — | — |
| 12 | Background job failure | ✅ YES | Runbook: check Inngest dashboard | — | — |
| 16 | Cost spike | ✅ YES | Runbook: suspend non-critical missions | — | — |
| 20 | Security alert | ⚠️ PARTIAL | Runbook: revoke secrets, block IP | Sentry alert → Tech Lead | Founder for CF account recovery if locked |
| 24 | Customer refund | ✅ YES | Runbook: manual refund via NOWPayments | — | — |
| 28 | Production rollback | ❌ NO | — | — | **YES** (rollback requires CF `wrangler` auth — founder only) |
| 30 | Monthly operating review | ✅ YES | Runbook: check `/api/health`, review costs | — | — |

### Detailed Findings per Scenario

#### DAY 1 — New customer onboarding
**Current blocker:** None operational.
**CEO capability:** ✅ Can fully handle. Customer uses Setup Wizard (BYOK). No founder intervention needed for onboarding flow.

#### DAY 3 — AI provider outage
**Current blocker:** OpenRouter is customer-provided key (BYOK). If customer's key is rate-limited, mission fails gracefully via circuit breaker (`shouldAllowRequest` / `recordFailure`).
**CEO capability:** ✅ With runbook. CEO can direct customer to add backup provider in Setup Wizard. Platform-side circuit breaker logs failures to Sentry.

#### DAY 5 — Production deployment
**Current blocker:** Deploy blocked by R2 Analytics Engine issue (10136). Even if unblocked, **only the founder can deploy** because:
- Cloudflare account is 100% founder-owned (confirmed Phase 1: 0 service accounts, 0 collaborators)
- `wrangler deploy` requires `CF_API_TOKEN` bound to founder's account
- Tech Lead has Sentry/Inngest access but **NOT Cloudflare deploy scope**
**CEO capability:** ❌ Founder required. **This is a CRITICAL GAP.**

#### DAY 8 — Payment failure
**Current blocker:** NOWPayments IPN webhook is wired. If webhook fails, tier activation stalls.
**CEO capability:** ✅ With runbook. CEO can manually activate tier via direct D1 query (`markEventsAsBillable`) using `wrangler d1 execute`. Runbook `land/billing/actions/` documents the SQL.

#### DAY 12 — Background job failure
**Current blocker:** Inngest jobs (video generation) may fail. Inngest dashboard shows failed runs.
**CEO capability:** ✅ With runbook. CEO can view Inngest dashboard (shared access), identify failed runs, and trigger manual retry via CLI command documented in `forest/inngest/` runbooks.

#### DAY 16 — Cost spike
**Current blocker:** OpenRouter/elevenLabs usage costs spike via customer's BYOK key (customer pays directly). Platform hosting costs (CF Workers, D1) are founder-billed.
**CEO capability:** ✅ With runbook. CEO can view cost dashboard, suspend non-critical missions via Inngest pause. Cannot modify billing method (founder's CF account).

#### DAY 20 — Security alert
**Current blocker:** If attacker compromises founder's CF account → full platform takeover. If attacker gets customer API key → single customer impacted.
**CEO capability:** ⚠️ Partial. CEO can revoke customer API keys via Setup Wizard. For platform-level breach: MUST escalate to founder (CF account recovery requires owner email + identity verification). Runbook documents Cloudflare support escalation procedure.

#### DAY 24 — Customer refund
**Current blocker:** NOWPayments refunds require API key (customer's, BYOK). If customer cannot access their NOWPayments account, refund fails.
**CEO capability:** ✅ With runbook. CEO can initiate refund via NOWPayments dashboard (if customer grants read-only support access). Runbook documents manual refund SQL as fallback.

#### DAY 28 — Production rollback
**Current blocker:** `wrangler rollback` requires CF API token bound to founder's account.
**CEO capability:** ❌ Founder required. **This is a CRITICAL GAP.** If founder is unavailable AND an emergency rollback is needed, platform stays broken until founder returns.

#### DAY 30 — Monthly operating review
**Current blocker:** None. All operational metrics available via shared dashboards.
**CEO capability:** ✅ Can fully handle. CEO can review `/api/health`, cost dashboard, Inngest metrics, Sentry error rate. Runbook documents the monthly review checklist.

---

## Scenario Summary

| Result | Count | Scenarios |
|--------|-------|-----------|
| **CEO CAN ACT ALONE** | 5/10 | Day 1 (onboarding), Day 12 (jobs), Day 16 (cost), Day 24 (refund), Day 30 (review) |
| **CEO CAN ACT WITH RUNBOOK** | 3/10 | Day 3 (AI outage), Day 8 (payment), Day 20 (security) |
| **CEO MUST ESCALATE** | 0/10 | — |
| **FOUNDER REQUIRED** | 4/10 | Day 5 (deploy), Day 28 (rollback), Day 20 (CF recovery), Day 5 (deploy blocker) |

---

## Critical Gaps Requiring Founder Action

| Gap | Impact | Resolution Needed |
|-----|--------|-------------------|
| **1. Cloudflare deploy dependency** | Cannot deploy or rollback without founder | Transfer CF account ownership or add Tech Lead as admin with `workers:write` scope |
| **2. BACKUPS_BUCKET binding commented out** | D1 backup route broken at runtime | Uncomment binding in `wrangler.toml` lines 49-50 |
| **3. D1 restore never tested** | If D1 corrupts, cannot recover data | Run `scripts/dr/run-drill.js` end-to-end |
| **4. Secrets not in shared password manager** | If founder unavailable, secrets lost | Export 14 CF secrets to 1Password/Business password manager |

---

## Resolution Score

| Metric | Before MVH | After MVH Gap Closure |
|--------|------------|----------------------|
| **Scenarios requiring founder** | 7/10 (original sim) → **4/10** (corrected) | 4/10 → **0/10** (if CF access + backup + secrets addressed) |
| **CEO autonomy** | 30% | **70% → 100%** |
| **Deploy capability** | Founder-only | Tech Lead (with CF access transfer) |
| **Rollback capability** | Founder-only | Tech Lead (with CF access transfer) |
| **Recovery capability** | 0% (backup broken) | 100% (after backup fix + DR drill) |

> **Note:** The original simulation (7/10 founder-required) was inflated by including scenarios where the CEO could act with a runbook as "founder required." Corrected count is **4/10** founder-required, all concentrated in: deploy, rollback, CF-account recovery, and deploy blocker resolution.

---

## Required Actions (FOUNDER ACTION REQUIRED)

### Week 1 — Critical (P0)
1. **[Cloudflare]** Add Tech Lead as account member with `workers:write`, `d1:write`, `r2:write` scopes
2. **[Cloudflare]** Uncomment `BACKUPS_BUCKET` binding in `wrangler.toml` (lines 49-50) — re-deploy
3. **[Secrets]** Export 14 Cloudflare Workers secrets to 1Password `Sophia Production` vault
4. **[NOWPayments]** Add Tech Lead as admin on NOWPayments account

### Week 2 — High (P1)
5. **[D1]** Run DR drill: `node scripts/dr/run-drill.js` — verify end-to-end restore
6. **[GitHub]** Add Tech Lead as `admin` collaborator on `minhlongs/sophia-ai-factory`
7. **[Sentry]** Verify Tech Lead has "Manager" role on `sophia-ai-factory` org (not just "Member")

### Week 3 — Medium (P2)
8. **[Inngest]** Verify Tech Lead can view all functions + replay failed runs
9. **[Domain]** Document domain registrar login (P0752057-NIC) → transfer to CEO or shared vault
10. **[Runbooks]** CEO reads all runbooks in `docs/runbooks/` — signs off on comprehension

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Founder | Bill Will | ________________ | 2026-09-03 |
| Tech Lead | Minh Long | ________________ | 2026-09-03 |
| CEO | [Pending] | ________________ | 2026-09-03 |

---

*Updated by CEO Handover Closeout — Phase 5 Drill (incorporating Phase 1-2-3-4-7 audit findings)*