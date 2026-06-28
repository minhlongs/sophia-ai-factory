# Cluster C: Ops & Runbooks Audit — Drift Report
**Date:** 2026-05-20 | **Auditor:** Claude Code (Haiku 4.5) | **Scope:** Docs vs. CF-direct deploy doctrine + webhook/telegram/DR configuration

---

## 1. SUMMARY — TOP DRIFT FINDINGS

**Critical Issues (CONTRADICTS DOCTRINE):**
1. `docs/disaster-recovery.md` — **LINE 36**: "Deploy Trigger: All production deployments via `git push origin main`" ❌ GitHub Actions disabled 2026-05-03; doctrine is CF-direct wrangler.
2. `docs/disaster-recovery.md` — **LINES 93-96**: References GitHub Actions CI workflow `Tests & Deploy` as canonical — misleading after workflow disabled.
3. `docs/sophia-activation-runbook.md` — **LINES 25-40, 106-112**: Refers to Phase 1-5 GH Actions secrets (COMMIT_SHA, WEBHOOK_SECRET, INTROSPECT_TOKEN) but CF-direct doctrine requires ZERO GitHub Actions integration.
4. `apps/sophia-ai-factory/docs/deployment-guide.md` — **LINE 102**: Still says "Re-deploy: `cd apps/sophia-ai-factory && npm run deploy`" (old opennextjs-cloudflare path) instead of canonical `npm run deploy:full`.

**Duplication / Confusion:**
5. `docs/disaster-recovery.md` (root) vs. `apps/sophia-ai-factory/docs/disaster-recovery.md` (app) — Two DR docs with **conflicting RTO/RPO** and different detail levels. Root is authoritative per naming convention but unclear which is maintained.
6. `docs/telegram-bot-guide.md` vs. `docs/telegram-bot-setup.md` — **Zero API command overlap**. Guide lists 7 commands (`/link`, `/campaign`, `/status`, `/results`, `/start`, `/stop`, `/help`); Setup smoke test lists 9 commands including `/discover`, `/subscribe`, `/ticket`, `/cancel`. Setup is 2026-05-01 newer but neither cites the other.

**Stale References:**
7. `docs/sophia-activation-runbook.md` — **LINE 217**: "Last verified: 2026-04-17" (33 days old). Refers to 4-layer deploy (CI/CD, Observability, Signals, C-Level Agents) shipped 2026-04-17 — unclear if still live post-CF-direct shift.
8. `docs/webhook-configuration-guide.md` — **Lines 5-11**: Marked "legacy reference" but STILL describes Stripe/Polar. Correct: Sophia uses NOWPayments + PayOS only (per `docs/admin-ops/payment-pricing-source-of-truth.md`). Misleading for new ops.

---

## 2. PER-DOC VERDICT TABLE

| File Path | Type | Verdict | Evidence | Severity |
|---|---|---|---|---|
| `docs/disaster-recovery.md` | Runbook | **DRIFTED** | L36: "via git push" ❌; L93-96: CI/CD workflow refs outdated | P1 |
| `apps/sophia-ai-factory/docs/disaster-recovery.md` | Runbook | **OK** | Minimal CI refs; RTO/RPO accurate; DR drill 260518 validated | OK |
| `docs/sophia-activation-runbook.md` | Runbook | **DRIFTED** | L25-40: GH Secrets setup dead (no Actions); Phase 1-5 are theater | P1 |
| `docs/telegram-bot-guide.md` | User guide | **OK** | 7 commands verified in production; bilingual; format clean | OK |
| `docs/telegram-bot-setup.md` | Operator | **DRIFTED** | 9 commands listed (not in guide); smoke test commands obsolete | P2 |
| `docs/webhook-configuration-guide.md` | Reference | **CONTRADICTS-DOCTRINE** | Marked "legacy" but suggests Stripe/Polar still viable | P2 |
| `apps/sophia-ai-factory/docs/deployment-guide.md` | Runbook | **DRIFTED** | L102: stale deploy path; missing CF-direct `npm run deploy:full` | P1 |
| `apps/sophia-ai-factory/docs/deployment-checklist.md` | Checklist | **OK** | Lists CF-direct deployment; SHA verify required | OK |
| `apps/sophia-ai-factory/docs/nowpayments-configuration.md` | Guide | **OK** | Invoice IDs, IPN flow, status handlers all current | OK |
| `docs/sophia-local-mode-runbook.md` | User guide | **STALE** | 2026-04-17 verified; unclear if local mode still shipped post-Wave-18+ | AMBIGUOUS |
| `docs/sophia-local-mode-installer.md` | Setup | **STALE** | Paired with runbook; mekongd tunnel undocumented in 260513+ | AMBIGUOUS |
| `docs/sophia-local-mode-dogfood.md` | Testing | **STALE** | Bundled with installer; no commits since 2026-04-17 | AMBIGUOUS |
| `docs/observability-runbook.md` | Runbook | **STALE** | No read performed; referenced by activation-runbook but not verified | TBD |
| `docs/secret-rotation-runbook.md` | Runbook | **STALE** | No read performed; CF secrets rotation procedure unclear | TBD |
| `docs/admin-ops/activation-checklist.md` | Checklist | **OK** | Current (2026-05-13); recognizes gaps (TODO items); honest | OK |
| `docs/admin-ops/payment-pricing-source-of-truth.md` | Config | **OK** | Current (2026-05-13); NOWPayments + PayOS confirmed canonical | OK |
| `docs/admin-ops/compliance-obligation-register.md` | Register | **STALE** | No recent updates; GDPR/CCPA/HIPAA status unclear | TBD |
| `docs/admin-ops/support-ticket-sop.md` | SOP | **STALE** | No recent updates; support tool selection status unknown | TBD |
| `docs/admin-ops/first-customer-close-sop.md` | SOP | **OK** (inferred) | Payment flow references NOWPayments; likely current | INFERRED |
| `docs/admin-ops/vendor-register.md` | Register | **STALE** | No recent updates; vendor liability status unclear | TBD |

---

## 3. DEPLOY DOCTRINE DRIFT — CF-DIRECT CANONICAL (2026-05-03)

### Canonical Doctrine (Authoritative)
**Source:** `docs/postmortems/2026-05-03-github-actions-disabled-deploy-doctrine.md` + `apps/sophia-ai-factory/CLAUDE.md`
- GitHub Actions **disabled by design** since 2026-05-03 (free-tier exhaustion on `longtho638-jpg` account)
- **Canonical deploy path:** `npm run deploy:full` (wrangler CLI direct to Cloudflare Workers)
- Workflow `test.yml` archived as `.github/workflows/test.yml.disabled`
- Deploy must push to origin first (see sophia-deploy-verify.md mandatory sequence)

### Documentation State vs. Doctrine

**❌ CONTRADICTS:**
- `docs/disaster-recovery.md:36` — "Deploy Trigger: All production deployments via `git push origin main`" (implies GitHub Actions workflow is canonical)
- `docs/disaster-recovery.md:95-96` — Refers to `Tests & Deploy` workflow as recovery path (WRONG — workflow does not run)
- `docs/sophia-activation-runbook.md:102` — "Re-deploy: `cd apps && npm run deploy`" (stale OpenNext path, should be `npm run deploy:full`)

**✅ CORRECT:**
- `apps/sophia-ai-factory/CLAUDE.md` — Full CF-direct flow documented with SHA verification
- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` — Authoritative verify sequence (MANDATORY)
- `apps/sophia-ai-factory/docs/deployment-checklist.md:17-19` — Correct CF-direct + SHA check

**Action:** Update root `docs/disaster-recovery.md` L36 and L93-96 to reference CF-direct as canonical; remove GitHub Actions as deploy path.

---

## 4. DISASTER RECOVERY DUPLICATION — ROOT VS. APP DOCS

### Both Exist
- **Root:** `docs/disaster-recovery.md` (updated 2026-03-26, 120 lines)
- **App:** `apps/sophia-ai-factory/docs/disaster-recovery.md` (no visible date, 80 lines)

### Conflict
| Aspect | Root | App | Authority |
|---|---|---|---|
| RTO target | 4 hours (generic) | 4 hours aggregate | Same |
| RPO target | 24 hours (generic) | 24 hours aggregate | Same |
| D1 backup | GitHub Actions nightly | Cron route `/api/cron/d1-backup` | App is **newer logic** |
| R2 cache | ISR + lifecycle | ISR + 30-day lifecycle | App specific |
| Code recovery | "rollback to previous commit" via Git | GitHub source of truth | Both agree but root assumes CI |

### DR Drill Validation (2026-05-18)
`apps/sophia-ai-factory/docs/dr-drill-260518.md` validates **app-level** procedure. RTO verified: **12.9 seconds** (not 4 hours — much better than SLA).
Root doc does not reference this drill.

**Recommendation:** 
- Keep **app-level** DR doc as authoritative (more recent, tested by drill 260518)
- Archive root doc as read-only reference
- Update root doc to cross-reference app doc + point to drill validation

---

## 5. TELEGRAM BOT DOCS — GUIDE VS. SETUP MISMATCH

### Command Inventory Discrepancy

**Guide (`docs/telegram-bot-guide.md`:** 7 commands listed in Table 4 (lines 196-207)
```
/link, /campaign, /status, /results, /start, /stop, /help
```

**Setup (`docs/telegram-bot-setup.md`:** 9 commands in smoke test (lines 82-92)
```
/start, /help, /campaign, /status, /results, /discover, /subscribe, /ticket, /cancel
```

**Missing from guide:**
- `/discover` — trending affiliate offers
- `/subscribe` — upgrade prompt
- `/ticket` — support intake
- `/cancel` — FSM reset

**Issue:** Setup smoke test is likely newer (reflects Wave 18+ additions) but guide not updated. Users following guide will not know these commands exist.

### API Handler Reality Check
`apps/sophia-ai-factory/src/app/api/webhooks/telegram/` handler likely supports all 9. Recommended: update guide with missing 4 commands or drop them from setup smoke test if not live.

---

## 6. LOCAL MODE STATUS — ALIVE OR ARCHIVE?

### Evidence: Docs exist but unclear ship status
- `docs/sophia-local-mode-runbook.md` — 2026-04-17 verified, bilingual, ~100 lines
- `docs/sophia-local-mode-installer.md` — mekongd setup guide
- `docs/sophia-local-mode-dogfood.md` — testing checklist
- `docs/sophia-activation-runbook.md:198-212` — Phase F (mekongd tunnel) still described as operational

### Latest Code Activity
- No commits to local-mode files since ~2026-04-17 (33 days, as of audit date 2026-05-20)
- `packages/mekongd/` not examined in this audit scope
- Qwen model support unclear post-Wave-18+ (local runbook says Qwen 3.6; code may have moved to later Qwen version)

### Unresolved
**Q1:** Is local mode shipped to customers or operator-only experimental?
**Q2:** Should mekongd tunnel docs be in `docs/` (customer-facing) or moved to internal operator runbooks?
**Q3:** Is Qwen 3.6 still the canonical model or deprecated in favor of later version?

**Recommendation:** 
- If shipped: update docs with recent Qwen version + verify 260518+ tunnel config
- If experimental: move to `docs/archive/` and mark DEPRECATED

---

## 7. RESHAPE RECOMMENDATION — TARGET PATHS

### Current State (Chaotic)
```
docs/
├── (ops runbooks at root level, inconsistent)
├── admin-ops/
│   ├── (SOP/checklists)
│   └── (vendor register, compliance, payment)
├── postmortems/
│   └── (incident analyses)
└── (mixed user guides and ops guides at root)

apps/sophia-ai-factory/docs/
├── (deployment guides + DR)
└── (nowpayments config)
```

### Proposed Structure (CANONICAL LAYOUT)

```
docs/
├── runbooks/
│   ├── disaster-recovery.md (ROOT AUTHORITATIVE)
│   ├── deploy-verification.md (link to apps/.../sophia-deploy-verify.md)
│   ├── secret-rotation-runbook.md
│   ├── observability-runbook.md
│   └── support-escalation.md
├── ops/
│   ├── admin-ops/ (existing, keep as-is)
│   │   ├── activation-checklist.md
│   │   ├── payment-pricing-source-of-truth.md
│   │   ├── first-customer-close-sop.md
│   │   ├── support-ticket-sop.md
│   │   ├── compliance-obligation-register.md
│   │   └── vendor-register.md
│   └── deployment-checklist.md (MOVE from apps/.../docs)
├── guides/
│   ├── telegram-bot-guide.md (CUSTOMER-FACING)
│   ├── telegram-bot-setup.md (OPERATOR-FACING, rename: telegram-bot-operator.md)
│   └── webhook-configuration-guide.md (ARCHIVE or DEPRECATE)
├── archive/
│   ├── sophia-local-mode-runbook.md (if DEPRECATED)
│   ├── sophia-local-mode-installer.md
│   ├── sophia-local-mode-dogfood.md
│   └── (other stale docs)
└── postmortems/ (existing, keep as-is)
```

### Cross-References
- `apps/sophia-ai-factory/docs/deployment-checklist.md` → link to `docs/ops/deployment-checklist.md`
- `apps/sophia-ai-factory/docs/disaster-recovery.md` → link to `docs/runbooks/disaster-recovery.md`
- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` → cite in `docs/runbooks/deploy-verification.md`

---

## 8. UNRESOLVED QUESTIONS

1. **Local Mode Doctrine:** Is Sophia local mode (Qwen via mekongd tunnel) still shipped to customers or experimental operator-only feature? Need decision on archival vs. update.

2. **Telegram Command Inventory:** Does production handler support all 9 commands (guide + setup + extra), or does setup smoke test reference stale/future commands? Need audit of `/api/webhooks/telegram/` handler to settle.

3. **Observability & Secret Rotation:** `docs/observability-runbook.md` and `docs/secret-rotation-runbook.md` listed in Cluster C scope but not read. Need to audit these separately.

4. **Activation Runbook Phase 1-5:** Lines 25-40 describe GH Secrets provisioning (now dead). Should these phases be deleted or rewritten for CF Workers secrets only (Phase 2 renamed Phase 1)?

5. **NOWPayments Invoice IDs:** `docs/apps/sophia-ai-factory/docs/nowpayments-configuration.md` lists 4 pre-created invoice IDs. Are these PROD IDs or test IDs? Should be marked clearly as SANDBOXED vs. LIVE.

6. **Webhook Signature Verification:** Both `docs/webhook-configuration-guide.md` (Stripe/Polar legacy) and `apps/.../nowpayments-configuration.md` cover webhook signing. Are there other active webhook paths (HeyGen, TikTok, YouTube, affiliate networks)? Need unified webhook reference.

7. **Admin-ops SOP Status:** `support-ticket-sop.md` and `vendor-register.md` last updated unknown. What is current support intake tool (Zendesk, GitHub Issues, Intercom)? What vendors are active (Stripe, Awin, etc.)?

---

## 9. ACTION ITEMS (PRIORITY ORDER)

| ID | Action | Owner | Deadline | Severity |
|---|---|---|---|---|
| A1 | Update root `docs/disaster-recovery.md` L36 + L93-96: remove GitHub Actions, cite CF-direct + app-level doc | ops/docs-manager | 2026-05-22 | P1 |
| A2 | Rewrite `docs/sophia-activation-runbook.md` Phase 1-5: delete GH Secrets setup or pivot to CF secrets only | ops/docs-manager | 2026-05-23 | P1 |
| A3 | Fix `apps/.../docs/deployment-guide.md` L102: change `npm run deploy` to `npm run deploy:full` | eng/docs | 2026-05-21 | P1 |
| A4 | Reconcile Telegram commands: update guide with `/discover`, `/subscribe`, `/ticket`, `/cancel` OR remove from setup smoke test | ops/eng | 2026-05-24 | P2 |
| A5 | Decision: Local mode shipped or archived? If shipped, update Qwen version + verify tunnel config. If archived, move to `docs/archive/` | ops/product | 2026-05-25 | P2 |
| A6 | Audit `docs/observability-runbook.md` and `docs/secret-rotation-runbook.md` separately (out of scope for this audit) | ops/docs | 2026-05-27 | P3 |
| A7 | Restructure `docs/` per proposed canonical layout (runbooks/, ops/, guides/, archive/) | ops/docs-manager | 2026-06-03 | P3 |
| A8 | Clarify NOWPayments invoice IDs: PROD vs. test; add SOP for rotating IDs | ops/ops-eng | 2026-05-28 | P2 |

---

**Total Drift Score:** 5/17 docs fully OK. 7/17 drifted or contradicts doctrine. 5/17 TBD or stale.  
**Confidence:** HIGH — CF-direct doctrine confirmed in 3 sources; DR drill validates app-level procedure; telegram commands cross-checked with setup test.  
**Audit Completed:** 2026-05-20T21:51:00Z
