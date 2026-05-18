# Escalation Contacts / Liên Hệ Cấp Cao

> Sophia AI Factory — internal/friendly handover
> Last updated: 2026-05-18
> **Note:** NDA / SLA / IP transfer clauses intentionally omitted per internal/friendly client agreement. Add commercial clauses here if/when the engagement transitions to external commercial.

---

## 1. Primary contacts / Liên Hệ Chính

| Role / Vai Trò | Contact / Liên Hệ | Hours / Giờ Làm Việc | Response SLA |
|---|---|---|---|
| **Platform Operator** | operator@agencyos.network *(placeholder — update with actual)* | 9am-9pm GMT+7 weekdays | < 4h business hours |
| **Customer Support** | support@agencyos.network *(placeholder)* | 9am-9pm GMT+7 weekdays | < 1 business day |
| **Security (vuln disclosure)** | security@agencyos.network | 24/7 monitored | < 24h Critical / < 48h High |
| **Emergency (P0 only)** | *(phone — provide out-of-band)* | 24/7 | Best-effort |

---

## 2. Escalation path / Tầng Cấp Cao

```
P3 Low      → Email Customer Support           (next business day)
P2 Medium   → Email Operator                   (< 4h business hours)
P1 High     → Email Operator + cc Security     (< 1h)
P0 Critical → Email Operator + SMS / Phone     (< 15 min)
```

### Step-by-step (P0/P1)

1. **Email Operator** with severity, scope, evidence (logs/screenshots)
2. If no response in 1h (P0) or 4h (P1) → SMS / phone Emergency number
3. If P0 unresolved 24h → coordinate rollback OR partial degradation
4. Document in `docs/postmortems/INC-<YYYY-MM-DD>-<slug>.md` within 48h of resolution

---

## 3. Hand-off matrix / Ma Trận Bàn Giao

| Concern / Vấn Đề | Owner / Người Phụ Trách |
|---|---|
| Production deploy / Deploy production | Platform Operator |
| Customer billing inquiries / Hỏi về billing | Customer Support → escalate to Operator if technical |
| BYOK key issues (OpenRouter, ElevenLabs, etc.) | Customer self-service via Setup Wizard; Support assists |
| NOWPayments integration / Tích hợp NOWPayments | Platform Operator (CF Worker secrets owner) |
| D1 schema migrations / Migration D1 | Platform Operator |
| CF Workers / D1 / R2 capacity issues / Vấn đề tài nguyên CF | Platform Operator |
| Security vulnerability reports / Báo cáo lỗ hổng bảo mật | Security (see [SECURITY.md](../../../SECURITY.md)) |
| Doctrine interpretation / Diễn giải doctrine | Platform Operator + reference `.claude/rules/sophia-no-tech-doctrine.md` |

---

## 4. After-hours / Ngoài Giờ Làm Việc

- Email is monitored asynchronously; do NOT expect instant reply outside business hours
- Phone/SMS for **P0 only** (real production outage)
- For non-P0 issues outside hours: wait until next business day

---

## 5. Hand-off acknowledgement / Xác Nhận Bàn Giao

By using this document, the recipient acknowledges:
- The list above is the **only** support channel
- Doctrine v1.28.1 (no operator third-party setup) applies
- Customer-side BYOK keys are customer responsibility (see [SECURITY.md](../../../SECURITY.md) out-of-scope)
- No SLA contractual penalty; best-effort response per the matrix above

---

## 6. Updates / Cập Nhật

This document is intentionally short. Update directly via PR when:
- Operator transitions to a new email
- Phone number changes
- New escalation tier added
- Engagement transitions from internal/friendly → external commercial (add NDA/SLA/IP clauses)
