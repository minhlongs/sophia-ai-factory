# CEO Handoff Package v3 — Media Agency Pilot Edition

**Phiên bản**: 3.0 | **Ngày**: 2026-06-12 | **Audience**: CEO non-technical, công ty Media
**Pilot structure**: 12-week (Discovery → Implementation → Value Realization)

---

## 1. Executive Summary (đọc đầu tiên, 3 phút)

**Sophia AI Factory** giúp CEO công ty Media tự động hóa content production mà không cần thuê developer. Bạn setup một lần, sau đó đội ngũ tự chạy.

| Chỉ số | Giá trị |
|--------|---------|
| Production URL | https://sophia.agencyos.network |
| Trạng thái | ✅ LIVE |
| Pilot length | 12 tuần |
| Pilot discount | 25-50% off first 3-6 months |
| Setup time | 24-48 giờ |
| Time-to-first-value | 7 ngày |

**3 điều CEO cần biết**:
1. **Không cần code**. Mọi thứ qua Setup Wizard + Telegram bot.
2. **AI giúp, không thay**. Đội ngũ creative vẫn làm decision, AI accelerate execution.
3. **Pilot, không commitment**. Sau 12 tuần CEO đánh giá ROI rồi quyết định tiếp.

---

## 2. Cách Đọc Tài Liệu Này

Tài liệu này dài, nhưng CEO chỉ cần đọc **mục 1, 2, 8, 9**. Các mục còn lại cho ops lead hoặc khi cần tra cứu.

**Mỗi mục có 3 cấp độ**:
- 📖 **Đọc** — phải đọc
- 🔍 **Tra cứu** — đọc khi cần
- ⏭️ **Bỏ qua** — cho technical team

---

## 3. Pilot 12-Week Roadmap

### Phase 1: Discovery (Tuần 1-2)

**Mục tiêu**: Hiểu workflow hiện tại của agency + map vào Sophia.

| Tuần | Hoạt động | Owner | CEO involvement |
|------|-----------|-------|-----------------|
| 1 | Kickoff call (60 min), stakeholder map | Account Manager | ✅ Tham dự |
| 1 | Setup Sophia workspace (tự hoặc có support) | Ops lead | ⏭️ Delegate |
| 2 | Workflow audit: brief → approval → publish | Account Manager + Ops | ⏭️ Review summary |
| 2 | Success criteria defined + signed off | CEO + AM | ✅ Approve |

**CEO gate cuối tuần 2**: Approve "what does success look like" document.

### Phase 2: Implementation (Tuần 3-8)

**Mục tiêu**: Setup integrations + train team + go-live.

| Tuần | Hoạt động | Owner | CEO involvement |
|------|-----------|-------|-----------------|
| 3 | Connect 3 channels (YouTube/TikTok/blog) | Ops lead | ⏭️ |
| 4 | Train 5-10 team members | AM + Ops | 🔍 Optional join |
| 5 | First AI-generated content (test mode) | Creative team | ⏭️ |
| 6 | First published content via Sophia | Creative team | ✅ First win to celebrate |
| 7 | Reporting dashboard activated | Ops lead | 📖 Read first report |
| 8 | Mid-pilot review (30-min call) | CEO + AM | ✅ 30-min call |

**CEO gate cuối tuần 8**: Mid-pilot review — has the team adopted? Are we on track?

### Phase 3: Value Realization (Tuần 9-12)

**Mục tiêu**: Measure ROI + decide next phase.

| Tuần | Hoạt động | Owner | CEO involvement |
|------|-----------|-------|-----------------|
| 9-11 | Continuous usage, A/B test workflows | Creative + Ops | ⏭️ |
| 12 | ROI report delivered | AM | 📖 Read |
| 12 | QBR meeting (60-min) | CEO + AM + Ops | ✅ Decide go/no-go |

**CEO gate cuối tuần 12**: QBR — extend pilot, convert to paid, or pause.

---

## 4. CEO Dashboard (5 KPIs)

Mỗi thứ Sáu, CEO nhận email 1 trang với 5 con số:

```
📊 Sophia Weekly — Tuần 12 (2026-06-12)
─────────────────────────────────────────
1. Revenue impact: $47,300 (↑ 12% vs tuần trước)
2. Active users: 23/28 (82% adoption)
3. Uptime: 99.94% (SLA: 99.9%)
4. Support response: P0=8min, P1=2hr, P2=24hr
5. Client retention: 96% (target: 95%)
─────────────────────────────────────────
Trend: ✅ Tất cả trên target
```

**Definitions**:
1. **Revenue impact**: doanh thu từ content published via Sophia (tracked via UTM + conversions)
2. **Active users**: team members logged in + created ≥1 content trong tuần
3. **Uptime**: percentage of time service available (measured from edge requests)
4. **Support response**: median time to first response by severity
5. **Client retention**: % of customers still active (for agencies, this is your client retention)

---

## 5. Runbook: What To Do When X Breaks

### Symptom: Service down (sophia.agencyos.network not loading)

| Severity | Check | Action |
|----------|-------|--------|
| P0 | Status page | https://status.sophia.agencyos.network |
| P0 | Slack #sophia-incidents | Real-time updates |
| P0 | Wait 15 min | Cloudflare usually auto-resolves |

**If P0 > 30 min**: Gọi AM trực tiếp (số trong mục 9).

### Symptom: AI generation fails

1. Check API key valid (BYOK dashboard)
2. Check rate limit (mỗi model có limit riêng)
3. Try different model
4. Nếu vẫn fail: Tạo support ticket trong Slack channel

### Symptom: Payment failed

1. Check billing email → xem reason
2. Update payment method
3. Nếu cần support: Gọi AM

### Symptom: Team member can't login

1. Reset password (CEO không cần làm — user tự reset)
2. Nếu vẫn fail: Tạo support ticket

---

## 6. Communication Channels

| Channel | Use case | Response time |
|---------|----------|---------------|
| **Slack Connect** #sophia-{your-company} | Daily ops, questions | Hours |
| **Email** support@sophia.agencyos.network | Tickets, audit trail | 24hr P2, 2hr P1 |
| **WhatsApp** (AM direct) | True emergencies only | 30 min P0 |
| **Weekly Friday email** | CEO 5 KPIs digest | Auto |
| **Monthly QBR** | Strategic review | Scheduled |

**Anti-pattern**: Gọi trực tiếp engineer về technical issue → AM là layer đầu tiên, họ escalate.

---

## 7. Onboarding Checklist (Tuần 1)

Print cái này, đưa cho ops lead:

```
□ Create account: sophia.agencyos.network/signup
□ Verify email
□ Setup Wizard (15 min):
  □ Company profile
  □ Content niche
  □ Connect channels (YouTube/TikTok/...)
  □ BYOK keys (optional)
  □ Telegram bot pairing
□ Invite 5 team members
□ Connect payment method (NOWPayments/PayOS)
□ Schedule kickoff call with AM
□ Define success criteria (CEO + AM)
```

---

## 8. Pricing & Pilot Terms

### Pilot Pricing (12 weeks)

| Tier | Standard Monthly | Pilot Monthly | Savings |
|------|------------------|---------------|---------|
| BASIC | $99 | $49 | 50% off |
| PREMIUM | $499 | $374 | 25% off |
| ENTERPRISE | $1,999 | $1,499 | 25% off |

### What Pilot Includes

- Full feature access (no gating)
- Dedicated Account Manager (named human)
- Weekly status email
- Mid-pilot review + QBR
- 90-day money-back guarantee

### What Happens After Pilot

- If **continue**: standard pricing resumes, lock in pilot rate for first 3 months
- If **pause**: data exported, account closed within 30 days
- If **extend**: 4-week extension at 50% off (one-time only)

### Discount Limitations

- Pilot discount applies to **first 3 months only**
- Standard pricing from month 4
- Cannot stack with other promotions
- Limited to **first 50 customers** (we're capping early-adopter program)

---

## 9. Key Contacts

| Role | Person | Contact | Hours |
|------|--------|---------|-------|
| **Account Manager** | [Assigned] | am-{company}@sophia.agencyos.network | Mon-Fri 9-18 UTC |
| **CEO Sponsor** | Long Tho | long@sophia.agencyos.network | By appointment |
| **Support (24/7 P0)** | On-call | +1-XXX-XXX-XXXX | Always |
| **Billing** | Billing team | billing@sophia.agencyos.network | Mon-Fri |
| **Legal/DPA** | Legal team | legal@sophia.agencyos.network | 7-day SLA |
| **Security incident** | Security team | security@sophia.agencyos.network | 24/7 |

---

## 10. Quick Reference Card (print ra, dán bàn)

```
┌─────────────────────────────────────────────┐
│  SOPHIA AI FACTORY — CEO QUICK REF          │
├─────────────────────────────────────────────┤
│  URL:  sophia.agencyos.network              │
│  Slack: #sophia-{your-company}              │
│  AM:   am-{your-company}@sophia...          │
│  P0:   +1-XXX-XXX-XXXX                      │
├─────────────────────────────────────────────┤
│  Weekly digest: every Friday                │
│  QBR: monthly (60 min)                      │
│  Pilot: 12 weeks, 25-50% off                │
└─────────────────────────────────────────────┘
```

---

## 11. Risk & Limitations (Honest)

**What we're good at**:
- Content production acceleration (3-5x faster)
- Multi-channel publishing
- Reporting automation
- Team collaboration

**What we're NOT (yet)**:
- Real-time analytics (15-min lag, not sub-second)
- Advanced A/B testing (basic only)
- Native CRM (we integrate with HubSpot/Salesforce)
- Enterprise SSO (planned Phase 4)

**Known limitations**:
- BYOK keys required for some AI models (BYOK = bring-your-own-key)
- D1 write limits: 50M writes/month (sufficient for most agencies)
- Video generation: 5-15 min per video depending on length

---

## 12. Next Steps

1. **Today**: Read sections 1, 2, 8, 9 (~10 min)
2. **This week**: Schedule kickoff call
3. **Next week**: Start pilot (Day 1 = wizard completion)
4. **Daily first week**: Check Slack for support
5. **Weekly**: Read Friday digest email
6. **Month 1**: Mid-pilot review

**Questions?** Reply to this email or ping AM in Slack.

---

**Appendix** (for ops lead / technical team):
- A. Detailed API reference
- B. Webhook integration guide
- C. SSO setup (Enterprise tier)
- D. Custom report templates
- E. Compliance docs (GDPR, DMCA, EU AI Act)

**Last reviewed**: 2026-06-12
**Next review**: After first customer completes pilot
