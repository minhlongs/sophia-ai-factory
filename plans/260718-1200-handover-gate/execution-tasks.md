# Day-by-Day Execution Tasks

## 📅 Day 1 — Technical Gate Audit

### Task 1.1: Build Verification
```bash
cd /path/to/sophia-ai-factory
npm run build 2>&1 | tee /tmp/build-output.txt
```
- Expected: 0 TypeScript errors
- If failure: classify as P0 (blocks deploy) or P1 (minor) → go to V2 backlog

### Task 1.2: Test Suite
```bash
npm test 2>&1 | tee /tmp/test-output.txt
```
- Expected: 844+ tests pass
- If failure: investigate root cause → fix OR mark as V2

### Task 1.3: Deploy Verification
```bash
npm run deploy:verify
```
- Expected: SHA match, HTTP 200 on production

### Task 1.4: Migration Audit
```bash
# Check for duplicate migration files
find apps/sophia-ai-factory/migrations/ -name "*4*" -o -name "*5*" | sort
```
- Expected: clean sequence 0001→N
- If duplicates: document for V2 tech-debt sprint

---

## 📅 Day 2 — Protected Flow Smoke Test

### Task 2.1: Setup Wizard E2E
1. Open `https://sophia.agencyos.network` (or localhost:3000)
2. Click "Get Started" → Sign up with test email
3. Verify email notification received
4. Navigate to Setup Wizard → Add test API key for OpenRouter
5. Verify key is encrypted in D1 (not plaintext)
6. Complete wizard → verify redirected to dashboard

**Expected:** Full flow completes in <5 minutes, no errors

### Task 2.2: Telegram Bot Integration
1. Open Telegram → search @Sophia_Bbot
2. Send `/start` → verify welcome message
3. Send `/status` → verify response
4. Send `/results` → verify response

**Expected:** Bot responds within 5 seconds for each command

### Task 2.3: Payment Flow Simulation
1. Trigger test NOWPayments IPN (sandbox mode if available)
2. Verify tier activation in D1 within 60 seconds
3. Verify redirect to success page
4. Verify email notification sent to customer

**Expected:** Full payment flow completes without manual intervention

---

## 📅 Day 3 — Handover Package Assembly

### Task 3.1: Write HANDOVER_PACKAGE.md
Structure:
```markdown
# Sophia AI Factory — Handover Package

## 1. What's Included
## 2. Prerequisites (wrangler, Node.js, etc.)
## 3. Local Setup (30 min)
## 4. Deploy to Production (15 min)
## 5. Verify Everything Works (smoke test checklist)
## 6. Customer Login Credentials
## 7. Support & Escalation
## 8. V2 Backlog Overview
```

### Task 3.2: Write V2_BACKLOG.md
Structure:
```markdown
# Sophia AI Factory — V2 Backlog

## Tech Debt (P1)
- [ ] Migration consolidation
- [ ] Layer enforcement CI gate
- [ ] Supabase legacy cleanup

## Features (P2)
- [ ] Advanced analytics
- [ ] Plugin marketplace
- [ ] Multi-tenant sub-accounts

## Nice-to-Have (P3)
- [ ] Custom theme builder
- [ ] API marketplace
```

### Task 3.3: Write OPERATOR_RUNBOOK.md
- Daily health checks
- Common issues + fixes
- Escalation paths

---

## 📅 Day 4-5 — Customer Review + Handover

### Task 4.1: Handover Meeting
- Present HANDOVER_PACKAGE.md
- Walkthrough live system
- Answer questions
- Get sign-off

### Task 4.2: Finalize
- Address review feedback
- Create handover commit
- Tag release: `git tag -a v1.0.0 -m "Handover release"`
- Push to remote

---

## Decision Tree: When to Escalate

```
Build fails?
├─ P0 (blocks deploy) → Fix immediately
├─ P1 (warnings) → Document, fix in V2
└─ Skip entire feature → V2 backlog

Test fails?
├─ Core flow test → Fix immediately
├─ Edge case test → Document, V2
└─ Deprecated test → Delete

Protected flow broken?
├─ Any flow → Fix immediately (P0)
└─ Cosmetic issue → V2

Docs incomplete?
├─ Activation runbook → Fix immediately
├─ API docs → Fix immediately
└─ Nice-to-have docs → V2
```
