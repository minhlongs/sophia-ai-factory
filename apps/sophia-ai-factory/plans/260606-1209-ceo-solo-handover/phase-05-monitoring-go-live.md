---
title: "Phase 5: Monitoring + Go-Live Checklist"
description: "Monitoring setup and final go-live checklist for Solo Company Media"
status: completed
priority: P1
effort: 2h
branch: master
tags: [monitoring, go-live, checklist]
created: 2026-06-06
---

# Phase 5: Monitoring + Go-Live Checklist

**Priority:** P1 — final gate
**Status:** pending
**Effort:** 2h
**Depends on:** All prior phases complete

## Context Links
- Deploy verify: `.claude/rules/sophia-deploy-verify.md`
- No-tech doctrine: `.claude/rules/sophia-no-tech-doctrine.md`
- Layer arch: `.claude/rules/sophia-layer-architecture.md`

## Requirements
1. Monitoring active (Sentry + CF Workers logs)
2. Go-live checklist completed
3. Handover sign-off document signed

## Implementation Steps

### Step 1: Monitoring Verification (30 min)
Checklist:
- [ ] Sentry SDK capturing errors (check Sentry dashboard)
- [ ] CF Workers logs accessible: `wrangler tail --format pretty`
- [ ] D1 + R2 bindings healthy
- [ ] Inngest dashboard shows jobs processing
- [ ] No unhandled promise rejections in worker logs

**Acceptance:** All 5 checks pass

### Step 2: Go-Live Checklist (45 min)
**File:** `docs/go-live-checklist.md`

Verify each item:
| Item | Check | Command/URL |
|------|-------|-------------|
| Deploy | SHA match | `curl -s $PROD_URL/api/version \| jq .shortSha` |
| Tests | All pass | `npm test` |
| Build | 0 errors | `npm run build` |
| Auth | Login works | Manual test signup/login |
| Setup Wizard | API key flow | Manual test |
| Payment | NOWPayments IPN | Sandbox test |
| Telegram Bot | All commands | `/campaign`, `/status`, `/results` |
| Admin Panel | Loads + data | `/admin` |
| i18n | vi + en switch | Toggle language |
| SSL | HTTPS enforced | `curl -I https://sophia.agencyos.network` |

### Step 3: Handover Sign-Off (30 min)
**File:** `docs/handover-signoff.md`

Create sign-off document:
- Platform: Sophia AI Factory
- Operator: Solo Company Media
- Contact: Long Tho
- Handover date: 2026-06-06
- Phases completed: 1-5 all green
- Known limitations: Sentry sourcemaps optional, DMARC p=none
- Next review: 2026-07-06 (30 days)

Signatures:
- [ ] CEO (Long Tho) — transferor
- [ ] Solo Company Media — transferee

### Step 4: DMARC Graduation Check (15 min)
Per no-tech doctrine: DMARC `p=none` → `p=quarantine` possible if rua reports clean by 2026-06-12.

Check current DMARC policy:
```bash
dig TXT _dmarc.sophia.agencyos.network
```

**Acceptance:** DMARC status documented, graduation date set

## Success Criteria
- [ ] All monitoring active
- [ ] Go-live checklist 10/10 green
- [ ] Handover sign-off document complete
- [ ] DMARC status known

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sentry not capturing | Low | Medium | Verify SDK init in client+server config |
| Checklist item missed | Low | Low | Run checklist twice, 30 min apart |
| DMARC graduation premature | Medium | Low | Wait for 2026-06-12 data |

## Rollback
No rollback needed — this phase is verification only. Re-run checklist if any item fails.
