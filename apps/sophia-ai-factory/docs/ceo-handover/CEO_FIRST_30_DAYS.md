# CEO FIRST 30 DAYS — SOPHIA AI FACTORY

> Baseline SHA: `5dd1f071` | Generated: 2026-09-02
> A practical onboarding plan for a new CEO. No product work — only operational readiness.

---

## Week 1: Access & Orientation

### Day 1–2: Get Into the Systems

- [ ] GitHub: admin access to `sophia-ai-factory` org
- [ ] Cloudflare: Workers + DNS access (wrangler auth verified)
- [ ] D1 Console: query access to `sophia-raas-db`
- [ ] R2: bucket access (`sophia-ai-factory-opennext-cache`, `sophia-backups`)
- [ ] Inngest: dashboard access (workflow visibility)
- [ ] Sentry: project access (error visibility)
- [ ] Production URL: `https://sophia.agencyos.network` — verify health

### Day 3–4: Run the Health Checks

- [ ] `curl https://sophia.agencyos.network/api/health` → 200
- [ ] `curl https://sophia.agencyos.network/api/version` → `shortSha` matches `git rev-parse HEAD`
- [ ] `curl https://sophia.agencyos.network/login` → 200 (after 307 redirect)
- [ ] `/api/analytics/realtime` (admin) → SSE stream active
- [ ] Telegram bot: `/campaign` → responds

### Day 5: Read the Core Docs

- [ ] `BASELINE.md` — current production state
- [ ] `FOUNDER_DEPENDENCY_AUDIT.md` — what you cannot do without founder
- [ ] `SOPHIA_OPERATING_MAP.md` — system architecture
- [ ] `DECISION_RIGHTS.md` — your authority boundaries
- [ ] `DEPLOYMENT_RUNBOOK.md` — how to deploy/rollback
- [ ] `INCIDENT_RESPONSE.md` — SEV definitions + playbooks
- [ ] `CEO_SCORECARD.md` — metrics you will track

---

## Week 2: Operational Fluency

### Day 6–7: Deploy & Rollback Drill

- [ ] Watch a deploy: `npm run deploy:full` (observe, don't run)
- [ ] Verify SHA match after deploy
- [ ] Execute a rollback: `npx wrangler rollback --name sophia-ai-factory --yes`
- [ ] Verify rollback health

### Day 8–9: Incident Response Drill

- [ ] Pick one playbook from `INCIDENT_RESPONSE.md`
- [ ] Walk through it with Tech Lead (tabletop)
- [ ] Identify gaps in tooling/access

### Day 10: Cost & Finance Review

- [ ] Read `FINANCIAL_OPERATING_MODEL.md`
- [ ] Review last 30 days of AI provider spend (from agent-cost-overrun tables)
- [ ] Understand billing: NOWPayments → tier activation flow
- [ ] Verify refund process works

---

## Week 3: Customer & Product Reality

### Day 11–12: Customer Shadow

- [ ] Observe 2–3 customer onboarding sessions (Setup Wizard)
- [ ] Read last 10 support issues (if any)
- [ ] Review top 5 failure categories from alerts

### Day 13–14: Product Health Deep Dive

- [ ] Query D1: active users, mission completion, failure rates
- [ ] Review `CEO_SCORECARD.md` — mark which metrics you can actually read
- [ ] Identify 3 metrics you want instrumented that are NOT YET INSTRUMENTED

### Day 15: Vendor Review

- [ ] Read `ACCESS_OWNERSHIP_MATRIX.md`
- [ ] Verify each vendor relationship has a business owner
- [ ] Confirm no vendor requires founder's personal credentials

---

## Week 4: Decision & Governance

### Day 16–17: Decision Rights Audit

- [ ] Walk through `DECISION_RIGHTS.md` with Founder + Tech Lead
- [ ] Identify any ambiguous boundaries
- [ ] Agree on escalation paths for gray areas

### Day 18–19: DR Drill

- [ ] Execute D1 restore to a **scratch database**
- [ ] Verify row counts + app health
- [ ] Document result in `docs/operations/`

### Day 20: Roadmap & Priorities

- [ ] Read `docs/development-roadmap.md`
- [ ] Read `docs/project-changelog.md`
- [ ] Identify top 3 product decisions needed in next 30 days

---

## Day 21–30: First Independent Decisions

### By Day 30, the CEO should have:

1. **Executed at least one deploy** (with Tech Lead observing)
2. **Resolved at least one incident** (even tabletop)
3. **Read and understood** all 18 CEO handover documents
4. **Identified the top 3 operational gaps** and proposed a plan
5. **Made at least one pricing/discount/refund decision** within authority
6. **Verified the D1 restore procedure works**

---

## Red Flags (Escalate Immediately)

| Signal | Action |
|---|---|
| Cannot access any system in Week 1 | Call Founder + Tech Lead same day |
| Deploy fails SHA match | Roll back immediately; do not debug forward |
| Protected flow breaks (Setup Wizard, Telegram, Payment) | SEV-1 incident; page Tech Lead |
| D1 backup older than 36h | Trigger manual backup; investigate cron |
| Any `:any` type added to production code | Reject PR; enforce standard |

---

## Success Criteria (Day 30)

- [ ] Can deploy and verify independently
- [ ] Can roll back and verify independently
- [ ] Can read all 5 CEO Scorecard categories from live data
- [ ] Has resolved at least one real or tabletop incident
- [ ] Has documented 3 operational improvements needed
- [ ] Founder has not typed on keyboard for platform operations in 30 days

---

## Handoff From Founder

Founder provides:
- [ ] All system credentials (password manager export)
- [ ] Personal Cloudflare / GitHub / vendor access transfer
- [ ] 30-day shadow availability (Slack / call)
- [ ] Known open issues list (from `HANDOVER_GAPS.md`)

*Generated by CEO HANDOVER AUDIT, Phase 13.*