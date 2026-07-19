# Phase 06 Prep Checklist — Smoke Test Signal Requirements

## What is Phase 06?

**VN:** Phase 06 = "Paid Launch" — bạn mở cửa cho khách hàng thực tế, chứ không phải test.

**EN:** Phase 06 = "Paid Launch" — you open doors to real customers, not test.

This checklist defines what signals Phase 05 (smoke test) MUST emit before Phase 06 can proceed. If Phase 05 doesn't generate these signals, Phase 06 is **blocked**.

---

## Phase 05 Output Signals Required (GATES)

### Gate G-1: ≥3 End-to-End Test Campaigns ✅ / ❌

**What it means:** A full campaign from URL creation → video generation → publish → tracking → metrics captured.

**How to verify:**
- [ ] Campaign 1: Completed, video live on YouTube/TikTok, link tracked
- [ ] Campaign 2: Completed, generated traffic, metrics logged
- [ ] Campaign 3: Completed, confirmed revenue flow (if applicable)

**If blocked:** Run 3 more campaigns from smoke walkthrough (Section 3)

**Why it matters:** Proves the entire chain works. If ANY step breaks (video gen, tracking, tier grant), Phase 06 will fail at scale.

---

### Gate G-2: ≥1 NOWPayments End-to-End Payment ✅ / ❌

**What it means:** Full payment journey: sign-up → NOWPayments checkout → payment cleared → tier upgrade confirmed.

**How to verify:**
- [ ] Signup created (email + wizard keys)
- [ ] NOWPayments checkout triggered (sandbox account)
- [ ] Payment confirmed in NOWPayments dashboard (status: "confirmed")
- [ ] Sophia tier upgraded (verified in dashboard or database)
- [ ] Email received (trial started or tier upgraded notification)

**If blocked:** Run payment test from smoke walkthrough (Section 1–4)

**Why it matters:** Proves payment → tier grant loop works. Without this, paying customers see blank dashboard.

---

### Gate G-3: ≥1 Telegram Bot End-to-End Flow ✅ / ❌

**What it means:** User triggers `/campaign` command via @Sophia_Bbot, receives result link within 5 minutes.

**How to verify:**
- [ ] Telegram bot connected to dashboard
- [ ] `/start` command responds (bot registered)
- [ ] `/campaign` command accepted, user sees options
- [ ] User selects video campaign option
- [ ] Bot generates video and sends link within 5 min
- [ ] No manual intervention required (full auto)

**If blocked:** Re-bind bot via `/start` and retry `/campaign`

**Why it matters:** Telegram is a key UX path. If bot is silent, users churn instantly.

---

### Gate G-4: Sentry Error Rate <0.5% Over 24h Window ✅ / ❌

**What it means:** Sentry dashboard shows <0.5 errors per 1000 requests for 24 continuous hours.

**How to verify:**
1. Open Sentry dashboard (`sentry.io/organizations/...`)
2. Go to Issues tab
3. Filter last 24h, count unique errors
4. Calculate: `total_errors / total_requests`
5. Check: is it <0.5%?

**If blocked:** 
- Review Sentry issues (group by frequency)
- Fix top 3 errors
- Run campaigns again to refresh 24h window
- Re-check Sentry

**Typical blockers:**
- "OpenRouter API timeout" → add retry logic or increase timeout
- "ElevenLabs 429 quota" → upgrade account or reduce parallelism
- "D-ID webhook timeout" → check IPN secret and retry

**Why it matters:** >0.5% error rate suggests systemic problem. Paying customers will see failures at scale.

---

### Gate G-5: Operator Confidence Score ✅ / ❌

**What it means:** Subjective: "Would YOU pay $60/mo to use Sophia for your own business?"

**How to evaluate:**
- Would you recommend to a friend? (YES / HESITANT / NO)
- Did any feature break or surprise you? (List them)
- Would you wait for a fix, or look for alternatives? (WAIT / ALT)
- Confidence level (1–10, 10 = launch tomorrow): ___

**If blocked:** Address top concerns before launch
- If UI confusing → improve onboarding UX
- If video quality low → test different HeyGen/D-ID settings
- If tracking broken → debug analytics flow

**Why it matters:** You're the first customer. If Phase 05 made you doubt, Phase 06 will be worse with 100 real customers.

---

## Pre-Launch Operational Checklist

### Infrastructure Swap (Staging → Production)

- [ ] **NOWPayments Account**
  - [ ] Created production account (not sandbox)
  - [ ] Received production API key
  - [ ] Updated `NOWPAYMENTS_API_KEY` env var
  - [ ] IPN secret updated + tested
  - [ ] Verified wallet address (USDT-TRC20)

- [ ] **Telegram Bot**
  - [ ] @Sophia_Bbot registered in production mode
  - [ ] Webhook URL points to production (`https://sophia.agencyos.network/api/telegram/webhook`)
  - [ ] Verified `/start` command works

- [ ] **Database**
  - [ ] D1 production database active
  - [ ] All migrations applied (`npm run deploy:migrations`)
  - [ ] Backup procedure documented (see `sophia-no-tech-doctrine.md`)

### Marketing & Positioning

- [ ] **Pricing Page**
  - [ ] Trial model finalized (free-7d OR $1-paid, see `pricing-trial-decision-matrix.md`)
  - [ ] CTA copy matches chosen model
  - [ ] Pricing tiers clearly labeled ($30 / $60 / $100)
  - [ ] FAQ updated with common Q&A

- [ ] **Blog Content**
  - [ ] ≥3 articles published (recommend Articles 1, 3, 4 from `blog-content-brief-10-articles.md`)
  - [ ] Links to onboarding working
  - [ ] SEO basics in place (meta tags, H1, alt text)

- [ ] **Email Onboarding Sequence**
  - [ ] Welcome email drafted (user gets after signup)
  - [ ] Day 6 email drafted (trial-ending upsell)
  - [ ] Post-payment confirmation email drafted

### Technical & Monitoring

- [ ] **Deploy Verification**
  - [ ] Production code deployed via `npm run deploy:full`
  - [ ] SHA matches commit (verify via `/api/version`)
  - [ ] HTTP 200 confirmed
  - [ ] Migrations applied if needed

- [ ] **Sentry**
  - [ ] Production Sentry project created
  - [ ] Auth token set for source map upload (optional, but recommended)
  - [ ] Alert threshold configured (notify if error rate >1%)

- [ ] **Cloudflare**
  - [ ] WAF rules enabled (DDoS + bot protection)
  - [ ] Rate limiting configured (e.g., 100 req/min per IP)
  - [ ] Cache rules reviewed (ensure `/api/` routes bypass cache)

---

## Launch Day Runbook

### T-2 hours: Final Smoke Test on Production

```
1. Open https://sophia.agencyos.network
2. Create a test account with production NOWPayments key
3. Run 1 campaign (video:create)
4. Verify payment flow completes
5. Check Sentry for errors (should be 0)
6. Confirm email received
```

### T-1 hour: Operator on Standby

- [ ] Sentry dashboard open (watch error rate)
- [ ] Telegram open (ready to respond to user questions)
- [ ] Analytics dashboard ready (track signups in real-time)
- [ ] Slack/Discord channel for support (if you have team)

### T-0: Launch

- [ ] Tweet / Email blast with onboarding link
- [ ] Post on relevant communities (Reddit, Facebook groups, etc.)
- [ ] Set tweet to pin for 24h
- [ ] Update LinkedIn status

### T+1 hour: First Hour Metrics Check

| Metric | Expected | Actual | Status |
|---|---|---|---|
| Signups | 5–10 | ___ | ✅ / ❌ |
| Conversions to paid | 1–3 | ___ | ✅ / ❌ |
| Sentry errors | <2 | ___ | ✅ / ❌ |
| Telegram bot responses | 100% | ___ | ✅ / ❌ |

**If any metric misses:**
- Signups low → boost social post
- Conversions low → check payment flow (NOWPayments down?)
- Errors high → check Sentry, apply hotfix if needed
- Bot silent → verify bot token + webhook

### T+24 hours: 24-Hour Metrics Review

| Metric | Target | Actual | Go/No-Go |
|---|---|---|---|
| Signups | 20+ | ___ | ✅ / ❌ |
| Trial-to-paid conversion | 10%+ | ___ | ✅ / ❌ |
| Sentry error rate | <0.5% | ___ | ✅ / ❌ |
| Support tickets | <5 | ___ | ✅ / ❌ |
| Revenue captured | $50+ | ___ | ✅ / ❌ |

**Decision framework:**
- ✅ All green → **Continue scaling:** increase ad spend, promote more aggressively
- ⚠️ 1–2 yellow → **Investigate:** fix issue, continue monitoring
- ❌ 2+ red → **Pause growth:** stop ads, fix root cause, re-launch later

---

## Rollback Criteria (When to STOP)

### Immediate Rollback (kill switch)

❌ **Sentry error rate >5% in first hour**
- Action: Freeze all new signups (disable signup button)
- Halt ads immediately
- Debug top 3 errors
- Hotfix + re-deploy
- Re-enable signups when error rate <0.5%

❌ **NOWPayments IPN fail rate >10%**
- Action: Switch to manual tier-grant mode (operator grants tiers manually)
- Email customers: "We're processing payments manually, you'll get access within 1 hour"
- Contact NOWPayments support (webhook timeout?)
- Parallel: set up fallback payment provider (Stripe?)

❌ **Telegram bot unresponsive (>50% of `/campaign` calls timeout)**
- Action: Post-mortem — is it bot token issue? Webhook endpoint down?
- Rollback bot to prior known-good version
- Debug connectivity

### Pause Growth (but keep platform running)

⚠️ **Support volume >10 tickets/hour (solo operator)**
- Action: Pause ad spend + organic growth
- Batch process support queue (respond to all in 1h block)
- Reduce signup velocity so you can handle it
- Hire support help or post FAQ before resuming

⚠️ **Churn rate >50% in first 7 days**
- Action: Investigate "why are customers leaving?"
- Email exit survey: "Why didn't you continue?"
- Common reasons: unclear onboarding, slow video generation, poor video quality
- Fix, then re-launch with improvements

---

## Data Signals Glossary

| Signal | How to Measure | Pass Threshold | Fail Threshold |
|---|---|---|---|
| **Signup completion rate** | (finished_wizard / total_visits) | >5% | <2% |
| **Trial-to-paid conversion** | (paid_customers / trial_signups) | >10% | <5% |
| **Campaign success rate** | (completed_videos / initiated) | >80% | <60% |
| **Sentry error rate** | (errors_24h / total_requests) | <0.5% | >2% |
| **Payment success rate** | (confirmed_payments / checkout_initiated) | >95% | <80% |
| **Telegram bot response time** | median time to video link | <5 min | >10 min |
| **Email delivery rate** | (delivered / sent) | >95% | <90% |
| **Support response time** | operator average reply time | <1 hour | >4 hours |

---

## Doctrine Check (Phase 05 → Phase 06 Gate)

Before moving to Phase 06, confirm:

- [ ] No new operator-side infrastructure added (e.g., no Upstash cron, no Sentry auth token required)
- [ ] All customer data entry via Setup Wizard (BYOK — bring your own keys)
- [ ] Platform is fully self-service (no operator action needed for customer success)
- [ ] Documentation matches reality (if docs say "auto," it's actually auto, not manual)

**If you added operator-side work:**
- [ ] Document it clearly in `sophia-no-tech-doctrine.md` (update the doctrine)
- [ ] Assign an operator to own it (on-call)
- [ ] Ensure it doesn't block customer experience (fail gracefully)

See `sophia-no-tech-doctrine.md` for full doctrine details.

---

## Sign-Off Template

**Phase 05 Smoke Test Results:**

```
Date: [YYYY-MM-DD]
Operator: [Name]

GATE RESULTS:
- G-1 (3 campaigns): ✅ / ❌
- G-2 (1 payment): ✅ / ❌
- G-3 (1 bot flow): ✅ / ❌
- G-4 (Sentry <0.5%): ✅ / ❌ (actual: _%)
- G-5 (Operator confidence): ✅ / ❌ (score: __/10)

BLOCKERS FOUND: [List any issues]

FIXES APPLIED: [List any hotfixes]

READY FOR PHASE 06: YES / NO

IF NO, reason: [Explain]

Signed: _________________________ Date: __________
```

---

## Next Steps (Post Phase 06 Launch)

1. **Week 1:** Monitor daily signups + conversion rate
2. **Week 2:** Analyze blog traffic + traffic source attribution
3. **Week 3:** Gather customer feedback (email survey: "What do you love about Sophia?")
4. **Week 4:** Decide: scale ad spend, or pivot positioning based on learnings

---

**Phase 06 is GO when all 5 gates are PASSING and operator is confident.**  
**Estimated readiness:** Within 1–2 weeks of Phase 05 start date.  
**Escalation:** If any gate blocks >3 days, escalate for tech review + hotfix prioritization.

