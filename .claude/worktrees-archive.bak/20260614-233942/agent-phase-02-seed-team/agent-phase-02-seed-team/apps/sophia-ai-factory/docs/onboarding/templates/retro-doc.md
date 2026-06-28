# Retro Doc Template

**Tenant**: {{TENANT_NAME}}
**Retro type**: ☐ 2-week ☐ 4-week ☐ Mid-pilot (8-week) ☐ End-of-pilot (12-week)
**Date**: {{RETRO_DATE}}
**Facilitated by**: {{AM_NAME}}
**Attendees**: {{ATTENDEES}}

---

## 1. Check-in

**How is everyone feeling? (1-10)**

| Person | Score | Notes |
|--------|-------|-------|
| {{PERSON_1}} | {{SCORE_1}} | {{NOTE_1}} |
| {{PERSON_2}} | {{SCORE_2}} | {{NOTE_2}} |

---

## 2. KPI Review

### The 5 dashboard KPIs

| KPI | Current | Target | Status |
|-----|---------|--------|--------|
| Revenue impact | {{REV_CURRENT}} | {{REV_TARGET}} | 🟢/🟡/🔴 |
| Active users | {{USERS_CURRENT}} | {{USERS_TARGET}} | 🟢/🟡/🔴 |
| Uptime | {{UPTIME_CURRENT}} | {{UPTIME_TARGET}} | 🟢/🟡/🔴 |
| Support response | {{SUPPORT_CURRENT}} | {{SUPPORT_TARGET}} | 🟢/🟡/🔴 |
| Client retention | {{RETENTION_CURRENT}} | {{RETENTION_TARGET}} | 🟢/🟡/🔴 |

### The 3 pilot-specific KPIs

| KPI | Current | Target | Status |
|-----|---------|--------|--------|
| {{PILOT_KPI_1}} | {{CURRENT_1}} | {{TARGET_1}} | 🟢/🟡/🔴 |
| {{PILOT_KPI_2}} | {{CURRENT_2}} | {{TARGET_2}} | 🟢/🟡/🔴 |
| {{PILOT_KPI_3}} | {{CURRENT_3}} | {{TARGET_3}} | 🟢/🟡/🔴 |

---

## 3. What Went Well

List specific wins, big or small:

1. {{WIN_1}}
2. {{WIN_2}}
3. {{WIN_3}}
4. {{WIN_4}}
5. {{WIN_5}}

---

## 4. What Didn't Go Well

List specific issues or frustrations:

1. {{ISSUE_1}}
2. {{ISSUE_2}}
3. {{ISSUE_3}}
4. {{ISSUE_4}}
5. {{ISSUE_5}}

---

## 5. What Was Confusing

List anything customer didn't understand or had to ask multiple times:

1. {{CONFUSION_1}}
2. {{CONFUSION_2}}
3. {{CONFUSION_3}}

---

## 6. Feature Requests

List new features or improvements requested:

| # | Request | Priority (H/M/L) | Effort (S/M/L) | Status |
|---|---------|------------------|----------------|--------|
| 1 | {{REQUEST_1}} | {{PRI_1}} | {{EFFORT_1}} | New |
| 2 | {{REQUEST_2}} | {{PRI_2}} | {{EFFORT_2}} | New |

---

## 7. Action Items

| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | {{ACTION_1}} | {{OWNER_1}} | {{DUE_1}} | Open |
| 2 | {{ACTION_2}} | {{OWNER_2}} | {{DUE_2}} | Open |
| 3 | {{ACTION_3}} | {{OWNER_3}} | {{DUE_3}} | Open |

---

## 8. Health Score

| Dimension | Score (1-10) | Notes |
|-----------|--------------|-------|
| Product adoption | {{ADOPTION_SCORE}} | |
| Engagement (Slack, meetings) | {{ENGAGEMENT_SCORE}} | |
| Satisfaction (NPS, sentiment) | {{SATISFACTION_SCORE}} | |
| ROI signal | {{ROI_SCORE}} | |
| Risk of churn | {{RISK_SCORE}} | (10 = no risk, 1 = high risk) |

**Overall health**: 🟢 Healthy / 🟡 At-risk / 🔴 Critical

---

## 9. Expansion Signals

Check any signals of growth potential:

- [ ] Customer asked about more channels
- [ ] Customer asked about higher tier
- [ ] Customer referred someone
- [ ] Customer shared positive feedback publicly
- [ ] Customer wants to extend pilot
- [ ] Customer wants to expand team access

**If any checked**: Notify CEO + sales for expansion conversation.

---

## 10. Churn Signals

Check any signals of churn risk:

- [ ] Customer slow to respond (>48 hours)
- [ ] Customer missed scheduled meetings
- [ ] Negative feedback in Slack
- [ ] Customer not using dashboard
- [ ] KPIs trending down
- [ ] Customer asked to cancel or pause

**If 2+ checked**: Escalate to AM lead + CEO within 24 hours.

---

## 11. Decisions for Next Period

| Decision | Rationale |
|----------|-----------|
| {{DECISION_1}} | {{RATIONALE_1}} |
| {{DECISION_2}} | {{RATIONALE_2}} |

---

## 12. Notes

{{FREE_FORM_NOTES}}

---

**Doc owner**: {{AM_NAME}}
**Last updated**: {{LAST_UPDATED}}
**Stored at**: `tenants/{{TENANT_ID}}/retros/{{RETRO_DATE}}.md`
