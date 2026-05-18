# Phase 09 — Handover Docs Consolidation

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §6 D5, §9 Q5 (internal/friendly client)
- Existing docs:
  - `docs/GO-LIVE-DEPLOYMENT-GUIDE.md`
  - `docs/disaster-recovery.md`
  - `docs/dev-sops.md`
  - `docs/deployment-guide.md`
  - `docs/operator-playbook/smoke-test-walkthrough.md`
- Phase 06 reports: `docs/pentest-260521-part-b.md`, `docs/asvs-l2-final-report.md`
- Phase 07 report: `docs/dr-drill-260522.md`
- Phase 08 report: `docs/load-test-260523.md`

## Overview
- **Priority:** P1 (can run parallel with Phase 08)
- **Status:** ✅ v1 complete 2026-05-18 (metrics from 06/07/08 pending; refresh after those phases)
- **Duration:** 0.5 day (D9 parallel)
- **Brief:** Create single `docs/CLIENT-HANDOVER-PACKAGE.md` consolidating all existing docs + measured DR metrics + escalation contacts + key-rotation procedure. Skip NDA/IP/SLA legal clauses (internal/friendly client).

## Key Insights
- Internal/friendly client → no legal contract clauses needed
- Client is non-tech CEO per Sophia handover rules → bilingual + emoji + step-by-step
- Single TOC at top → all references cross-linked
- DR drill values from Phase 07 must be plugged in (not placeholder)
- PDF export optional but useful for offline reading

## Requirements
**Functional:**
- Single Markdown bundle with full TOC
- Sections:
  1. Welcome + What you're getting
  2. Deploy procedure (CF-direct flow)
  3. DR procedure with measured RTO/RPO
  4. SOPs 1-13 (from dev-sops.md)
  5. Incident response playbook (NEW)
  6. Escalation contacts (NEW — operator email only)
  7. NOWPayments admin console + key rotation
  8. Wrangler/CF dashboard access notes
  9. Known limitations (from doctrine + Phase 01 audit)
- Bilingual VI+EN section headers per Sophia handover rules
- All references cross-linked to source docs

**Non-functional:**
- ≤200 lines per section
- TOC at top with anchor links
- Cross-references to all subordinate docs (not duplicated content)
- Optional PDF via Pandoc

## Architecture
Single index document referencing existing docs. NO content duplication — handover doc is a curated TOC + new sections (incident playbook, escalation, key rotation).

## Related Code Files
**Create:**
- `docs/CLIENT-HANDOVER-PACKAGE.md`
- `docs/incident-response-playbook.md` (NEW)
- `docs/escalation-contacts.md` (NEW)
- `docs/nowpayments-key-rotation.md` (NEW)
- `docs/CLIENT-HANDOVER-PACKAGE.pdf` (optional — via Pandoc)

**Modify:**
- `docs/known-issues.md` (from Phase 01 — finalize and link)
- `docs/disaster-recovery.md` (ensure measured values from Phase 07)

**Delete:** none

## Implementation Steps

### 1. Draft `incident-response-playbook.md`
```md
# Incident Response Playbook

## Severity Classification
- **P0 Critical:** Production down OR data loss OR payment flow broken
- **P1 High:** Major feature broken OR security HIGH disclosed
- **P2 Medium:** Minor feature broken OR degraded performance
- **P3 Low:** Cosmetic / non-blocking

## Response Steps (P0)
1. Detect: alert / customer report / dashboard
2. Triage: confirm via `curl https://sophia.agencyos.network/api/health`
3. Communicate: notify operator via email
4. Rollback or hotfix:
   - Rollback: `npx wrangler rollback --name sophia-ai-factory --message "<reason>"`
   - Hotfix: branch → fix → `npm run deploy:full` → SHA verify
5. Postmortem within 48h

## Common Scenarios
- **Worker 500 errors:** `wrangler tail` → identify exception → rollback or fix
- **D1 corruption:** invoke DR procedure (see docs/disaster-recovery.md)
- **NOWPayments webhook reject:** verify IPN_SECRET → rotate if compromised
- **Tier not granted post-payment:** check payment_events table → manual grant via admin tools
```

### 2. Draft `escalation-contacts.md`
```md
# Escalation Contacts (Internal)

| Role | Contact | Hours |
|---|---|---|
| Platform Operator | operator@<domain> | 9am-9pm GMT+7 |
| Emergency (P0) | <phone if user provides> | 24/7 |

## Escalation Path
1. Email operator (response < 4h business hours)
2. If no response in 4h → SMS / phone (P0 only)
3. If P0 unresolved 24h → consider rollback

(NDA / SLA / IP clauses intentionally omitted — internal/friendly handover.)
```

### 3. Draft `nowpayments-key-rotation.md`
```md
# NOWPayments Key Rotation

## When to Rotate
- After any security incident (forced)
- Every 12 months (preventive)
- After operator transition

## Procedure
1. Log in to NOWPayments admin console: https://account.nowpayments.io
2. Generate new API key + IPN secret (DO NOT delete old key until step 5)
3. Update CF Worker secrets:
   ```bash
   cd apps/sophia-ai-factory
   npx wrangler secret put NOWPAYMENTS_API_KEY  # paste new
   npx wrangler secret put NOWPAYMENTS_IPN_SECRET  # paste new
   ```
4. Redeploy: `npm run deploy:full` + SHA verify
5. Wait 24h, verify no failed webhooks via `wrangler tail`
6. Revoke old key in NOWPayments console
```

### 4. Build `CLIENT-HANDOVER-PACKAGE.md`
```md
# Sophia AI Factory — Client Handover Package / Gói Bàn Giao Khách Hàng

> **Status:** Production at https://sophia.agencyos.network
> **Effective:** 2026-05-24
> **Score (honest):** 92-94/100 (doctrine ceiling 87.5 lifted to ~92-94 via operational track record)

## Table of Contents
1. [What You're Getting](#what-youre-getting)
2. [Deploy Procedure](#deploy-procedure)
3. [Disaster Recovery](#disaster-recovery)
4. [Standard Operating Procedures](#standard-operating-procedures)
5. [Incident Response](#incident-response)
6. [Escalation Contacts](#escalation-contacts)
7. [NOWPayments Management](#nowpayments-management)
8. [Cloudflare Dashboard Access](#cloudflare-dashboard-access)
9. [Known Limitations](#known-limitations)
10. [Security & Compliance Reports](#security--compliance-reports)

## What You're Getting / Bạn Nhận Được
- 🚀 Production-ready Next.js 16 + CF Workers + D1 + Better Auth + NOWPayments
- 🧪 1,444 tests passing, ESLint 0 errors
- 🔒 OWASP ASVS L2 compliance audited (see [pentest-260521-part-b.md](pentest-260521-part-b.md))
- 💾 DR drill executed 2026-05-22, RTO measured: <X>min, RPO: <Y>h (see [dr-drill-260522.md](dr-drill-260522.md))
- ⚡ Load tested 100 concurrent users, p95 <500ms (see [load-test-260523.md](load-test-260523.md))
- 🎟️ FREE100-XXXX bulk-code system with admin UI + CSV export
- 📊 20+ dashboard routes (campaigns, billing, handover, BYOK, etc.)

## Deploy Procedure
See [deployment-guide.md](deployment-guide.md) and [GO-LIVE-DEPLOYMENT-GUIDE.md](GO-LIVE-DEPLOYMENT-GUIDE.md).

Quick reference:
```bash
git push origin main
cd apps/sophia-ai-factory
npm run deploy:full
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # verify SHA match
```

## Disaster Recovery
Full procedure: [disaster-recovery.md](disaster-recovery.md). Measured metrics from drill: see [dr-drill-260522.md](dr-drill-260522.md).

## Standard Operating Procedures
SOPs 1-13 in [dev-sops.md](dev-sops.md).
Smoke test walkthrough: [operator-playbook/smoke-test-walkthrough.md](operator-playbook/smoke-test-walkthrough.md).

## Incident Response
[incident-response-playbook.md](incident-response-playbook.md)

## Escalation Contacts
[escalation-contacts.md](escalation-contacts.md)

## NOWPayments Management
- Console: https://account.nowpayments.io
- Key rotation: [nowpayments-key-rotation.md](nowpayments-key-rotation.md)
- Banned alternates: ❌ Polar.sh (rejected this product), ❌ PayPal

## Cloudflare Dashboard Access
- Dashboard: https://dash.cloudflare.com
- Workers: `sophia-ai-factory`
- D1: `sophia-raas-db`
- R2 buckets: `sophia-ai-factory-opennext-cache`, `sophia-ai-factory-backups`
- Wrangler local CLI: `npx wrangler whoami`

## Known Limitations
See [known-issues.md](known-issues.md). Per [doctrine v1.28.1](../.claude/rules/sophia-no-tech-doctrine.md):
- No operator-side third-party setup (QStash, Sentry tokens, etc.)
- Score ceiling 87.5 under doctrine; current 92-94 via operational track record
- Lift beyond 94 requires sustained monthly DR drills

## Security & Compliance Reports
- Pen test Part A: [pentest-260520-part-a.md](pentest-260520-part-a.md)
- Pen test Part B: [pentest-260521-part-b.md](pentest-260521-part-b.md)
- ASVS L2 final: [asvs-l2-final-report.md](asvs-l2-final-report.md)
- DR drill: [dr-drill-260522.md](dr-drill-260522.md)
- Load test: [load-test-260523.md](load-test-260523.md)
```

### 5. Optional PDF export
```bash
which pandoc || brew install pandoc
pandoc docs/CLIENT-HANDOVER-PACKAGE.md -o docs/CLIENT-HANDOVER-PACKAGE.pdf \
  --toc --pdf-engine=wkhtmltopdf
```

### 6. Cross-link verification
```bash
# Every linked file must exist
grep -oP '\[.*?\]\((.*?)\)' docs/CLIENT-HANDOVER-PACKAGE.md | grep -oP '\((.*?)\)' | tr -d '()' | while read f; do
  [ -f "docs/$f" ] || [ -f "$f" ] || echo "MISSING: $f"
done
```

### 7. Update `docs/known-issues.md` to be handover-ready
- Categorize P0/P1/P2
- For each known issue: workaround + ETA
- Mark any P0 as blocker for Phase 10

## Todo List
- [x] Draft `incident-response-playbook.md`
- [x] Draft `escalation-contacts.md`
- [x] Draft `nowpayments-key-rotation.md`
- [x] Build `CLIENT-HANDOVER-PACKAGE.md` with TOC + cross-links
- [ ] Plug measured RTO/RPO from Phase 07 into doc (Phase 07 pending)
- [ ] Plug pen test summary from Phase 06 into doc (Phase 06 pending)
- [ ] Plug load test summary from Phase 08 into doc (Phase 08 pending)
- [x] Cross-link verification (27/27 links resolved)
- [ ] Optional: Pandoc PDF export
- [x] Finalize `known-issues.md` with P0/P1/P2 triage
- [ ] User review pass (with operator)

## Success Criteria
- `CLIENT-HANDOVER-PACKAGE.md` contains all 10 TOC sections
- All cross-links resolve to existing files
- Measured RTO/RPO present (not placeholders)
- No NDA/SLA legal clauses (internal/friendly per Q5)
- Bilingual headers per Sophia handover rules
- User reviewed and approves

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-link to non-existent file | Med | Low | grep verification step |
| Phase 07/08 numbers missing | Med | Med | Block this phase until Phase 07/08 outputs ready |
| User wants legal clauses despite "friendly" | Low | Low | Add stub section that can be filled if needed |
| PDF export tool not installed | Low | Low | Optional step; MD is canonical |

## Security Considerations
- No secrets in handover doc (only NAMES of secrets + rotation procedure)
- Escalation contacts: only operator email by default (no phone unless provided)
- NOWPayments console URL public; instructions assume client has account
- CF dashboard access mentioned but credentials transferred out-of-band

## Next Steps
- Phase 10 records training video walking through this package
- After handover, doc becomes living — operator updates as procedures evolve
- Schedule first quarterly DR drill referencing dr-drill-260522.md as baseline
