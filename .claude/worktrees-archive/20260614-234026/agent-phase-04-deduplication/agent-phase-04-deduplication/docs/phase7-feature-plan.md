# Phase 7: New Features — Feature Plan

**Ngày:** 2026-06-03  
**Mục tiêu:** Implement 4 high-impact features cho SOPs platform  

---

## Feature A: SOP Execution Analytics & Outcome Tracking

### Problem
Currently: execution logs exist (sop_executions table) but NO outcome data. Creators don't know:
- Completion rate per SOP
- Which steps cause drop-off
- Time per step
- User satisfaction scores

### Solution
Add outcome tracking + analytics engine.

### Schema
```sql
-- Migration 0161
CREATE TABLE sop_execution_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL REFERENCES sop_executions(id),
  template_id INTEGER NOT NULL REFERENCES sop_templates(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  completed BOOLEAN DEFAULT 0,
  drop_off_step INTEGER,
  total_time_seconds INTEGER,
  satisfaction_score INTEGER CHECK(satisfaction_score BETWEEN 1 AND 5),
  feedback_text TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE sop_step_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  total_views INTEGER DEFAULT 0,
  completions INTEGER DEFAULT 0,
  drop_offs INTEGER DEFAULT 0,
  avg_time_seconds REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(template_id, step_index)
);

CREATE INDEX idx_outcomes_template ON sop_execution_outcomes(template_id);
CREATE INDEX idx_outcomes_user ON sop_execution_outcomes(user_id);
CREATE INDEX idx_step_analytics_template ON sop_step_analytics(template_id);
```

### Files
- `seed/db/migrations/0161_outcome_tracking.sql`
- `seed/db/types/outcome-types.ts`
- `forest/analytics/sop-outcome-tracker.ts` — tracks completions, drop-offs
- `tree/analytics/step-metrics.ts` — per-step aggregation
- `app/[locale]/dashboard/analytics/sop-performance/` — UI page

### UI Wireframe
```
/dashboard/analytics/sop-performance
├── Header: "SOP Performance"
├── KPI Cards: Completion Rate | Avg Time | Drop-off Rate | Satisfaction
├── Chart: Completion funnel (per step)
├── Table: Per-SOP breakdown (name, completions, drop-offs, avg_time)
└── Feedback section: Recent satisfaction scores
```

---

## Feature B: AI-Powered SOP Auto-Creation

### Problem
Currently: SOP creation is manual. MASTER creators must write all steps manually. High barrier to entry.

### Solution
AI agent generates structured SOP from natural language description.

### Agent Architecture
```
User Input: "Create a SOP for TikTok Creativity Program"
  ↓
forest/agents/sop-creator-agent.ts
  ↓
[1] Analyze intent (is this a valid SOP topic?)
  ↓
[2] Generate step list with LLM (OpenRouter)
  ↓
[3] Create validation criteria per step
  ↓
[4] Estimate time per step
  ↓
[5] Generate i18n keys (vi + en)
  ↓
[6] Return structured SOP JSON
  ↓
land/sop-creator/auto-generate.ts → Save to D1
```

### Files
- `forest/agents/sop-creator-agent.ts` — main agent
- `forest/ai/prompt-templates/sop-generation.ts` — LLM prompts
- `land/sop-creator/auto-generate.ts` — API endpoint
- `tree/ai/sop-validator.ts` — validates generated SOP quality
- `app/[locale]/dashboard/sop-creator/auto-generate/` — wizard UI

### UI Wireframe
```
/dashboard/sop-creator/auto-generate
├── Step 1: Describe your workflow (textarea + examples)
├── Step 2: AI generates SOP (editable preview)
│   ├── Title, Category, Difficulty
│   ├── Steps (editable, reorderable)
│   ├── Time estimates
│   └── Validation criteria
├── Step 3: Review & Publish
└── Step 4: Live preview
```

### Integration Points
- Uses existing LLM provider stack (OpenRouter via `land/llm/`)
- Reuses existing D1 schema (sop_templates table)
- Respects tier limits (MASTER tier only)

---

## Feature C: Creator Revenue Dashboard

### Problem
Currently: Leaderboard shows rankings but no detailed revenue breakdown. Creators can't see:
- Total earnings by SOP
- Commission history
- Pending payouts
- Revenue projections
- Affiliate performance per SOP

### Solution
Full revenue dashboard for SOP creators + affiliates.

### Schema
```sql
CREATE TABLE creator_revenue_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_earnings REAL DEFAULT 0,
  pending_payout REAL DEFAULT 0,
  last_payout_date INTEGER,
  total_sop_sales INTEGER DEFAULT 0,
  total_affiliate_sales INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id)
);

CREATE TABLE payout_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT, -- 'NOWPayments' | 'PayOS'
  transaction_id TEXT,
  status TEXT DEFAULT 'pending', -- pending | processing | completed | failed
  created_at INTEGER DEFAULT (unixepoch())
);
```

### Files
- `land/affiliates/creator-revenue-dashboard.ts` — data aggregation
- `tree/affiliates/payout-calculator.ts` — commission math
- `tree/affiliates/revenue-projector.ts` — projections
- `app/[locale]/dashboard/sop-creator/revenue/` — UI

### UI Wireframe
```
/dashboard/sop-creator/revenue
├── Header: "Revenue Dashboard"
├── KPI Cards: Total Earnings | Pending Payout | This Month | Total Sales
├── Chart: Revenue over time (line chart)
├── Table: Per-SOP earnings breakdown
├── Section: Payout History
│   └── Table: date, amount, provider, status, action
└── Section: Projections
    ├── Next month estimate
    ├── Growth rate
    └── Milestone progress
```

---

## Feature D: Multi-Language SOP Expansion (30+ playbooks)

### Problem
Currently: Only 5 MMO/creator SOPs. Market coverage is narrow. Limited SEO reach.

### Solution
Expand to 30+ SOPs across 6 categories with full vi + en translations.

### Catalog Expansion

| Category | Count | Examples |
|----------|-------|----------|
| Content | 8 | Faceless YouTube, TikTok Creativity, YouTube Shorts, Educational Courses, Podcast to Video, Blog to Video, Meme Content, Reaction Videos |
| Business | 8 | AI Avatar Agency, UGC Agency, White-Label Production, Drop Servicing, Dropshipping Video Ads, SaaS Explainer Videos, Local Business Videos, Real Estate Video |
| Marketing | 6 | Affiliate Video Marketing, Product Launch Videos, Testimonial Videos, Social Media Ads, Email Video Campaigns, Influencer Collab Videos |
| Tech | 4 | API Documentation Videos, Code Tutorials, Tech Reviews, AI Tool Reviews |
| Finance | 4 | Personal Finance YouTube, Investment Content, Crypto/Web3 Content, Financial Education |
| Lifestyle | 4 | Travel Vlogging, Fitness Content, Food Content, Fashion Lookbooks |

### Files
- `seed/config/sops/playbooks/` (30 new YAML files)
- `seed/db/seeds/sop-catalog.ts` (updated seed script)
- `messages/sop.{en,vi}.json` (expanded i18n)

### Format
```yaml
# seed/config/sops/playbooks/faceless-youtube-cash-cow.yaml
id: faceless-youtube-cash-cow
name:
  en: "Faceless YouTube Cash Cow"
  vi: "Faceless YouTube Cash Cow"
category: content
difficulty: beginner
estimated_revenue:
  en: "$2K-$10K/mo"
  vi: "$2K-$10K/tháng"
steps:
  - id: niche-research
    order: 1
    name:
      en: "Research Your Niche"
      vi: "Nghiên Cứu Nich Của Bạn"
    description:
      en: "Use..."
      vi: "Sử dụng..."
    estimated_time: 120
    validation_criteria:
      - "Niche has 100K+ search volume"
      - "At least 3 competitors found"
```

---

## Architecture Impact Analysis

### Layer Mapping

| Feature | Seed | Tree | Forest | Land |
|---------|------|------|--------|------|
| A: Analytics | New types, migration | step-metrics | outcome-tracker | — |
| B: AI Auto-Create | — | prompt-templates | sop-creator-agent | auto-generate API |
| C: Revenue | — | payout-calculator | — | revenue-dashboard |
| D: Multi-Lang | New playbooks | — | — | — |

### No Breaking Changes
- All features additive (new tables, new files)
- Existing APIs unchanged
- Existing UI unchanged
- Backward compatible

### Migration Path
1. Run migration 0161 (outcome tracking)
2. Deploy forest/analytics
3. Deploy tree/analytics
4. Deploy new UI pages
5. Run seed script for 30 new SOPs
6. Enable features via feature flags

---

## Implementation Timeline (2 Weeks)

### Week 1 (P0 Features)
| Day | Feature | Tasks |
|-----|---------|-------|
| Mon | A: Analytics | Migration + types + tracker engine |
| Tue | A: Analytics | Step metrics + API routes |
| Wed | A: Analytics | UI page + charts |
| Thu | B: AI Create | Agent + prompts + API |
| Fri | B: AI Create | Wizard UI + validation |

### Week 2 (P1 Features)
| Day | Feature | Tasks |
|-----|---------|-------|
| Mon | C: Revenue | Revenue schema + aggregator |
| Tue | C: Revenue | Payout calculator + UI |
| Wed | D: Multi-Lang | 10 playbooks (content + business) |
| Thu | D: Multi-Lang | 20 playbooks (marketing + tech + finance + lifestyle) |
| Fri | All | Integration testing + docs |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| LLM quality for SOP generation | MEDIUM | Validation layer + human review queue |
| 30 playbooks overwhelming | LOW | Category filters + search |
| Migration conflict | LOW | New tables only, no schema changes |
| i18n completeness | MEDIUM | Batch translation + review |
| Feature A data volume | MEDIUM | Aggregation + retention policy |

---

## Unresolved Questions

1. Should SOP analytics be visible to FREE tier users or paid only?
2. AI SOP generation: free tier limit (1/mo) or paid only?
3. Creator revenue dashboard: visible to all tiers or MASTER only?
4. New playbook categories: user-voted or admin-curated?
5. SOP outcome data: public or private to creator?

---
