# SOC 2 Gap Analysis Template

**Tenant**: Sophia AI Factory
**Date**: {{ASSESSMENT_DATE}}
**Assessor**: {{ASSESSOR_NAME}} (internal or external consultant)
**TSC scope**: {{TSC_SCOPE}}

---

## 1. Current State Assessment

### Common Criteria (Security)

| Control | Current State | Gap | Priority |
|---------|---------------|-----|----------|
| CC1.1 Code of Conduct | {{STATUS}} | {{GAP}} | H/M/L |
| CC1.2 Background checks | {{STATUS}} | {{GAP}} | H/M/L |
| CC1.3 Security training | {{STATUS}} | {{GAP}} | H/M/L |
| CC2.1 Internal comms | {{STATUS}} | {{GAP}} | H/M/L |
| CC2.2 External comms | {{STATUS}} | {{GAP}} | H/M/L |
| CC3.1 Risk assessment | {{STATUS}} | {{GAP}} | H/M/L |
| CC3.2 Risk register | {{STATUS}} | {{GAP}} | H/M/L |
| CC4.1 Monitoring | {{STATUS}} | {{GAP}} | H/M/L |
| CC4.2 Evaluations | {{STATUS}} | {{GAP}} | H/M/L |
| CC5.1 Control activities | {{STATUS}} | {{GAP}} | H/M/L |
| CC5.2 Technology controls | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.1 Logical access | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.2 New user access | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.3 Access modifications | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.4 Physical access | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.5 Data access removal | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.6 Encryption | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.7 Malicious software | {{STATUS}} | {{GAP}} | H/M/L |
| CC6.8 Vulnerability management | {{STATUS}} | {{GAP}} | H/M/L |
| CC7.1 Detection | {{STATUS}} | {{GAP}} | H/M/L |
| CC7.2 Monitoring | {{STATUS}} | {{GAP}} | H/M/L |
| CC7.3 Incident response | {{STATUS}} | {{GAP}} | H/M/L |
| CC7.4 Recovery | {{STATUS}} | {{GAP}} | H/M/L |
| CC8.1 Change management | {{STATUS}} | {{GAP}} | H/M/L |
| CC9.1 Risk mitigation | {{STATUS}} | {{GAP}} | H/M/L |
| CC9.2 Vendor management | {{STATUS}} | {{GAP}} | H/M/L |

### Availability (if in scope)

| Control | Current State | Gap | Priority |
|---------|---------------|-----|----------|
| A1.1 Capacity planning | {{STATUS}} | {{GAP}} | H/M/L |
| A1.2 Environmental protections | {{STATUS}} | {{GAP}} | H/M/L |
| A1.3 Backup + recovery | {{STATUS}} | {{GAP}} | H/M/L |

### Confidentiality (if in scope)

| Control | Current State | Gap | Priority |
|---------|---------------|-----|----------|
| C1.1 Confidential data identification | {{STATUS}} | {{GAP}} | H/M/L |
| C1.2 Confidential data disposal | {{STATUS}} | {{GAP}} | H/M/L |

---

## 2. Gap Summary

| Priority | Count | Examples |
|----------|-------|----------|
| High | {{HIGH_COUNT}} | {{HIGH_EXAMPLES}} |
| Medium | {{MEDIUM_COUNT}} | {{MEDIUM_EXAMPLES}} |
| Low | {{LOW_COUNT}} | {{LOW_EXAMPLES}} |

---

## 3. Remediation Plan

### High Priority (Must fix before audit)

| # | Gap | Action | Owner | Due Date |
|---|-----|--------|-------|----------|
| 1 | {{GAP_1}} | {{ACTION_1}} | {{OWNER_1}} | {{DUE_1}} |
| 2 | {{GAP_2}} | {{ACTION_2}} | {{OWNER_2}} | {{DUE_2}} |

### Medium Priority (Should fix)

| # | Gap | Action | Owner | Due Date |
|---|-----|--------|-------|----------|
| 1 | {{GAP_M1}} | {{ACTION_M1}} | {{OWNER_M1}} | {{DUE_M1}} |

### Low Priority (Nice to have)

| # | Gap | Action | Owner | Due Date |
|---|-----|--------|-------|----------|
| 1 | {{GAP_L1}} | {{ACTION_L1}} | {{OWNER_L1}} | {{DUE_L1}} |

---

## 4. Risk Acceptance

For any gaps not remediated before audit, document:

| Gap | Why Accepted | Compensating Control | Sign-off |
|-----|-------------|----------------------|----------|
| {{GAP}} | {{WHY}} | {{COMPENSATING}} | {{SIGNER}} |

---

## 5. Evidence Status

For each control, identify evidence sources:

| Control | Evidence Type | Automated? | Owner |
|---------|---------------|------------|-------|
| CC6.1 Logical access | IdP logs | Yes | {{OWNER}} |
| CC8.1 Change management | Git history | Yes | {{OWNER}} |
| CC7.3 Incident response | Incident tickets | Partial | {{OWNER}} |
| ... | | | |

---

## 6. Auditor Recommendation

Based on gap analysis:

- **Audit feasibility**: ☐ Ready ☐ Ready with remediation ☐ Not ready
- **Estimated remediation time**: {{WEEKS}} weeks
- **Recommended TSCs**: {{TSC_LIST}}
- **Recommended auditor tier**: {{TIER}}
- **Estimated cost**: ${{COST}}

---

## 7. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CEO | Long Tho | | |
| CTO | | | |
| Assessor | {{ASSESSOR_NAME}} | | |

---

**Last updated**: {{LAST_UPDATED}}
