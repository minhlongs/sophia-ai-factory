# SOC 2 Type II Engagement Letter Template

**To:** [Auditor Firm Name]  
**Attn:** [Auditor Contact Name]  
**Date:** [Current Date]  
**Subject:** Engagement Letter for SOC 2 Type II Audit - Sophia AI Factory

---

## 1. Introduction & Purpose

This engagement letter ("Agreement") between **[Auditor Firm Name]** ("Auditor") and **Sophia AI Factory** ("Client") defines the scope, responsibilities, timeline, and fees for the SOC 2 Type II attestation engagement.

**Client Information:**
- Company: Sophia AI Factory
- Address: [Company Address]
- Primary Contact: [Name], COO
- Email: [Contact Email]
- Phone: [Contact Phone]

**Auditor Information:**
- Firm: [Auditor Firm Name]
- Contact: [Auditor Contact Name]
- Email: [Auditor Email]
- Phone: [Auditor Phone]

---

## 2. Engagement Scope

### 2.1 Services to be Provided

The Auditor shall perform a SOC 2 Type II attestation examination of the Client's controls relevant to the **Security** and **Availability** trust service criteria (with potential expansion to **Confidentiality** and **Processing Integrity** as needed).

**System Under Examination:**
- **Name:** Sophia AI Factory Platform
- **Description:** AI video generation SaaS platform deployed on Cloudflare Workers
- **URL:** https://sophia.agencyos.network
- **Environment:** Production (cloudflare.workers)
- **Services Covered:**
  - License validation and authentication (raas-gate)
  - BYOK credential storage and encryption
  - Audit logging and compliance receipts
  - Payment processing (NOWPayments integration)
  - Video generation orchestration
  - Multi-tenant data isolation (org_id scoping)

**Attestation Standard:**
- AICPA Statement on Standards for Attestation Engagements (SSAE) No. 18
- SOC 2 Trust Services Criteria (2017, with 2024 updates)
- Type II report covering operating effectiveness over a minimum 3-month observation period

**Report Recipients:**
- Sophia AI Factory management
- Prospective enterprise customers (restricted use)
- User entities of the system

### 2.2 Exclusions

The following are explicitly excluded from this engagement:
- SOC 1 (SSAE 18) reporting on financial controls
- ISO 27001 certification
- PCI DSS assessment
- HIPAA/HITECH compliance
- GDPR data protection impact assessment
- Any regulatory compliance beyond SOC 2 Type II
- Penetration testing or vulnerability assessment
- Code-level security review

---

## 3. Responsibilities

### 3.1 Client Responsibilities

The Client agrees to:

1. **Prepare Documentation:**
   - Provide complete system description
   - Supply control narratives and matrices
   - Make available all relevant policies and procedures
   - Grant auditor access to systems, logs, and configuration

2. **Define Control Objectives & Criteria:**
   - Select applicable trust service criteria (Security, Availability, Confidentiality, Processing Integrity, Privacy)
   - Define subservice organization considerations (Cloudflare, Inngest, NOWPayments)
   - Establish complementary user entity controls (if any)

3. **Maintain Control Environment:**
   - Implement and operate controls throughout the observation period
   - Remediate any control deficiencies identified during interim assessments
   - Ensure accurate and complete evidence collection

4. **Provide Access:**
   - Designate audit liaison available during fieldwork
   - Schedule subject matter expert interviews
   - Provide remote access to systems as needed
   - Respond to auditor inquiries within 48 hours

5. **Representations:**
   - Provide written management representation letter
   - Assert completeness and accuracy of provided information
   - Acknowledge responsibility for control design and operating effectiveness

### 3.2 Auditor Responsibilities

The Auditor agrees to:

1. **Perform Examination:**
   - Conduct examination in accordance with AICPA standards
   - Obtain sufficient appropriate evidence to support opinion
   - Apply professional judgment and skepticism

2. **Report Findings:**
   - Issue SOC 2 Type II report including:
     - Independent service auditor's report (opinion letter)
     - System description
     - Trust services criteria and controls
     - Control objectives and related controls
     - Tests of controls and results
     - Optional: other information section
   - Identify any material weaknesses or significant deficiencies
   - Provide management's responses to findings (if applicable)

3. **Communication:**
   - Provide draft report for management review prior to final issuance
   - Discuss findings and recommendations
   - Respond to reasonable inquiries during engagement

4. **Confidentiality:**
   - Maintain confidentiality of Client information
   - Use information solely for this engagement
   - Comply with professional ethics requirements

---

## 4. Timeline & Milestones

| Phase | Activity | Duration | Target Dates |
|-------|----------|----------|--------------|
| **Phase 0** | Engagement execution | 1 week | [Start Date] |
| **Phase 1** | Readiness assessment | 1-2 weeks | [Date] |
| **Phase 2** | Remediation period | 4-8 weeks | [Date Range] |
| **Phase 3** | Fieldwork | 2-3 weeks | [Date Range] |
| **Phase 4** | Draft report review | 1 week | [Date] |
| **Phase 5** | Final report issuance | 1 week | [Date] |
| **Total** | End-to-end engagement | 10-16 weeks | |

**Key Milestones:**
- **Kickoff Call:** [Date]
- **Evidence Request Due:** [Date]
- **Observation Period Start:** [Date] (3 months minimum)
- **Fieldwork:** [Date Range]
- **Draft Report Delivery:** [Date]
- **Final Report Issuance:** [Date]

**Note:** Timeline assumes Client meets remediation obligations in timely manner. Delays in remediation may extend engagement duration.

---

## 5. Fees & Payment Terms

### 5.1 Fee Structure

**Fixed-Fee Engagement:** $[TOTAL_FEE] USD

This is a **not-to-exceed** fixed fee covering all services described in Section 2.1, including:

| Component | Amount | Description |
|-----------|--------|-------------|
| Readiness Assessment | $[X,XXX] | Gap analysis, control design review |
| Planning & Scoping | $[X,XXX] | Engagement planning, criteria selection |
| Fieldwork | $[X,XXX] | On-site/remote testing, evidence evaluation |
| Report Preparation | $[X,XXX] | Draft and final report preparation |
| Remediation Support | $[X,XXX] | Up to 10 hours of post-fieldwork consulting |
| **Total** | **$[XX,XXX]** | **All-inclusive** |

### 5.2 Optional Add-Ons (Not Included)

| Service | Fee | When Required |
|---------|-----|---------------|
| Additional trust criteria (beyond Security/Availability) | +$5,000 | If Client adds Confidentiality/Processing Integrity |
| Gap analysis for ISO 27001 | +$3,000 | Separate engagement |
| Expedited timeline (<10 weeks) | +$2,000 | If Client requests rush |
| Extra remediation consulting (>10 hours) | $250/hour | As needed |

### 5.3 Reimbursable Expenses

**None Expected** - All meetings will be conducted remotely via video conference. No travel costs anticipated.

If travel becomes necessary at Client's request:
- Actual airfare + 10% administrative fee
- Lodging at actual cost + 10%
- Meals at per diem $75/day

### 5.4 Payment Schedule

| Invoice | Amount | Due Date | Trigger |
|---------|--------|----------|---------|
| 1. Engagement Fee | 50% = $[X,XXX] | Upon signing | Engagement letter executed |
| 2. Fieldwork Commencement | 30% = $[X,XXX] | [Date] | Start of fieldwork |
| 3. Final Report Issuance | 20% = $[X,XXX] | [Date] | Final report delivered |
| **Total** | **100%** | | |

**Payment Method:** Bank transfer or check. Invoice will include payment instructions.

**Late Payments:** Invoices overdue >30 days accrue interest at 1.5% per month.

### 5.5 Fee Assumptions

This fixed fee is based on:
1. Client providing complete, accurate documentation within agreed timelines
2. No major control design deficiencies requiring extensive re-work
3. Remote audit (no travel required)
4. Observation period of 3 months (minimum for Type II)
5. Client has ≤50 employees
6. Single system under examination (no complex subservice organization matrix)
7. Standard turnaround on auditor questions (≤48 hours)
8. No material control deficiencies requiring re-testing

**Fee Adjustment Triggers:**
- Major scope changes: +15-30%
- Client delays causing re-scheduling: +10%
- Additional systems beyond defined scope: +$5,000 per system
- Request for additional report copies >5: $250 each

---

## 6. Standard Terms & Conditions

### 6.1 Limitation of Liability

Auditor's liability for any claim arising from this engagement shall not exceed the total fees paid under this agreement. In no event shall Auditor be liable for indirect, incidental, or consequential damages.

### 6.2 Indemnification

Client agrees to indemnify and hold harmless Auditor and its personnel from any third-party claims arising from:
- Misrepresentations or omissions in Client-provided information
- Client's failure to implement or operate controls as described
- Client's breach of this agreement

### 6.3 Confidentiality

Auditor agrees to maintain confidentiality of Client information in accordance with AICPA Code of Professional Conduct. Client may disclose the final SOC 2 report to specified parties as defined in the report's distribution section.

Auditor may use Client name in marketing with prior written permission.

### 6.4 Independent Contractor

Auditor is an independent contractor, not an employee or agent of Client. Auditor is solely responsible for its personnel, taxes, and compliance with applicable laws.

### 6.5 Governing Law

This agreement is governed by the laws of the State of [State], without regard to conflict of laws principles.

Any dispute shall be resolved through arbitration in [City, State] under AICPA arbitration rules.

### 6.6 Termination

Either party may terminate this agreement with 14 days written notice. Upon termination:
- Client pays for all services rendered through termination date
- Auditor delivers all work-in-progress to Client
- Confidentiality obligations survive termination

If Client terminates after fieldwork begins but before report issuance, a minimum of 70% of fees are due.

### 6.7 Force Majeure

Neither party is liable for delays or failures caused by circumstances beyond reasonable control (pandemic, natural disaster, government action). Parties will cooperate to reschedule affected activities.

### 6.8 Entire Agreement

This engagement letter constitutes the entire agreement between the parties. Any modifications must be in writing and signed by both parties.

---

## 7. Additional Provisions

### 7.1 Subservice Organizations

Sophia AI Factory uses the following subservice organizations whose controls may be included in the SOC 2 report via carve-out or inclusive method:

| Provider | Service | Method |
|----------|---------|--------|
| Cloudflare | Edge compute, D1 database, R2 storage | Carve-out (client obtains their SOC 2) |
| Inngest | Background job orchestration | Carve-out (client obtains their SOC 2) |
| NOWPayments | Payment processing | Carve-out (client verifies their PCI DSS) |
| HeyGen | Video generation AI | Carve-out (client verifies their SOC 2/ISO) |

**Auditor Responsibility:** Auditor will obtain and review subservice organization's SOC 2 reports to evaluate their relevance to Client's controls.

### 7.2 User Entity Controls

The SOC 2 report will identify any complementary user entity controls that customers must implement (e.g., secure API key storage, IP allowlisting). These are not tested as part of this engagement.

### 7.3 Report Distribution

The SOC 2 Type II report is intended for:
- Sophia AI Factory management
- Existing and prospective customers (restricted use)
- Auditors of user entities

The report will include a "Restricted Use" legend indicating it is not for general public distribution.

### 7.4 Digital Delivery

Final report will be delivered as:
- Primary: PDF document with digital signature
- Secondary: CSV of control test results (machine-readable)
- Archive: Secure cloud storage link (expires in 1 year)

---

## 8. Signatures

By signing below, the parties agree to the terms of this engagement.

**Sophia AI Factory:**

___________________________
[Name], Chief Operating Officer  
Date: _______________

**Auditor:**

___________________________
[Name], [Title]  
[Auditor Firm Name]  
Date: _______________

---

## 9. Attachments

### Attachment A: Sample SOC 2 Report Outline

```
1. Independent Service Auditor's Report
2. Management's Assertion
3. System Description
4. Trust Services Criteria and Related Controls
5. Control Objectives and Related Controls
   - Control Activities
   - Complementary User Entity Controls
   - Subservice Organization Controls
6. Tests of Controls and Results
7. Other Information (if applicable)
```

### Attachment B: Preliminary Evidence Request List

**To be delivered prior to fieldwork:**

1. **System Documentation**
   - Architecture diagram
   - Data flow diagrams
   - Network topology
   - Component inventory

2. **Policies & Procedures**
   - Information security policy
   - Incident response plan
   - Change management procedure
   - Access management policy
   - Backup and disaster recovery plan

3. **Control Evidence (3-month sample)**
   - User access reviews
   - Change management logs
   - Vulnerability scan reports
   - Backup verification logs
   - Incident tickets/resolutions

4. **Technical Configuration**
   - Cloudflare Workers configuration
   - D1 database schema and access controls
   - Encryption key management procedure
   - Logging and monitoring setup

5. **Subservice Organization Reports**
   - Cloudflare SOC 2 (if available)
   - Inngest SOC 2
   - NOWPayments PCI DSS Attestation of Compliance

---

## 10. Acceptance

☐ I have read and agree to the terms of this engagement letter.

**Authorized Signature:** _________________________  
**Print Name:** _________________________  
**Title:** _________________________  
**Date:** _______________

---

**Template Version:** 1.0  
**Last Updated:** 2026-06-22  
**Prepared For:** Sophia AI Factory SOC 2 Engagement  
**Usage:** Customize with specific fees, dates, and auditor details before sending
