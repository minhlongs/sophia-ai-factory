# Incident Response Quick Reference

**Version**: 1.0 | **Date**: 2026-06-12
**Audience**: CEO, ops lead, on-call engineer
**Full plan**: `docs/INCIDENT_RESPONSE.md`

---

## When Something's Wrong: 4-Step Flow

```
1. SYMPTOM   →  2. SEVERITY  →  3. ACTION  →  4. UPDATE
```

---

## 1. Recognize Symptoms

| Symptom | Likely cause | Severity |
|---------|--------------|----------|
| sophia.agencyos.network returns 5xx | Service outage | P0 |
| Login fails for everyone | Auth provider down | P0 |
| AI generation fails >50% requests | Model provider down | P1 |
| One user can't login | Account-specific issue | P3 |
| Report slow (>30s) | DB contention | P2 |
| One channel disconnected | Integration issue | P3 |
| Payment failed | Customer billing issue | P3 |

---

## 2. Severity Classification

### P0 — Service Down
- All users affected
- Core functionality unavailable
- Data loss / corruption
- **Response SLA**: 15 min
- **Examples**: Login fails for all, payment processing down

### P1 — Critical Feature Broken
- Many users affected
- Workaround exists but painful
- **Response SLA**: 2 hours
- **Examples**: AI generation fails, one channel fully broken

### P2 — Degraded Service
- Some users affected
- Workaround acceptable short-term
- **Response SLA**: 24 hours
- **Examples**: Reports slow, occasional generation failures

### P3 — Minor / Individual
- One user / one feature
- **Response SLA**: 48 hours
- **Examples**: Account-specific issue, how-to question

---

## 3. Action by Role

### CEO

| Severity | CEO Action |
|----------|------------|
| P0 | Phone AM directly. Skip email. |
| P1 | Slack #sophia-{your-company} — request status update |
| P2 | Email support, copy AM |
| P3 | Submit ticket via dashboard or Slack |

### Ops Lead

| Severity | Ops Lead Action |
|----------|------------------|
| P0 | Take lead. Start war room in Slack. Notify CEO within 15 min. |
| P1 | Investigate. Update Slack hourly. |
| P2 | Create ticket. Work with engineering. |
| P3 | Self-serve via docs. Escalate only if blocked. |

### Account Manager

| Severity | AM Action |
|----------|-----------|
| P0 | Confirm war room active. Bridge customer ↔ engineering. |
| P1 | Daily update to customer. |
| P2 | Update ticket. Weekly summary. |
| P3 | Standard ticket handling. |

---

## 4. Update Cadence

| Severity | Update frequency | Channel |
|----------|------------------|---------|
| P0 | Every 30 min until resolved | Slack + Status page |
| P1 | Every 2 hours during business hours | Slack + Email |
| P2 | Daily | Ticket comment |
| P3 | As resolved | Ticket comment |

---

## Status Page

**Live status**: https://status.sophia.agencyos.network

What you'll find:
- ✅ All systems operational
- ⚠️ Partial degradation (with affected component)
- ❌ Major outage (with ETA if known)

Subscribe for email/SMS alerts at `/status/subscribe`.

---

## War Room Activation (P0)

When CEO or AM declares war room:

1. **Slack channel**: Create `#war-{incident-id}` (private initially, public after 30 min)
2. **Roles assigned**:
   - Incident Commander (IC): senior engineer
   - Communications Lead: AM or designated
   - Subject Matter Expert (SME): per component
3. **Cadence**: Status update every 30 min in main customer channel
4. **Resolution**: All-clear announcement + initial RCA within 48 hours

---

## Communication Templates

### P0 Initial Notification (CEO to customers)

```
Subject: [P0] Service Incident — Investigation In Progress

Hi [Name],

We're investigating an issue affecting [scope: all users / specific feature].
Start time: [UTC timestamp]
Current impact: [description]

Our team is actively investigating. Updates will be posted every 30 minutes
in our shared Slack channel and at status.sophia.agencyos.network.

Account Manager: [Name] — direct line below
Engineering Lead: [Name]

We apologize for the disruption.

[Long Tho, CEO]
```

### P1 Status Update

```
Subject: [P1] Update — [Feature] Issue

Status: Identified root cause, deploying fix.

Root cause: [brief]
Fix ETA: [time]
Workaround: [if available]

Next update: [time]
```

### Resolution + Post-Mortem

```
Subject: [Resolved] [P0/P1] Incident on [date]

Resolved at: [UTC]
Duration: [minutes]
Root cause: [one-paragraph explanation]
Prevention: [what we're doing]

Detailed post-mortem: [link]
Available for questions: AM [Name]

Thank you for your patience.
```

---

## Escalation Tree

```
Customer → AM → Engineering Lead → CTO → CEO
                                      ↑
                              (only if >2hr unresolved P0)
```

**CEO direct to engineering** is anti-pattern — always go through AM.

---

## Post-Mortem (After Every P0/P1)

Within 48 hours, publish:

1. **What happened**: Plain-language timeline
2. **Why it happened**: Root cause (not just symptoms)
3. **Customer impact**: Quantified (users affected, downtime, revenue lost)
4. **What we did to fix**: Technical + process
5. **What we're doing to prevent**: Action items with owners + dates

**Distribution**: Customer Slack + email to all affected customers.

**Internal**: Engineering retro for learning.

---

## On-Call Rotation

- **P0 coverage**: 24/7 (rotation: 1 week per engineer, 4-week cycle)
- **P1 coverage**: Business hours + on-call for after-hours if customer escalation
- **P2/P3**: Business hours only

For customers in different timezones: follow-the-sun coverage planned Phase 4.

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────┐
│  INCIDENT QUICK REF                              │
├──────────────────────────────────────────────────┤
│  Status:  status.sophia.agencyos.network         │
│  Slack:   #sophia-{your-company}                 │
│  Email:   support@sophia.agencyos.network        │
│  P0 call: +1-XXX-XXX-XXXX                        │
│                                                  │
│  P0 SLA: 15 min response                         │
│  P1 SLA: 2 hour response                         │
│  P2 SLA: 24 hour response                        │
│  P3 SLA: 48 hour response                        │
└──────────────────────────────────────────────────┘
```

---

## Sources

- **Full plan**: `docs/INCIDENT_RESPONSE.md`
- **SRE Book**: https://sre.google/sre-book/managing-incidents/
- **Atlassian Incident Handbook**: https://www.atlassian.com/incident-management/handbook

---

**Last reviewed**: 2026-06-12
**Next review**: After first P0 incident
