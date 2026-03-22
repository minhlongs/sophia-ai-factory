---
title: Affitor Affiliate-Skills — Integration Analysis for Sophia AI Factory
date: 2026-03-21
author: researcher
type: research-report
---

# Affitor Affiliate-Skills — Integration Analysis for Sophia AI Factory

## 1. What It Is

**Repo:** [github.com/Affitor/affiliate-skills](https://github.com/Affitor/affiliate-skills)
**License:** MIT
**Version:** checked 2026-03-21

**NOT what you might think.** This repo is NOT a plug-in affiliate/referral program module for SaaS apps. It is a collection of 45 AI agent skill files (Markdown) that teach an AI agent how to *do affiliate marketing as a content creator* — find programs, write blog reviews, build landing pages, track UTMs, automate distribution.

**Tech stack:** Pure Markdown skill files + `registry.json` index + REST API client to `list.affitor.com`. No TypeScript, no React, no DB. Skills run inside Claude Code / ChatGPT / Cursor as agent instructions. Companion platform is Affitor.com (SaaS) — AI-native affiliate network for B2B SaaS, 3.5% fee on conversions only, zero monthly cost.

**8 stages, 45 skills:**

| Stage | Count | Core purpose |
|---|---|---|
| S1 Research | 7 | Find + score programs via `list.affitor.com` API |
| S2 Content | 5 | Viral social posts (LinkedIn, X, Reddit, TikTok) |
| S3 Blog/SEO | 7 | Reviews, comparisons, keyword clusters |
| S4 Landing Pages | 7 | Pure HTML/CSS pages, AIDA framework |
| S5 Distribution | 5 | Bio-link deployer, email drip, GitHub Pages deploy |
| S6 Analytics | 5 | UTM tracking, A/B tests, SEO audit, performance reports |
| S7 Automation | 5 | Content repurposing, paid ad copy, multi-program mgmt |
| S8 Meta | 6 | Funnel planner, compliance checker, self-improver |

**Key API:** `GET https://list.affitor.com/api/v1/programs?q=...` — live program data (commission %, cookie days, reward type). Auth via Bearer token, 60 req/min authenticated.

---

## 2. Structure — Key Files

```
affiliate-skills/
├── skills/                   # 45 SKILL.md files, organized by stage
│   ├── research/
│   ├── content/
│   ├── blog/
│   ├── landing/
│   ├── analytics/conversion-tracker/SKILL.md  ← most relevant
│   └── automation/
├── registry.json             # Machine-readable skill index (39KB)
├── API.md                    # list.affitor.com API documentation
├── prompts/bootstrap.md      # Full agent bootstrap system prompt
├── SKILL.md                  # Template for creating new skills
├── template/SKILL.md         # Community contribution template
└── setup                     # CLI setup script
```

Each SKILL.md contains: trigger phrases, input/output YAML schema, step-by-step workflow, chaining metadata (`suggested_next`). Skills pass data through conversation context — no files, no DB needed.

---

## 3. Honest Assessment: What It Is vs. What Sophia Needs

### The gap

Sophia needs a **referral/affiliate program module** — i.e., in-app mechanics where:
- Agency A refers Agency B → Agency A earns commission
- Track conversions via Polar.sh webhooks
- Dashboard showing referral earnings, payouts
- Affiliate link generation per user

This repo provides **none of that**. It provides agent skills to help a *marketer* find and promote external affiliate programs. Completely different use case.

### What IS reusable

| Component | Reuse potential | Notes |
|---|---|---|
| `list.affitor.com` API | **Medium** | Sophia could use it to suggest HeyGen/other tool affiliate programs to agencies — upsell angle |
| `conversion-tracker` skill | **Low-medium** | UTM + tracking patterns applicable, but Sophia needs server-side not just UTM |
| Affitor.com **platform itself** | **HIGH** | List Sophia on Affitor as an affiliate program → agencies earn 20-40% recurring for referrals |
| SKILL.md template pattern | **Medium** | Sophia could build its own `sophia-affiliate-skills` package for agents |
| `funnel-planner` + `value-ladder-architect` | **Medium** | Pattern reusable for Sophia's proposal generation logic |

---

## 4. How Sophia Can Benefit

### Path A — List Sophia on Affitor.com (Fastest, 2-4 weeks)

Register Sophia as an affiliate program on `list.affitor.com`. Affitor connects 100K+ affiliates/creators. Sophia pays 3.5% platform fee, zero upfront.

**Setup needed:**
1. Connect Polar.sh via Affitor's Polar integration (webhook: `order.created`, `order.refunded`, `subscription.canceled`)
2. Set commission: recommend 20-30% recurring for 12 months (industry competitive for SEA agencies)
3. Affitor handles tracking, attribution, payouts

**Revenue math:**
- 10 active affiliates each refer 3 agencies/month at avg $299/mo = $8,970 MRR added
- At scale (100 affiliates): $89,700 MRR → contributes ~$1M ARR alone
- Affitor fee: 3.5% = $3,139/mo overhead vs. building in-house ($15-50K dev cost)

### Path B — In-App Referral Module (6-10 weeks dev)

Build native referral dashboard inside Sophia. Agencies get unique referral links, track conversions, see earnings.

**Tech integration:**
- Polar.sh webhook already in use → add metadata `referral_code` to checkout
- Supabase table: `referrals (id, referrer_id, referred_id, status, commission_amount, created_at)`
- Next.js API route: `/api/referrals/track` — validates cookie, stores attribution
- Dashboard page: referral stats, link generator, payout history

**Commission model recommendation:** 20% recurring, 12-month window, 60-day cookie

### Path C — Sophia as Affiliate (Immediate, 1 week)

Sophia promotes HeyGen, HubSpot, other tools it already integrates — earns commissions on referrals out of its user base.

- HeyGen: 30% recurring, 60-day cookie (already integrated in Sophia)
- HubSpot: varies, high ACV
- Use `affiliate-program-search` skill to find best programs matching Sophia's SEA audience

This is pure upside — Sophia's user base already uses these tools. Add affiliate links in onboarding/recommendation flows.

---

## 5. Directly Reusable Patterns from the Repo

| Pattern | Sophia adaptation |
|---|---|
| UTM tracking schema (`conversion-tracker/SKILL.md`) | Adapt for in-app referral attribution logic |
| `value-ladder-architect` — free→tripwire→core→upsell | Map to Sophia's MCU tiers: Free trial → $99 → $299 → $999 |
| `email-drip-sequence` skill structure | Referral onboarding email flow for new affiliates |
| `performance-report` output schema | Affiliate dashboard KPIs: clicks, conversions, earnings, payout |
| `compliance-checker` pattern | Disclosure requirements for Sophia's affiliate program terms |

**SKILL.md format:** Sophia could package its proposal generation logic as `sophia-skills` — distributable agent skills that market Sophia virally (each user's AI agent knows about Sophia).

---

## 6. Revenue Impact Model

```
                    $1M ARR Target ($83.3K MRR)

Current path:       Direct sales + SEA agencies
+ Path A (Affitor): +$10-90K MRR from affiliate channel (6-12 months to scale)
+ Path C (Sophia earns): +$2-8K MRR from outbound affiliate commissions
+ Path B (in-app):  Reduces churn (agencies with referral income stay longer)
                    NRR improvement: estimated +15-25% LTV

Recommendation:
  Month 1: Path A (Affitor listing) + Path C (Sophia earns commissions)
  Month 3: Path B (in-app referral dashboard)
  Total ARR contribution: $120-240K ARR by month 12
```

---

## 7. Adaptation Required

| Item | Effort | Notes |
|---|---|---|
| Register on Affitor.com | 1 day | No code, just setup |
| Polar.sh webhook for Path A | 2-3 days | Follow `polar.sh/docs/features/integrations/affonso` pattern |
| In-app referral module (Path B) | 4-6 weeks | Supabase schema + API route + Next.js dashboard |
| Sophia earns commissions (Path C) | 1 week | Add HeyGen/HubSpot affiliate links to existing integration flows |
| `sophia-skills` package (viral) | 2-3 weeks | Package proposal gen as distributable SKILL.md files |

---

## Sources

- [github.com/Affitor/affiliate-skills](https://github.com/Affitor/affiliate-skills) — MIT, 45 skills
- [affitor.com](https://affitor.com/) — Affitor platform, 3.5% fee model
- [polar.sh/docs/features/integrations/affonso](https://polar.sh/docs/features/integrations/affonso) — Polar+Affonso webhook setup
- [list.affitor.com](https://list.affitor.com/) — Program directory API

---

## Unresolved Questions

1. Does Sophia's current Polar.sh integration pass metadata to checkout? (Required for affiliate attribution — if not, ~1 day fix)
2. What is Sophia's current churn rate? Affects whether Path B (retention via referral income) is worth the 4-6 week investment vs. Path A (pure acquisition).
3. SEA-specific compliance: any regulations in target markets (PH, ID, VN, TH) around referral/commission programs that affect payout structure?
4. HeyGen affiliate program availability for SEA-based businesses — need to verify geo restrictions.
5. Is there budget/appetite to build `sophia-skills` package? High virality potential but requires sustained maintenance.
