# DMCA Safe Harbor Policy

**Version**: 1.0 | **Effective**: 2026-06-12 | **Compliance**: 17 U.S.C. § 512(c)

---

## 1. Designated DMCA Agent

Sophia AI Factory has designated an agent with the U.S. Copyright Office to receive notifications of claimed infringement.

**Agent name**: Long Tho
**Email**: dmca-agent@sophia.agencyos.network
**Postal address**: [To be registered with US Copyright Office]
**Registration**: Filed 2026-06-12 (pending confirmation, ~30-day processing)

---

## 2. Notification of Claimed Infringement

If you believe content hosted by Sophia AI Factory infringes your copyright, you may submit a notification under 17 U.S.C. § 512(c)(3). Your notification must include:

### Required Elements (§ 512(c)(3)(A))

1. **Physical or electronic signature** of person authorized to act on behalf of copyright owner
2. **Identification of copyrighted work** claimed to have been infringed (or representative list for multiple works)
3. **Identification of infringing material** with sufficient detail to locate it (URL, content_id, timestamp)
4. **Contact information**: address, telephone number, email
5. **Good faith statement**: "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law"
6. **Accuracy and authority statement**: "I swear, under penalty of perjury, that the above information is accurate and I am authorized to make this complaint on behalf of the copyright owner"

### Where to Send

- **Primary**: dmca-agent@sophia.agencyos.network
- **Endpoint**: POST /api/dmca-agent (public, no auth)

---

## 3. Counter-Notification (§ 512(g))

If you believe your content was removed (or access disabled) in error or misidentification, you may submit a counter-notification including:

1. Physical or electronic signature
2. Identification of material and location before removal
3. Statement under penalty of perjury: "I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification"
4. Name, address, telephone, consent to jurisdiction of federal district court
5. Statement: "I will accept service of process from the person who provided notification or their agent"

### Counter-Notice Process

1. Counter-notification received → forwarded to original complainant
2. 10-14 business days waiting period
3. If complainant does not file lawsuit → material restored within 14 business days
4. User notification on restoration

---

## 4. Repeat Infringer Policy (§ 512(i)(1)(A))

Sophia AI Factory reserves the right to terminate access for repeat infringers.

### Strike System

| Strike | Action |
|--------|--------|
| 1st valid notice | Content removed, user notified, warning issued |
| 2nd valid notice | Content removed, account 30-day suspension, second warning |
| 3rd valid notice | Account terminated, all data deleted per Art. 28(3)(g) |

### Strike Reset

- After 12 months without additional strikes, strike count resets to 0
- Counter-notice successfully upheld = strike reversed
- Counter-notice rejected = strike counted

### Appeal

Users may appeal strike by emailing dmca-agent@sophia.agencyos.network within 14 days. Reviewed by designated agent within 7 business days.

---

## 5. Accommodation of Standard Technical Measures (§ 512(i)(2))

Sophia AI Factory accommodates and does not interfere with:

- Standard technical measures used by copyright owners to identify protected works (e.g., watermarking, fingerprinting)
- Industry-standard content identification systems

We do **not** interfere with metadata, headers, or technical protection measures applied by copyright owners to their content.

---

## 6. No Red Flag Knowledge (§ 512(c)(1)(A)(ii))

Sophia AI Factory does not have actual knowledge of infringing activity, and is not aware of facts or circumstances from which infringing activity is apparent.

### Detection Mechanisms

- DMCA notices submitted to designated agent
- User-flagged content via in-app report button
- Automated scanning of content hash against known-infringing databases (planned Phase 4)
- AI-generated content marked with C2PA metadata (per EU AI Act Art. 50)

---

## 7. No Direct Financial Benefit (§ 512(c)(1)(B))

Sophia AI Factory does not have the right and ability to control infringing activity, and does not directly benefit financially from the infringing material.

Infringement policy does not depend on subscription tier — all users subject to same takedown workflow.

---

## 8. Content Storage Practices

| Content Type | Retention | Encryption |
|--------------|-----------|------------|
| User-uploaded assets | Until user deletes or account terminated | TLS in transit, AES at rest |
| Generated AI content | Until user deletes, 30-day soft delete | Same as above |
| Generated logs | 90 days | Same as above |
| DMCA notices | 3 years (legal hold) | Same as above |

---

## 9. Cooperation with Copyright Owners

Sophia AI Factory will:

- Respond to valid DMCA notices within 24 hours
- Provide complainant with confirmation of action taken
- Preserve evidence for 90 days in case of lawsuit
- Testify in court if subpoenaed (subject to jurisdiction)

---

## 10. Misuse Warnings

### Misuse of DMCA Process

Knowingly making false claims of infringement is a violation of 17 U.S.C. § 512(f) and may subject the sender to liability for damages, including attorney's fees.

### Good Faith Requirement

Before sending a DMCA notice, copyright owners should consider whether the use could qualify as fair use under 17 U.S.C. § 107.

---

## 11. Modifications

This policy may be updated to reflect changes in law, business practice, or service offerings. Material changes will be notified via email to all users 30 days in advance.

---

## 12. Contact

**General questions**: legal@sophia.agencyos.network
**DMCA notices only**: dmca-agent@sophia.agencyos.network
**Counter-notices**: dmca-agent@sophia.agencyos.network

---

**Source**: 17 U.S.C. § 512, EFF DMCA guide, US Copyright Office
**Last reviewed**: 2026-06-12
**Next review**: 2026-09-12
