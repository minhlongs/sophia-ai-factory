# Phase 06 Launch GTM Plan — Execution Timeline

> **Master operator playbook for paid launch.** Sequences all prior artifacts into a runnable timeline.
> **Pairs with `phase-06-prep-checklist.md`** (gates) — that doc says WHEN ready; this doc says WHAT to execute.
> **Brand voice locked** per `brand-voice.md`. All copy aligns.

---

## Honest Pre-conditions

Don't start Phase 06 timeline until ALL these are TRUE:

1. ✅ Phase 05 smoke test passed (3 campaigns clean, IPN fires, no P0 incidents)
2. ✅ Split test infrastructure (#153) deployed (~6h dev work outstanding)
3. ✅ Email sequence infrastructure deployed (~4-6h dev work outstanding)
4. ✅ Articles #1 and #7 case studies filled with real customer data (depends on Phase 06 first acquisitions — chicken-and-egg, may launch with anonymized placeholder)
5. ✅ Operator budget locked ($500-2000 first-month ad spend per launch tier choice)
6. ✅ VN timezone coverage decided (operator handles or hires)

If any ✅ is missing → fix BEFORE T-30d. Don't compress.

---

## Timeline Overview

```
T-30d ──── T-21d ──── T-14d ──── T-7d ──── T-1d ──── T-0 ──── T+7d ──── T+30d
  │           │           │          │         │        │         │           │
  │           │           │          │         │        │         │           Decision gate
  │           │           │          │         │        │         Mid-launch review
  │           │           │          │         │        Launch day runbook
  │           │           │          │         Final ops check
  │           │           │          Soft launch (waitlist)
  │           │           Email infra deploy
  │           Content publishing starts
  Code work cutoff (#153 + email infra must be done)
```

---

## T-30d: Code Cutoff + Content Pipeline Start

**Goal:** All code shipped. Content distribution begins.

### Code work to complete BEFORE T-30d
- [ ] Split test infra (#153) — 2 hero variants, 50/50 routing, cohort cookie
- [ ] Email automation infra — cron + template renderer + send queue
- [ ] Cohort analytics (per-cohort conversion tracking)
- [ ] Dashboard view for split test results

### Content publishing schedule starts
- [ ] Publish Article #1 (TOFU) to `sophia.agencyos.network/blog/faceless-youtube-roi-2026`
- [ ] Publish Article #7 (BOFU) to `sophia.agencyos.network/blog/5-creators-real-revenue` — must publish BEFORE #1 since #1's CTA links to it
- [ ] Schedule Articles #2-10 at 1 per week cadence (operator drafts week-by-week)

### Distribution kickoff (per article)
- Twitter thread (8-12 tweets, 1 hook + condensed insights)
- LinkedIn long-form (1500 words, paste full article)
- Reddit (r/Entrepreneur, r/SideProject — case studies perform well, awareness posts get downvoted as self-promo)
- Email blast to existing waitlist (if exists)

### Operator daily commitment T-30 to T-7
- 30 min content drafting
- 30 min distribution + reply engagement
- 1 hour reviewing analytics on previous week's content

---

## T-21d: Email Infrastructure Live + Warm-up

**Goal:** Email sender warmed up so day-1 sends don't go to spam.

### Tasks
- [ ] Deploy email infra to production
- [ ] Send test emails to 5-10 friendly inboxes (yours + team + early supporters)
- [ ] Verify SPF/DKIM/DMARC records valid (`mxtoolbox.com` check)
- [ ] Warm-up sequence: send 10 emails/day → 50/day → 100/day across 14 days
- [ ] Monitor bounce rate (<2% target) + spam complaint rate (<0.1%)

### Operator action
- Set up dedicated `sender@sophia.agencyos.network` (NOT shared with personal email)
- Configure reply-to monitoring (operator's inbox or shared support)

---

## T-14d: Content Volume + SEO Indexing

**Goal:** Search engines index articles. Social proof builds.

### Tasks
- [ ] Articles #1, #7 indexed in Google Search Console (verify via `site:sophia.agencyos.network/blog`)
- [ ] At least 3 articles live (depending on cadence)
- [ ] Internal linking audit: all blog articles cross-link properly
- [ ] Sitemap submitted

### Targeted distribution
- [ ] DM 5 micro-influencers in target niche (personal finance, productivity, etc) — offer free Sophia month in exchange for honest review post
- [ ] Reach out to 3-5 podcasters — offer to be a guest discussing AI video automation
- [ ] LinkedIn comment engagement (15 min/day on competitor posts — add value, drop Sophia link contextually)

---

## T-7d: Soft Launch (Waitlist Activation)

**Goal:** Test funnel with low-volume signups.

### Tasks
- [ ] Open signup with waitlist gate (`/signup?source=waitlist`)
- [ ] Email waitlist contacts (50-200 people from pre-launch content)
- [ ] Cap signups at 50 to test infrastructure
- [ ] Monitor:
  - Signup → Setup Wizard completion rate (target >70%)
  - Setup Wizard → first campaign rate (target >80%)
  - First campaign → second campaign rate (target >60%)
  - Email open rate (target >40%)
  - Email click-through rate (target >10%)

### Operator first-customer support drill
- Use `customer-support-templates.md` for all real inquiries
- Log every interaction in support stats sheet
- Identify gaps: which templates needed? Which incidents recur?

### Kill criteria
- IF Setup Wizard completion <40% → block public launch, fix UX
- IF first campaign rate <50% → block, debug onboarding friction
- IF P0 incident occurs (5xx spike, payment failure) → fix root cause before public launch

---

## T-1d: Final Operations Check

**Goal:** Eliminate launch-day surprises.

### Checklist
- [ ] Production HTTP 200 sustained 24h (Cloudflare dashboard)
- [ ] D1 query p95 latency <500ms
- [ ] Worker CPU usage <50% (room to scale)
- [ ] All 4 BYOK provider services responsive (`/api/health` returns OK)
- [ ] Email infra: dry-run E1 sends successfully
- [ ] Telegram bot responsive to `/start`, `/campaign`
- [ ] NOWPayments production webhook URL verified (NOT sandbox)
- [ ] Refund process tested end-to-end (manual full refund to staging customer)
- [ ] Customer support inbox monitored (operator + 1 backup)
- [ ] Launch announcement copy ready (Twitter, LinkedIn, email, blog post)

### Rollback plan refresher
- Wrangler rollback command memorized: `npx wrangler rollback --name sophia-ai-factory --yes`
- Previous stable SHA noted (current shipped commit before T-0)
- Communication plan ready: "We're experiencing issues. Service paused while we fix. Updates at [status page or Twitter]"

---

## T-0: Launch Day Runbook

**Operator schedule (8am to 11pm local):**

### 08:00 — Pre-launch sweep
- [ ] Final HTTP 200 + SHA match check
- [ ] All BYOK providers green
- [ ] Email infra status green
- [ ] Caffeine acquired

### 09:00 — Public announcement
- [ ] Tweet launch thread (use locked CTA from split test)
- [ ] LinkedIn post (long-form, link to blog)
- [ ] Email blast to full waitlist
- [ ] Submit to: Product Hunt (if Friday), Hacker News (Show HN), Reddit (relevant subs)

### 10:00-14:00 — Monitor + engage
- Watch signup rate (per cohort A/B)
- Reply to every comment/DM within 30 min
- Watch Sentry/wrangler tail for errors
- Acknowledge first 10 customers personally (use T2/T6 templates if any questions)

### 14:00 — Mid-day check
- Signup count vs target
- Conversion: signup → wizard complete %
- Error count: should be <5
- Decide: pump more ads OR pause if concerning

### 18:00 — End-of-day push
- LinkedIn comment engagement (the algorithm picks up evening US activity)
- Twitter reply round-up
- Personal thank-you to top 5 customers of the day

### 22:00 — Wrap-up
- Stats screenshot for tomorrow's analysis
- Schedule overnight monitoring (wrangler tail in background OR Sentry alerts)
- 5-line journal: "What worked, what surprised me, what I'll change tomorrow"

---

## T+7d: First Week Review

**Decision gate:** Continue / Iterate / Pivot

### Metrics to evaluate

| Metric | Healthy | Concerning | Pivot signal |
|--------|---------|------------|--------------|
| Signups | 50+ | 20-49 | <20 |
| Wizard complete rate | >70% | 50-70% | <50% |
| First campaign rate | >80% | 60-80% | <60% |
| Day-7 retention | >50% | 30-50% | <30% |
| Cohort A (free) → wizard | >75% | 55-75% | <55% |
| Cohort B ($1) → wizard | >85% | 65-85% | <65% |
| Support inquiries / customer | <0.5 | 0.5-1.0 | >1.0 |
| P0/P1 incidents | 0 | 1-2 | 3+ |

### Decision paths
- **All Healthy:** Scale ad spend 2-3x, plan week 2-3 content
- **Mixed Healthy/Concerning:** Identify weakest funnel step → fix → recheck week 2
- **Multiple Concerning:** Pause ads, audit onboarding, fix top friction
- **Any Pivot Signal:** Stop ads, deep review, possibly pivot ICP or pricing

### Operator action
- [ ] Compile metrics into 1-page report
- [ ] Share with self / advisors / accountability partner
- [ ] Make explicit go/no-go decision for week 2
- [ ] Update `pricing-trial-decision-matrix.md` if cohort A vs B winner emerging early

---

## T+14d: Mid-launch Review

**Goal:** Cohort signal getting clearer.

### Tasks
- [ ] Compare cohort A vs B: conversion rate, retention, support load
- [ ] If split test has 100+ signups per cohort → consider preliminary winner
- [ ] If 200+ signups per cohort → DECLARE winner per pricing decision criteria
- [ ] Update content marketing focus based on which articles drove signups
- [ ] Customer interviews: contact 5 most active customers, gather quotes for Article #7 patch

### Article #7 case study filling
- Replace placeholder Section 6 customer data with real customer cases
- Patch Article #1 CTA per `article-07-five-creators-case-study.md` reconciliation notes
- Re-publish both articles

---

## T+30d: Phase 06 Wrap + Phase 07 Planning

**Goal:** Decision on what Phase 07 looks like.

### Metrics for Phase 07 planning

| Metric | Phase 06 result | Phase 07 implications |
|--------|-----------------|----------------------|
| Total signups | [N] | Marketing channel ROI ranking |
| Total paying customers | [M] | Revenue baseline + LTV calibration |
| MRR | $[X] | Burn rate sustainability check |
| Churn | [%] | Product stickiness signal |
| Top NPS driver | [feature] | Phase 07 dev priority |
| Top complaint | [issue] | Phase 07 fix priority |

### Phase 07 planning prompts
- What CAC / LTV ratio achieved? (Target 5:1)
- Which acquisition channel was 80% of signups?
- Should we hire VN timezone support?
- Add new tier (Master) or improve Growth?
- Scale content team or scale ad spend?

---

## Budget Allocation (Reference)

For Sophia first-month launch ($500-2000 range):

### Budget tier: $500/month (minimum viable)
- $0 paid ads (organic only)
- $0 tools (using existing)
- $200 founder time premium (commit equivalent of 20 hrs at $10/hr opportunity)
- $300 reserve for unexpected (cost overruns on BYOK, infra spikes)

**Realistic outcome:** 30-60 signups, 5-15 paying customers, $300-900 MRR start

### Budget tier: $1000/month (recommended)
- $400 paid ads (LinkedIn or Twitter, targeted at solo CEO ICP)
- $100 tools (analytics, email service, hosting overflow)
- $300 founder time premium
- $200 reserve

**Realistic outcome:** 80-150 signups, 15-30 paying customers, $900-1800 MRR start

### Budget tier: $2000/month (aggressive)
- $1000 paid ads (across 2-3 channels)
- $200 tools + analytics
- $200 1-on-1 customer interviews ($20-40 honorariums)
- $400 founder time premium
- $200 reserve

**Realistic outcome:** 200-400 signups, 40-80 paying customers, $2400-4800 MRR start

**No budget = no launch.** If operator can't commit minimum $500, defer Phase 06.

---

## Channel ROI Hypothesis (Operator Adjusts From Real Data)

| Channel | Expected CAC | Volume potential | Time investment | Priority |
|---------|-------------|------------------|-----------------|----------|
| Organic content (blog) | $0 (time only) | Slow build | High (30 min/day) | 🟢 Highest |
| Twitter threads | $0 | Medium | Medium | 🟢 High |
| LinkedIn long-form | $0 | High (B2B fit) | Medium | 🟢 High |
| Reddit case studies | $0 | Variable | Low (write + monitor) | 🟡 Medium |
| LinkedIn paid ads | $30-80 | Medium | Low ongoing | 🟡 Medium |
| Twitter paid ads | $20-50 | Medium | Low | 🟡 Medium |
| Podcast guesting | $0 | Slow but trust | High prep | 🟢 High (Phase 06+) |
| Influencer partnerships | $50-200 | Variable | Low ongoing | 🟡 Phase 07+ |
| Google ads | $50-200 | High volume | Medium | 🔴 Lowest (expensive for SaaS) |

**Operator rule:** Start with organic (high time, low cash). Add paid ads only after content baseline of 5+ articles published.

---

## Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Email infra fails launch day | LOW | HIGH | T-21d warm-up + T-1d dry-run |
| NOWPayments outage | LOW | HIGH | Manual tier grant scripts ready |
| BYOK provider mass quota issue | LOW | MEDIUM | T-1d health check + customer comm |
| Negative HN/Reddit reception | MEDIUM | MEDIUM | Don't post low-quality content; engage critics |
| Operator burnout | MEDIUM | HIGH | Strict 11pm cutoff + weekend pause |
| Zero signup day 1 | LOW | MEDIUM | Pre-launch waitlist warm-up |
| Spam complaints | LOW | MEDIUM | Warm-up + clean list + unsubscribe link |
| Customer demands refund T+1 | HIGH | LOW | T7/T8 templates + auto-refund flow |

---

## Reference Files (Order of Operator Read)

1. `phase-06-prep-checklist.md` — Pre-launch gates (READ FIRST)
2. `pricing-trial-decision-matrix.md` — Pricing locked (review)
3. `brand-voice.md` — Voice doctrine (review before each piece of copy)
4. `onboarding-email-sequence.md` — Proactive emails (schedule per cohort)
5. `customer-support-templates.md` — Reactive responses (operator memorizes T1-T11)
6. `handover-decision-tree.md` — When confused about commands
7. `incident-playbook.md` — When fires happen
8. **This doc** — Execution timeline

---

## Unresolved

1. **Code work outstanding** — split test #153 (~6h) + email infra (~4-6h) MUST land before T-30d. If not, slip timeline.
2. **Operator capacity** — Phase 06 demands 2-3 hours/day for 30+ days. Confirm operator can sustain OR shrink scope.
3. **VN timezone gap** — operator in PST. VN customers may message 12am-8am operator time. Decide: VN-language auto-responder OR hire VN support OR accept lag.
4. **Phase 06 SLA** — "reply within 4 hours" claim in support templates needs operator commitment OR template edit.
5. **Article #7 case study** — chicken-and-egg: needs real customers, but launching needs Article #7 published. Decide: launch with anonymized placeholder + patch post-launch, OR delay launch 4-6 weeks for real cases.
6. **Phase 07 trigger** — defined as "30 days post-launch OR $2k MRR achieved" — clarify which.
7. **Saturation note:** This is the 12th operator playbook doc. Marginal value diminishing fast. Future "next" requests should focus on EXECUTING this timeline, not adding more planning docs. Phase 06 launch needs OPERATOR ACTION not more Claude docs.
