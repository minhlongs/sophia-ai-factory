# Pricing & Trial Strategy Decision Matrix

## TL;DR — Operator's Choice

**Question:** Free 7-day trial or $1 paid trial?

**Quick answer:** 
- ✅ **Free 7-day** if you want volume and easy onboarding
- ✅ **$1 Paid trial** if you want higher conversion + immediate signal of intent
- ✅ **Split test 50/50** first 200 signups, decide based on data

**Recommendation (placeholder for operator):** [OPERATOR FILLS IN CHOICE]

---

## Free 7-Day Trial — Model Details

**How it works:**
1. User signs up with email only (no credit card)
2. Immediate access to Sophia dashboard
3. Can run unlimited campaigns for 7 days
4. On day 8, access blocks → upgrade to paid or lose access

**Advantages:**
- ✅ Zero friction — no payment required upfront
- ✅ High signup volume expected
- ✅ Low abandonment during signup
- ✅ Generous brand perception (customers trust you)

**Risks:**
- ❌ High trial-to-paid conversion leakage (users abandon after 7d)
- ❌ Free-tier abuse (bots, spam tests, niche harvesting)
- ❌ Support load (users expect free support during trial)
- ❌ Longer CAC payback (4–5 months if only 10% convert)

**Conversion rate assumptions:**
- Expected conversion: 5–15% (low end of SaaS freemium)
- Best case: 20% (with heavy onboarding emails)

**Projected CAC payback:** 3–4 months  
**Projected LTV:** If LTV = $500/year, CAC = $50, payback = 3–4 months ✅

---

## $1 Paid Trial — Model Details

**How it works:**
1. User signs up and enters credit card
2. Charged $1 immediately (via NOWPayments USDT or Stripe)
3. Gets 7 days full access
4. On day 8, automatically charged $60 (Growth tier) unless cancelled

**Advantages:**
- ✅ High signal of intent (any payment = serious buyer)
- ✅ Fraud reduction (payment screen filters bots)
- ✅ Conversion lift: 20–40% higher than free (published SaaS data)
- ✅ Faster CAC payback (1–2 months)
- ✅ Lower churn (customer already invested $1, less likely to forget)

**Risks:**
- ❌ Friction in signup (some users abandon at payment screen)
- ❌ Refund/chargeback risk (especially crypto via NOWPayments)
- ❌ Brand perception: "you're charging for a trial?" (can seem cheap)
- ❌ Payment provider dependency (if NOWPayments is down, signups blocked)

**Conversion rate assumptions:**
- Expected conversion: 20–30% (high end, paid trial selects serious buyers)
- Best case: 40% (with clear ROI copy)

**Projected CAC payback:** 1–2 months  
**Projected LTV:** If same $500/year LTV, CAC = $50, payback = 1–2 months ⚡

---

## Side-by-Side Comparison Table

| Criterion | Free 7d | $1 Paid Trial |
|---|---|---|
| **Conversion to Paid (assumed)** | 5–15% | 20–40% |
| **CAC Payback (months)** | 3–4 | 1–2 |
| **Refund/Chargeback Risk** | LOW (no payment) | MED (payment friction) |
| **Fraud Surface** | HIGH (free abuse) | LOW (payment filters) |
| **Churn at Trial End** | HIGH (70–80% forget) | LOW (40–50% cancel) |
| **Signup Volume** | HIGH (easy) | MEDIUM (payment friction) |
| **Support Load** | MEDIUM (users expect free help) | LOW (paid users demand quality) |
| **Brand Perception** | "Generous, trusting" | "Confident, premium" |
| **Implementation Effort** | LOW (no payment flow) | MEDIUM (payment + IPN webhook) |
| **Best For** | Volume + brand warm-up | Quality + revenue-focused |

---

## Payment Provider Notes

### Free 7-day Trial
- No payment integration needed
- You provide tier access via manual grant or JWT token
- Simplest implementation

### $1 Paid Trial (NOWPayments)
- User → NOWPayments checkout → $1 charged (USDT-TRC20)
- IPN webhook confirms payment → Sophia grants tier access
- Downside: crypto adds friction for some users
- Upside: no chargeback risk, instant settlement

### $1 Paid Trial (Stripe)
- User → Stripe checkout → $1 charged (USD via card)
- Stripe billing webhook → Sophia grants tier
- Upside: card is more familiar than crypto
- Downside: Stripe will hold funds for "faceless business" review (historical risk)

**Recommendation:** Stick with **NOWPayments** for $1 trial (no chargeback risk). If you want card option, research Stripe's current policy on faceless content (as of 2026-05-17, policy unclear).

---

## Hero CTA Copy Variants

### Free 7-day Trial CTAs

**Variant 1 (Basic):**
- **EN:** "Try Sophia free for 7 days — no card required"
- **VN:** "Dùng thử Sophia miễn phí 7 ngày — không cần thẻ"

**Variant 2 (Social Proof):**
- **EN:** "Join 500+ creators running AI videos — free for 7 days"
- **VN:** "Tham gia 500+ creators dùng AI videos — 7 ngày miễn phí"

**Variant 3 (FOMO):**
- **EN:** "Start your free trial now — limited to 100 spots"
- **VN:** "Bắt đầu dùng thử miễn phí ngay — giới hạn 100 spots"

---

### $1 Paid Trial CTAs

**Variant 1 (Direct):**
- **EN:** "Start your $1 trial — full access for 7 days"
- **VN:** "Bắt đầu chỉ với $1 — truy cập toàn bộ trong 7 ngày"

**Variant 2 (Confidence):**
- **EN:** "Pay $1 to try — confident you'll see ROI in 7 days"
- **VN:** "Chỉ trả $1 dùng thử — chúng tôi tự tin bạn thấy ROI"

**Variant 3 (Comparison):**
- **EN:** "Get started for $1 — cheaper than a coffee"
- **VN:** "Bắt đầu với $1 — rẻ hơn một ly cà phê"

---

### Hybrid: Split Test CTA

**For A/B testing (recommend if unsure):**
- **Variant 1 (Test Group A):** "Try free for 7 days"
- **Variant 2 (Test Group B):** "Start for just $1 — or join the free waitlist"

Split first 200 signups 50/50 and measure:
- Signup conversion rate (free vs paid)
- Trial-to-paid conversion rate
- 30-day churn rate
- Decision: pick winner, roll out to 100% traffic

---

## Decision Framework

Use this decision tree to pick your trial model:

```
START: "What's my primary growth goal?"

├─ "Volume + brand awareness"
│  └─ → FREE 7-day trial
│     (Goal: get as many trial starts as possible)
│
├─ "Predictable revenue + conversion focus"
│  └─ → $1 PAID trial
│     (Goal: high-intent customers, faster payback)
│
└─ "I'm not sure — let data decide"
   └─ → SPLIT TEST 50/50
      (Goal: run A/B test, pick winner after 200 signups)
```

### Scoring Worksheet

**Weight each criterion (1–5 scale, 5 = most important):**

| Factor | Free 7d | $1 Trial | Your Weight |
|---|---|---|---|
| Need quick revenue? | 1/5 | 5/5 | ___ |
| Want maximum signups? | 5/5 | 2/5 | ___ |
| Have payment infra ready? | 5/5 | 3/5 | ___ |
| Risk-averse (prefer simple)? | 5/5 | 2/5 | ___ |
| Competitive + need edge? | 2/5 | 5/5 | ___ |

**Scoring:**
- If free 7d score > $1 trial → go **free 7-day**
- If $1 trial score > free 7d → go **$1 paid**
- If tied or uncertain → run **split test** first month

---

## Implementation Checklist

### For Free 7-day Trial
- [ ] Signup form → stores email only
- [ ] JWT token issued → grants TIER: "BASIC" for 7 days
- [ ] Cron job: daily check for expired trials, downgrade to "FREE"
- [ ] Email day 1: "Your 7-day trial started"
- [ ] Email day 6: "2 days left — upgrade now" (upsell)
- [ ] Email day 8: "Trial ended" + re-engagement flow

### For $1 Paid Trial
- [ ] Signup form → collects email + NOWPayments wallet
- [ ] Checkout → user confirms $1 charge
- [ ] IPN webhook → confirms payment, issues TIER: "GROWTH" for 7 days
- [ ] Day 8 auto-charge: $60 (or user cancels)
- [ ] Email day 1: "Payment confirmed" + welcome
- [ ] Email day 6: "Last day to use your trial"
- [ ] Email day 9: "Auto-charged $60" or "Cancelled"

---

## Operator Decision (RESOLVED 2026-05-17)

**Final choice: SPLIT TEST 50/50**

**Scoring result (4-factor weighted matrix):**
- Free 7d: 65 points
- $1 trial: 70 points (narrow 8% win — effectively tied)
- All 4 factors weighted HIGH = contradictory pulls (quick revenue + competitive edge pull to $1; max signups + risk-averse pull to free). No conviction direction.

**Reasoning:**
Math too close to ship single variant confidently. Operator's audience may not match SaaS published benchmarks (5-20% free conversion, 25-50% paid). Data-driven decision via real signups > guess.

**Implementation status:**
- Decision: SPLIT TEST 50/50
- Code work: DEFERRED until Phase 05 smoke test passes (tracked as task #153)
- Estimated effort: ~6 hours dev (CTA variants + routing + cohort tracking + analytics)

**Decision criteria for split test winner:**
- Minimum 200 signups across both cohorts before evaluation
- Measure: signup conversion rate, 7d-to-paid conversion, 30d churn
- If one variant wins by >20% margin on weighted score → ship 100% traffic to winner
- If margins within 20% → continue split, gather more data

**Backup plan if total signups <10/week after launch:**
Pivot signal — not a pricing problem. Issue is likely:
- Landing copy weak (revisit value prop)
- Traffic sources wrong (rethink ICP)
- Product onboarding broken (smoke test catches this)

Don't rebrand or rethink pricing until traffic sources prove healthy.

**Review date:**
- First measurement: Phase 06 launch + 30 days
- Decision review: Phase 06 launch + 60 days (need 200 signups baseline)

---

## CTA Copy — Split Test Variants (Locked 2026-05-17)

**Variant A (Free 7d cohort):**
- **EN:** "Try Sophia free for 7 days — no card required"
- **VN:** "Dùng thử Sophia miễn phí 7 ngày — không cần thẻ"

**Variant B ($1 trial cohort):**
- **EN:** "Start your $1 trial — full access for 7 days"
- **VN:** "Bắt đầu chỉ với $1 — truy cập toàn bộ trong 7 ngày"

Routing: 50/50 deterministic by user_id hash (sticky per session to prevent flicker).

---

## Reference Data

**Published SaaS benchmarks (2026):**
- Free trial → paid conversion: 5–20% (median 10%)
- Paid trial → paid conversion: 25–50% (median 40%)
- Trial users who become customers have 2x lower churn than free users

**Sophia assumptions (conservative estimates):**
- Signup flow friction: LOW (simple wizard)
- Product stickiness: HIGH (video results visible in 5 min)
- Customer LTV: $500–$2000/year (depends on volume/niche)
- CAC target: <$100 (to maintain 5:1 LTV:CAC ratio)

**Sample unit economics:**

| Model | Signups/mo | Conversion | Paying Customers | Monthly Revenue | CAC Payback |
|---|---|---|---|---|---|
| **Free 7d** | 100 | 10% | 10 | $600 (10 × $60) | 3 mo |
| **$1 Paid** | 60 | 40% | 24 | $1440 (24 × $60) | 1.5 mo |

(Assumes 60 signups/mo on paid trial, 100 on free trial due to friction)

---

**Decision due date:** Before Phase 06 Launch (smoke test completion)  
**Next step:** Update Hero CTA in pricing page + onboarding flow with your chosen copy  
**Measurement:** Track weekly conversion rate and adjust messaging if needed

