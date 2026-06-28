# Scale Readiness — Sophia AI Factory

**Date:** 2026-06-03  
**Gate:** 7 — Scale Ready  
**Stage:** Stable Fulfillment → Scale Ready

---

## 1. Scale Readiness Criteria

**Scale Ready** = the business can 10x revenue without 10x founder effort or infrastructure cost.

---

## 2. Unit Economics at Scale

### Per-Customer Economics

| Metric | BASIC ($199) | PREMIUM ($399) | ENTERPRISE ($799) |
|--------|-------------|----------------|-------------------|
| Revenue | $199/mo | $399/mo | $799/mo |
| COGS | $10/mo | $10/mo | $10/mo |
| Gross Margin | 95% | 97.5% | 98.7% |
| CAC Target | <$50 | <$100 | <$200 |
| LTV (12mo) | $1,788 | $3,588 | $7,188 |
| LTV:CAC | 36:1 | 36:1 | 36:1 |

### Scaling Economics

| Customers | MRR | Infrastructure Cost | Gross Profit |
|-----------|-----|-------------------|-------------|
| 10 | $1,990 | ~$100 | $1,890 |
| 50 | $9,950 | ~$500 | $9,450 |
| 100 | $19,900 | ~$1,000 | $18,900 |
| 500 | $99,500 | ~$5,000 | $94,500 |
| 1000 | $199,000 | ~$10,000 | $189,000 |

**Key insight**: Cloudflare Workers free tier covers up to 10M requests/day. Infrastructure is essentially free until 1,000+ customers.

---

## 3. Infrastructure Scale Limits

| Component | Free Tier Limit | Paid Tier | Cost at 1000 customers |
|-----------|---------------|-----------|----------------------|
| CF Workers | 10M requests/day | $0.50/M | ~$150/mo |
| D1 SQLite | 5M reads/day | $0.75/M | ~$50/mo |
| R2 Storage | 10GB | $0.015/GB | ~$50/mo |
| Email (Resend) | 3K/day | $20/mo | ~$20/mo |
| Sentry | 5K errors/mo | $26/mo | ~$26/mo |
| HeyGen | Pay-per-use | ~$24/customer | Customer pays (BYOK) |
| MuAPI | Pay-per-use | ~$10/customer | Customer pays (BYOK) |

**Total infrastructure at 1000 customers: ~$300/mo** — less than 1% of MRR.

---

## 4. Operational Scale Capacity

### Current State → Target

| Dimension | Current | Gate 7 Target | Gap |
|-----------|---------|---------------|-----|
| Customers supported | 0–10 (manual) | 100 (automated) | Automation |
| Support response | Founder (ad-hoc) | Bot + CS (SLA) | Staffing |
| Onboarding time | 2–4h manual | <30min self-serve | UX |
| Video delivery | Manual QC | Automated pipeline | Scaling |
| Revenue tracking | Spreadsheet | Dashboard | Tooling |

### Automation Roadmap to Scale

| Phase | Automation | Impact | Timeline |
|-------|-----------|--------|----------|
| 1 | BYOK self-serve (no human needed) | -4h/customer | Done |
| 2 | Video template library (100+) | -1h/video | Month 1 |
| 3 | Bot-driven onboarding | -2h/customer | Month 1 |
| 4 | Automated email sequences | -1h/week | Month 2 |
| 5 | CS ticket routing + canned responses | -2h/day | Month 2 |
| 6 | Usage-based alerts + upsell prompts | +15% ARPU | Month 3 |

---

## 5. Team Structure for Scale

### Phase 1 (0–50 customers): Solo + AI

| Role | Fulfillment |
|------|-------------|
| Founder | Strategy + big deals |
| OpenClaw (AI) | Code, deploy, ops |
| Bot | 80% customer support |
| CS Agent (async) | Escalation (2h/week) |

### Phase 2 (50–200 customers): Add 1 human

| Role | Fulfillment |
|------|-------------|
| Founder | Strategy + enterprise |
| OpenClaw (AI) | Everything technical |
| 1 CS (part-time) | Full-time support |
| Bot | 60% support |
| 1 Content (part-time) | Blog + SEO |

### Phase 3 (200–1000 customers): Small team

| Role | Count |
|------|-------|
| Founder | 1 (strategy) |
| OpenClaw (AI) | 1 (CTO) |
| CS | 2 (full-time) |
| Content | 1 (full-time) |
| Sales | 1 (full-time) |

---

## 6. Risk Management at Scale

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| API rate limits (HeyGen/MuAPI) | Medium | High | Queue system + retry + fallback providers |
| Founder leaves | Low | Critical | AI agent can run ops; knowledge base complete |
| Cloudflare outage | Low | Medium | Multi-region D1 backup + R2 redundancy |
| Competitor price war | Medium | Medium | Emphasize BYOK + VN localization moat |
| Support backlog | Medium | High | Bot handles 80% + CS team scales linearly |
| Payment provider failure | Low | High | Dual provider (NOWPayments + PayOS) |

---

## 7. Financial Scale Projections

### Revenue vs Cost at Scale

| Month | Customers | MRR | Infrastructure | CS Cost | Net |
|-------|-----------|-----|---------------|---------|-----|
| 1 | 1 | $199 | $10 | $0 | $189 |
| 3 | 10 | $1,990 | $100 | $50 | $1,840 |
| 6 | 50 | $9,950 | $500 | $300 | $9,150 |
| 12 | 200 | $39,800 | $1,000 | $1,500 | $37,300 |

**Net margin at 200 customers: ~94%** — scales linearly.

---

## 8. Gate 7 Criteria

**Gate 7 (scale-ready) is achieved when:**

1. ✅ Unit economics documented (95% gross margin, $0–$10 CAC)
2. ✅ Infrastructure capacity mapped (free tier to 1000+ customers)
3. ✅ Operational automation roadmap defined (6 phases)
4. ✅ Team scaling plan documented (3 phases)
5. ⏳ At least 20 paying customers (pending execution)
6. ⏳ Month 2 retention ≥50% (pending execution)

**Estimated Time to Gate 7**: 8–12 weeks from now

---

*Generated: 2026-06-03*
