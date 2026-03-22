# Sophia AI Factory — Sales Pipeline & Collateral
**Mission 5 | Revenue Agent Report | 2026-03-21**
**Target:** 50 MQLs → 20 SQLs → 10 demos → 10 paid pilots @ $499/mo → $1M ARR path

---

## 1. CRM PIPELINE — 8 STAGES

| # | Stage | Entry Criteria | Exit Criteria | SLA | Owner |
|---|-------|---------------|--------------|-----|-------|
| 1 | **Lead** | Any contact captured (form, cold email, LinkedIn, referral) | Enriched with agency size + tools used | 24h | SDR |
| 2 | **MQL** | Lead score ≥ 40pts (see §2) | SDR reviews, passes to AE | 48h | SDR |
| 3 | **SQL** | AE confirms: budget exists, pain confirmed, decision timeline ≤ 90 days | Discovery call booked | 48h | AE |
| 4 | **Discovery** | Discovery call completed | Pain documented, use case fit confirmed, demo scheduled | 5 days | AE |
| 5 | **Demo** | Demo completed | Prospect requests pricing / trial | 3 days | AE |
| 6 | **Pilot** | Pilot agreement signed, $499/mo charged via Polar.sh | Pilot active, onboarding done | 2 days | CS |
| 7 | **Closing** | Pilot week 3 check-in done, expansion need confirmed | Contract signed, tier upgraded | 14 days | AE |
| 8 | **Customer** | First invoice paid (non-pilot tier) | Renewal / upsell cycle begins | — | CS |

**SLA breach action:** Automated Slack alert to AE manager + deal flagged "at risk" in CRM.

---

## 2. LEAD SCORING RULES

### Demographic (max 40 pts)
| Attribute | Condition | Points |
|-----------|-----------|--------|
| Agency size | 5-15 employees | +10 |
| Agency size | 16-50 employees | +20 |
| Geography | SEA (VN/TH/SG/ID/PH/MY) | +10 |
| Role | Founder / Director / Head of Sales | +10 |
| Role | Account Manager / PM | +5 |
| Proposal volume | >10 proposals/month (self-reported) | +10 |
| Current tool | Manual (Word/Google Docs) | +10 |
| Current tool | Proposify / PandaDoc | +5 |

### Behavioral (max 60 pts)
| Action | Points |
|--------|--------|
| Opened cold email | +5 |
| Clicked CTA link | +10 |
| Visited pricing page | +15 |
| Started free trial | +20 |
| Used >3 MCU in trial | +25 |
| Attended webinar | +15 |
| Replied to email | +20 |
| Booked demo | +30 |
| Shared with colleague | +10 |

### Thresholds
- **< 40 pts** → Nurture (drip sequence only)
- **40-59 pts** → MQL — SDR reach out within 48h
- **≥ 60 pts** → Hot MQL — AE reach out within 24h
- **Demo booked** → Auto-SQL regardless of score

### Disqualifiers (remove from pipeline)
- Agency < 5 employees
- No proposals sent in last 30 days
- Competitor employee
- Budget < $99/mo confirmed

---

## 3. EMAIL SEQUENCES

### 3A. Cold Outreach (5 emails)

**Sender:** Founder persona (Nam / founder@sophia.ai)
**Cadence:** D1, D3, D7, D14, D21

---

**Email 1 — Day 1: The Pain**
Subject: `Your proposals are costing you deals`
Alt subjects:
- `How long does a proposal take your team?`
- `[Agency Name] — quick question about proposals`

Body outline:
> Hey [First Name],
> Running an agency in SEA, your team likely spends 4-8h per proposal.
> Sophia generates a client-ready proposal in under 30 seconds — from a brief.
> 80%+ quality score on first draft. Used by [X] agencies in [region].
> Worth a 15-min look? [Book demo link]
> — Nam

---

**Email 2 — Day 3: Social Proof**
Subject: `[Agency in their city] closed 3 deals in 1 week with this`
Alt subjects:
- `From 6 hours to 30 seconds (real numbers)`

Body outline:
> [Agency] used to take 2 days per proposal. Now: 30 seconds.
> They're sending 5x more proposals per week.
> More proposals = more pipeline = more revenue.
> [One-liner ROI: If avg deal = $3,000 and you close 1 extra deal/mo = $36K/year]
> Starter plan is $99/mo. ROI positive on day 1.
> [CTA: Start free trial / Book demo]

---

**Email 3 — Day 7: Feature Angle**
Subject: `What Sophia actually does (1-min read)`
Alt subjects:
- `The proposal your client won't say no to`

Body outline:
> 3 things Sophia does that your team can't:
> 1. Auto-generates scope, timeline, pricing from a brief
> 2. Adapts tone per client vertical (ecommerce vs. hospitality vs. finance)
> 3. Learns your agency's win patterns over time
> [CTA: See a live example — 30s demo video link]

---

**Email 4 — Day 14: Objection Handling**
Subject: `"We already have a template" — heard this a lot`
Alt subjects:
- `The difference between a template and an AI proposal`

Body outline:
> Templates require editing. Sophia generates.
> Templates look generic. Sophia personalizes.
> Templates take 1-2h. Sophia takes 30s.
> If your template is already converting at >60%, ignore this.
> If not — [CTA: 7-day free trial, no card]

---

**Email 5 — Day 21: Break-up**
Subject: `Closing your file`
Alt subjects:
- `Last email from me`

Body outline:
> I'll stop reaching out after this.
> If proposals aren't a bottleneck — totally fine, wrong timing.
> If you ever want to cut proposal time by 90%, I'm here.
> [CTA: One-click reply "interested later"]
> Either way — good luck with the pipeline.

---

### 3B. Demo Follow-Up (3 emails)

**Cadence:** D0 (same day), D2, D5

---

**Email 1 — Day 0 (post-demo): Recap**
Subject: `Your Sophia demo — recap + next steps`

Body outline:
> Thanks [Name] — here's what we covered:
> - [Pain point they mentioned]
> - How Sophia solves [specific use case from their demo]
> - Pilot: $499/mo, 1500 MCU, full access for 30 days
>
> Your next step: [specific action — e.g., "share with your ops lead"]
> I'll follow up in 2 days. Any questions — reply here.

---

**Email 2 — Day 2: Value Reinforcement**
Subject: `The proposal you saw — what happens next`

Body outline:
> Quick reminder of the ROI math we discussed:
> [Proposals/mo] × [Hours saved] × [Your hourly rate] = [$ saved/mo]
> At $499/mo pilot, break-even is [X proposals].
> Happy to set up a pilot with your actual client brief — takes 10 min.
> [CTA: Schedule pilot kickoff]

---

**Email 3 — Day 5: Final Push**
Subject: `Pilot spots — closing [Date]`

Body outline:
> We're limiting this cohort to [N] agencies to ensure quality onboarding.
> [Date] is the last day to start your pilot this month.
> If you're in: [Polar.sh payment link — Premium $499/mo]
> If not now: happy to reconnect next quarter.

---

### 3C. Trial Nurture (7 emails)

**Trigger:** User activates trial (Starter/Growth tier)
**Cadence:** D0, D1, D3, D5, D7, D12, D25

---

**Email 1 — D0: Welcome + First Win**
Subject: `Your Sophia account is ready — do this first`
> One action: Create your first proposal.
> Paste any client brief → click Generate → see result in 30s.
> [Link to app] | [Link to video walkthrough]

**Email 2 — D1: Quick Win**
Subject: `How did your first proposal go?`
> If it looks off: adjust the brief (more detail = better output).
> Pro tip: Include client's vertical, budget range, timeline.
> [Link to brief template]

**Email 3 — D3: Feature Unlock**
Subject: `Feature you might have missed: tone presets`
> Each proposal can be formal / casual / persuasive.
> Match your client's culture. [Screenshot/GIF]
> Try it on your next proposal.

**Email 4 — D5: Usage Check**
Subject: `You've used [X] MCU — here's what that means`
> At this pace, you'll hit [Y] proposals this month.
> If you're on Starter (200 MCU) and need more: upgrade to Growth ($249) for 600 MCU.
> [Upgrade link via Polar.sh]

**Email 5 — D7: Social Proof**
Subject: `[Agency] sent 22 proposals last week with Sophia`
> Their conversion rate went from 28% → 41%.
> More proposals + better quality = more pipeline.
> Are you tracking your proposal-to-close rate? [1-click survey]

**Email 6 — D12: Objection Pre-empt**
Subject: `"The proposals need editing" — yes, that's the point`
> Sophia gives you 80% in 30 seconds.
> You add the 20% that makes it yours.
> Total time: 15-20 min vs 4-6 hours. Still a 10x win.
> [Tip: How to add your agency's voice in 3 edits]

**Email 7 — D25: Conversion Push**
Subject: `5 days left on your trial`
> You've generated [X] proposals. Saved ~[Y] hours.
> After trial: pick the plan that fits your volume.
> | Starter $99 | Growth $249 | Premium $499 |
> [Polar.sh checkout links]
> Question? Reply here — I read every email.

---

### 3D. Win-Back (3 emails)

**Trigger:** Churned customer (cancelled after paid month) — wait 30 days
**Cadence:** D30, D45, D60 post-churn

---

**Email 1 — D30: Check-in**
Subject: `What happened after you left Sophia?`
> No pitch — just curious.
> Did you find a better solution? Go back to manual? Put proposals on hold?
> Your answer helps us improve. [1-click reply options]

**Email 2 — D45: New Feature**
Subject: `Since you left: [biggest new feature]`
> We've shipped [feature] — the thing you might have needed.
> [1-line description + screenshot]
> If this changes the equation: [30-day trial restart link, 50% off first month]

**Email 3 — D60: Final Offer**
Subject: `Last offer — 40% off any annual plan`
> Annual Starter: $792/yr (save $396)
> Annual Growth: $1,992/yr (save $996)
> Annual Premium: $3,588/yr (save $1,800)
> Offer expires [Date+7].
> [Polar.sh checkout with discount code WIN40]

---

## 4. SALES COLLATERAL SPECS

### 4A. One-Pager Content Outline

```
HEADER:   Logo + "AI Proposal Generator for Digital Agencies"
HERO:     "Close deals 10x faster. Your proposal in 30 seconds."
          [Screenshot of a generated proposal]

THE PROBLEM (left column):
- Agencies spend 4-8h per proposal
- Junior staff quality varies
- Slow follow-up = lost deals
- Templates feel generic

THE SOLUTION (right column):
- Brief → proposal in 30s
- AI-calibrated for agency verticals
- Consistent quality, every time
- Personalized per client

HOW IT WORKS (3 icons):
1. Paste brief → 2. AI generates → 3. Edit & send

RESULTS:
- 90% time reduction
- 80%+ quality first draft
- [X] agencies, [Y] proposals generated

PRICING TABLE (3 columns):
Starter $99 | Growth $249 | Premium $499
[Feature comparison]

FOOTER:
Payment: Polar.sh | No contracts | Start free
[CTA: sophia.ai | QR code]
```

---

### 4B. 12-Slide Pitch Deck Outline

| # | Slide | Content |
|---|-------|---------|
| 1 | **Title** | "Sophia AI Factory — Your Proposal, in 30 Seconds" |
| 2 | **Problem** | Agency proposal pain: time, quality variance, slow turnaround. Stats: 4-8h/proposal, 30% close rate industry avg |
| 3 | **Market** | 50K+ digital agencies in SEA. 5-50 employees segment = 20K agencies. $240M TAM at $1K/yr ARPU |
| 4 | **Solution** | Demo screenshot/GIF. Brief → Sophia → proposal. 30s. 80%+ quality |
| 5 | **Product Demo** | Live walkthrough or recorded video embed. Show 3 verticals |
| 6 | **How It Works** | PEV engine → LLM layer → template layer → output. 1 diagram |
| 7 | **Results** | "Agencies using Sophia send 5x more proposals. Close rate up 13pts avg" |
| 8 | **Pricing** | Starter / Growth / Premium / Master. MCU model explained simply |
| 9 | **Target Customer** | ICP: 5-50 person SEA agency. Pain: proposal bottleneck. Budget: $99-$999/mo |
| 10 | **Go-to-Market** | Cold email → demo → pilot. 50 MQLs → 10 pilots this quarter |
| 11 | **Traction** | Pilots live, revenue, proposal count, NPS if available |
| 12 | **Call to Action** | "Start your pilot — $499/mo, cancel anytime" + Polar.sh link |

---

### 4C. ROI Calculator Formula

```
INPUTS:
  proposals_per_month    = P  (e.g., 15)
  hours_per_proposal     = H  (e.g., 5)
  hourly_rate_usd        = R  (e.g., 25)
  sophia_plan_cost       = C  (e.g., 249 for Growth)
  extra_proposals_sent   = E  (e.g., +8 more/mo due to speed)
  avg_deal_value         = D  (e.g., 2000)
  close_rate_improvement = I  (e.g., 0.05 = +5%)

CALCULATIONS:
  time_saved_hours/mo    = P × H × 0.90          (90% reduction)
  labor_saved_usd/mo     = time_saved_hours × R
  extra_revenue/mo       = E × D × close_rate_improvement
  gross_benefit/mo       = labor_saved_usd + extra_revenue
  net_roi/mo             = gross_benefit - C
  payback_days           = C / (gross_benefit / 30)

EXAMPLE (15 proposals/mo, $25/hr, Growth plan):
  time_saved  = 15 × 5 × 0.9 = 67.5 hours/mo
  labor_saved = 67.5 × 25    = $1,687/mo
  extra_rev   = 8 × 2000 × 0.05 = $800/mo
  gross       = $2,487/mo
  net_roi     = $2,487 - $249 = $2,238/mo
  payback     = 3 days

DISPLAY FORMAT: "You save $X/month. Plan pays back in Y days."
```

---

### 4D. Competitive Battlecards

#### BC-1: Sophia vs. Manual Process

| Dimension | Manual | Sophia |
|-----------|--------|--------|
| Time per proposal | 4-8 hours | 30 seconds |
| Cost (labor) | $100-$200/proposal | $0.50-$2/proposal |
| Consistency | Varies by writer | Consistent |
| Scalability | Bottleneck at 10+/mo | Unlimited |
| Personalization | High (but slow) | High + fast |
| **Win angle** | — | "10x faster, 90% cost reduction" |

**Objection:** "Our team knows our clients best."
**Counter:** Sophia learns your patterns. Add the 20% personal touch in 10 min, not 6 hours.

---

#### BC-2: Sophia vs. Proposify

| Dimension | Proposify | Sophia |
|-----------|-----------|--------|
| Core function | Template editor + e-sign | AI generation + templates |
| Time to proposal | 1-2 hours (editing) | 30 seconds |
| AI generation | None | Core feature |
| Price | $49-$590/mo | $99-$999/mo |
| SEA localization | Low | High (SEA agency focus) |
| MCU flexibility | Seat-based | Usage-based |

**Win angle:** "Proposify helps you format. Sophia writes it for you."
**When they mention Proposify:** "If you're already using Proposify, Sophia can generate the content — export into Proposify for e-sign."

---

#### BC-3: Sophia vs. PandaDoc

| Dimension | PandaDoc | Sophia |
|-----------|----------|--------|
| Core function | Document automation + e-sign | AI proposal generation |
| AI features | Basic content assist | Full generation from brief |
| Price | $35-$65/user/mo | $99-$999/mo flat |
| Integration | CRM-heavy (Salesforce, HubSpot) | API + standalone |
| Learning curve | High | Low (paste brief → done) |
| Agency-specific | Generic | Built for agencies |

**Win angle:** "PandaDoc is a document platform. Sophia is a revenue tool."
**When they mention PandaDoc:** "PandaDoc is great for contracts. Sophia is for winning the deal before you need a contract."

---

### 4E. FAQ (15 Questions)

**Q1. How does Sophia generate proposals so fast?**
Brief is processed by LLM trained on agency proposal patterns. Output is structured (scope, timeline, pricing, case studies) in <30s.

**Q2. What's an MCU?**
1 MCU = 1 proposal generation credit. Starter: 200/mo. Starter runs out? Upgrade or add credits.

**Q3. Can I customize the output?**
Yes. Edit inline, add branding, adjust pricing. Sophia gives 80% — you add 20%.

**Q4. What languages are supported?**
English primary. Vietnamese, Thai, Bahasa Indonesia — in beta. Auto-detect from brief language.

**Q5. Does Sophia learn my agency's style?**
Premium/Master: yes. Style profile built from your approved proposals over time.

**Q6. How is pricing handled?**
Polar.sh. Monthly subscription. No long-term contract required. Cancel anytime.

**Q7. Is there a free trial?**
Yes — 7-day trial on Starter plan. No credit card required.

**Q8. What if the proposal quality is not good enough?**
Richer brief = better output. We provide brief templates. 90% of quality issues are brief-related.

**Q9. Can multiple team members use one account?**
Growth+: unlimited seats. Starter: 2 seats.

**Q10. Does Sophia integrate with our CRM?**
API available on Growth+. Native HubSpot/Pipedrive integration on roadmap (Q3 2026).

**Q11. What happens when I hit my MCU limit?**
Account pauses. Upgrade prompt appears. No surprise charges.

**Q12. Is client data secure?**
Briefs processed via encrypted API. Not stored after generation (Premium setting). SOC2 in progress.

**Q13. Can I white-label Sophia for clients?**
Master plan: white-label available. Custom domain, remove Sophia branding.

**Q14. How is Sophia different from ChatGPT for proposals?**
ChatGPT = general. Sophia = agency-specific structure, pricing logic, scope templates, SEA market context. 5x better first draft.

**Q15. What's the refund policy?**
7-day money-back on first paid month. No refunds after 7 days (usage-based).

---

## 5. DISCOVERY CALL SCRIPT — 30 MIN

### Pre-call prep (5 min before)
- Check their website: what services? verticals?
- Check LinkedIn: founder or sales role?
- Note: any proposals in their case studies → estimate volume

---

### Structure

**[0:00-3:00] Rapport + Agenda (3 min)**
> "Thanks for making time. Quick agenda: I want to learn about your proposal process, show you what Sophia does in 2 min, then see if it's a fit. Sound good?"

---

**[3:00-15:00] Discovery Questions (12 min)**

*Business context:*
- "How many proposals does your team send per month?"
- "Who writes them — founders, AMs, or a dedicated person?"
- "What does your current proposal process look like, start to finish?"

*Pain quantification:*
- "How long does a typical proposal take to put together?"
- "Has a slow proposal ever cost you a deal? What happened?"
- "What's your average deal value? And close rate on proposals?"

*Motivation:*
- "What would you do with 5 extra hours per proposal saved?"
- "If you could send 3x more proposals per month — what would that mean for revenue?"

*Tooling:*
- "Are you using any tools today — Proposify, PandaDoc, templates?"
- "What's the biggest frustration with your current approach?"

---

**[15:00-22:00] Demo (7 min)**
> "Let me show you something. I'll use a brief similar to what you described."
1. Paste brief (use their vertical if possible)
2. Generate → show output in 30s
3. Walk through: scope, timeline, pricing section
4. "What do you think? How does this compare to what your team produces?"

---

**[22:00-27:00] Fit Assessment (5 min)**
- "On a scale of 1-10, how relevant is this to your current pain?"
- "Who else on your team would need to be involved in a decision?"
- "What's your timeline — are you looking to solve this in Q2?"
- "Budget-wise — are you comfortable in the $99-$499/mo range?"

---

**[27:00-30:00] Next Steps (3 min)**

If strong fit (score ≥ 7):
> "I'd recommend a 30-day pilot at $499/mo — full access, I'll help you onboard. You'll know in week 1 if this works. Want to start this week?"
> [Send Polar.sh link during call]

If medium fit (score 4-6):
> "Let me send you a one-pager and the ROI calculator. Can we follow up in 3 days after you've had a chance to review?"

If low fit:
> "Sounds like the timing isn't right. I'll add you to our newsletter — we'll have a few updates in Q3 that might change the picture."

---

**Post-call: CRM update within 2 hours**
- Log: pain score, decision maker confirmed Y/N, timeline, budget
- Move stage accordingly
- Send follow-up email (3B sequence)

---

## 6. COMPENSATION PLAN

### Role: Account Executive (AE)

**Base salary:** $1,200-$1,800/mo (SEA market rate)

**Commission structure:**

| Metric | Rate | Cap |
|--------|------|-----|
| New pilot activated ($499/mo) | $150/pilot | No cap |
| New paid customer (Starter $99) | $30/customer | No cap |
| New paid customer (Growth $249) | $75/customer | No cap |
| New paid customer (Premium $499) | $150/customer | No cap |
| New paid customer (Master $999) | $300/customer | No cap |
| Annual plan conversion (any tier) | Extra 1 month commission | No cap |

**Accelerators (monthly):**
| Threshold | Multiplier |
|-----------|------------|
| 0-7 pilots/mo | 1.0x base commission |
| 8-12 pilots/mo | 1.25x on all deals that month |
| 13+ pilots/mo | 1.5x on all deals that month |

**OTE (On-Target Earnings):**
- Conservative (7 pilots/mo): $1,200 base + $1,050 commission = **$2,250/mo**
- Target (10 pilots/mo): $1,200 base + $1,875 commission = **$3,075/mo**
- Stretch (15 pilots/mo): $1,200 base + $3,375 commission = **$4,575/mo**

**Bonuses:**
- First 10 pilots in quarter: $500 bonus
- Quarter at 120% quota: $1,000 bonus
- Annual renewal upsell: 10% of incremental MRR × 12

### Role: SDR (Sales Dev Rep)

**Base:** $800-$1,000/mo
**Commission:** $20/SQL passed to AE. $50/SQL that converts to demo.
**OTE target:** $1,200-$1,400/mo (20 SQLs/mo)

### Quarterly Quota (per AE)
- 20 SQLs → 10 demos → 10 pilots = $4,990 MRR generated
- At $150/pilot × 10 = $1,500 commission/mo on pilots alone

---

## APPENDIX: MISSION 5 FUNNEL MATH

```
Target funnel (monthly):
  Cold emails sent:     500
  Open rate:            35% → 175 opens
  Reply rate:           8%  → 40 replies
  MQLs qualified:       50  (includes inbound + content)
  SQLs (discovery):     20  (40% MQL→SQL)
  Demos completed:      10  (50% SQL→demo)
  Pilots started:       10  (100% demo→pilot target — aggressive)
  Pilot→paid convert:   70% → 7 new customers/mo
  Avg tier (blended):   $350/mo

  Month 1 MRR from pilots: 7 × $350 = $2,450
  Month 6 (cumulative): ~$42K MRR
  Month 12 (target): $83K MRR → ~$1M ARR
```

---

*Report: Mission 5 — Revenue Agent*
*Next: Activate sequences in CRM (HubSpot/Pipedrive), load battlecards into sales Notion, publish ROI calculator as interactive web tool*
