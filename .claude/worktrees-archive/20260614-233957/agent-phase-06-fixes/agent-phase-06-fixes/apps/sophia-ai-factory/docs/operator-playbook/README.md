# Operator Playbook

Complete guide for Phase 05 (smoke test) through Phase 06 (paid launch).

## 📋 Documents in This Bundle

### 1. [Smoke Test Walkthrough](./smoke-test-walkthrough.md)
**Narrative step-by-step.** How to set up NOWPayments staging, enter API keys in Setup Wizard, run test campaigns, and verify everything works end-to-end. Bilingual (VN + EN).

**Use when:** You're executing smoke test (Phase 05). Follow in order, one section at a time. ~60–90 min hands-on.

---

### 2. [Blog Content Brief — 10 Articles](./blog-content-brief-10-articles.md)
**SEO content skeleton.** 10 article briefs (title, hook, outline, keyword, CTA) targeting your ICP (non-tech CEO).  
Mix of TOFU/MOFU/BOFU (awareness → consideration → decision).

**Use when:** You're planning content marketing for Phase 06 launch. Operator customizes tone, fills in case studies, publishes ~1 per week before launch.

---

### 3. [Pricing & Trial Decision Matrix](./pricing-trial-decision-matrix.md)
**Framework to choose trial model.** Free 7-day vs $1 paid trial: side-by-side comparison, sample CTAs, decision tree, unit economics.

**Use when:** You need to decide trial model BEFORE launch. Includes scoring worksheet. Outputs chosen CTA copy (bilingual VN + EN).

---

### 4. [Phase 06 Prep Checklist](./phase-06-prep-checklist.md)
**Pre-flight before paid launch.** 5 gates Phase 05 must pass (3 campaigns, 1 payment, 1 bot flow, Sentry <0.5%, operator confidence).  
Plus launch day runbook (T-2h to T+24h).

**Use when:** Phase 05 wraps up. Verify all gates ✅, run launch day checklist, rollback criteria if needed.

---

## 🚀 Typical Flow

```
Phase 05 (Smoke Test):
  [Start] 
    → Read Smoke Test Walkthrough (Doc 1)
    → Set up NOWPayments, run 3 test campaigns
    → Gather metrics (error rate, payment success, bot response time)
    → [Collect data from Phase 05]

Parallel: Prep Phase 06
  [Meanwhile]
    → Choose trial model (Doc 3)
    → Plan blog content (Doc 2)
    → Prep launch messaging + email sequences

Phase 06 (Paid Launch):
  [Week 2]
    → Verify 5 gates from Doc 4 ✅
    → Run launch day runbook
    → Monitor metrics T+1h and T+24h
    → Go/no-go decision

Post-Launch:
  → Scale ads if metrics green
  → Iterate on pricing/content if metrics yellow
```

---

## 💡 Quick Reference

| Situation | Document |
|---|---|
| "How do I run a test campaign?" | Smoke Test Walkthrough (Doc 1) |
| "What blog posts should I write?" | Blog Content Brief (Doc 2) |
| "Free trial or $1 paid?" | Pricing Matrix (Doc 3) |
| "Am I ready to launch?" | Phase 06 Prep Checklist (Doc 4) |
| "What went wrong at launch?" | Phase 06 Prep Checklist (rollback criteria) |

---

## ⚠️ Key Dependencies

- **Cloudflare account** — already have ✅
- **NOWPayments account** — create for smoke test (Doc 1, Section 1)
- **API keys** — OpenRouter, ElevenLabs, D-ID, HeyGen (Doc 1, Section 2)
- **Domain** — `https://sophia.agencyos.network` ✅
- **Telegram bot** — @Sophia_Bbot already configured ✅

---

## 📞 Support

- Questions about setup → Check Smoke Test Walkthrough troubleshooting section
- Questions about metrics → Check Phase 06 Prep Checklist "Data Signals Glossary"
- Questions about messaging → Check Pricing Matrix for CTA variants

---

**Phase 04 Completion Date:** 2026-05-17  
**Target Phase 05 Start:** 2026-05-18  
**Target Phase 06 Launch:** 2026-05-25–2026-05-31

