---
phase: 01
title: "Market Research & SEO Analysis"
status: pending
effort: 2h
owner: researcher
---

# Phase 01: Market Research & SEO Analysis

## Context Links

- **Parent Plan:** [plan.md](./plan.md)
- **Reports Output:** `../../reports/marketing/content/seo-keyword-research.md`
- **Research Notes:** `./research/`

## Overview

**Priority:** P1 (foundation for all content) | **Status:** ⏳ pending | **Effort:** 2h

Nghiên cứu thị trường và SEO analysis để xác định content opportunities cho AI video marketing niche targeting e-commerce brands.

## Key Insights

### Market Context
- AI video generation market đang explosive growth (2024-2026)
- E-commerce brands cần video ads nhanh, rẻ, scalable
- Đối thủ chính: HeyGen, Synthesia, Pictory, InVideo
- Sophia AI khác biệt: 90s ads từ URL trong <2 phút

### Target Audience
- D2C e-commerce brands ($1M-$50M revenue)
- Performance marketers tại ecommerce companies
- Agency owners managing multiple client accounts

## Requirements

### Functional Requirements
- [ ] Keyword research với minimum 50 keywords
- [ ] Competitor content audit (top 5 competitors)
- [ ] Buyer personas (3 profiles)
- [ ] Content gap analysis

### Non-Functional Requirements
- Data từ reliable sources (Ahrefs, SEMrush, Google Keyword Planner)
- Keywords phải có search volume >100/month
- Competitor analysis phải actionable

## Architecture

### Research Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Keyword        │────▶│  Competitor      │────▶│  Content        │
│  Research       │     │  Analysis        │     │  Gap Analysis   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEO Research Report                          │
│  - 50+ keywords with volume/difficulty                          │
│  - Competitor content strategies                                │
│  - Target personas                                              │
│  - Recommended content topics                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Related Code Files

**Files to Create:**
- `../../reports/marketing/content/seo-keyword-research.md`
- `./research/keyword-research-notes.md`
- `./research/competitor-analysis-notes.md`

## Implementation Steps

### Step 1: Keyword Research (45 min)

1. Research AI video marketing keywords
2. Research e-commerce video ad keywords
3. Research automated content creation keywords
4. Compile into master keyword list

**Keyword Categories:**
- Primary: "AI video generator", "product video ads"
- Secondary: "ecommerce video marketing", "automated video creation"
- Long-tail: "create product video from URL", "90 second video ads"

### Step 2: Competitor Analysis (30 min)

1. Identify top 5 competitors (HeyGen, Synthesia, Pictory, InVideo, Runway)
2. Analyze their content strategies
3. Document content types, posting frequency, engagement
4. Identify content gaps opportunities

### Step 3: Buyer Personas (30 min)

1. Define Persona 1: D2C Founder/Owner
2. Define Persona 2: Performance Marketer
3. Define Persona 3: Agency Owner
4. Document pain points, goals, content preferences

### Step 4: Content Gap Analysis (15 min)

1. Map keywords to competitor content
2. Identify underserved topics
3. Prioritize content opportunities
4. Generate topic recommendations

## Todo List

- [ ] Complete keyword research (50+ keywords)
- [ ] Complete competitor analysis (5 competitors)
- [ ] Create 3 buyer personas
- [ ] Complete content gap analysis
- [ ] Write SEO research report
- [ ] Save report to `../../reports/marketing/content/seo-keyword-research.md`

## Success Criteria

- [ ] Report chứa 50+ keywords với metrics (volume, difficulty, intent)
- [ ] 5 competitor profiles với content analysis
- [ ] 3 detailed buyer personas
- [ ] 10+ content topic recommendations
- [ ] Report format: markdown, actionable, ready for content team

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Thiếu data access (paid tools) | Medium | Use free alternatives: Google Trends, Ubersuggest |
| Keyword data không chính xác | Low | Cross-reference multiple sources |
| Competitor analysis quá surface | Medium | Deep dive vào top performing content |

## Security Considerations

- Không scrape websites vi phạm ToS
- Sử dụng public data chỉ
- Respect robots.txt khi crawling

## Next Steps

**Upon Completion:**
1. Update plan.md phase status
2. Handoff report cho Phase 02 (Content Strategy)
3. Archive research notes

**Dependencies:**
- → Blocks: Phase 02 (Content Strategy & Calendar)
- → Informs: All content creation phases

---

## Appendix: Keyword Categories

### Category 1: AI Video Generation (Primary)
- ai video generator
- ai video creation
- automated video production
- ai powered video ads

### Category 2: E-commerce Video Marketing
- ecommerce video ads
- product video marketing
- shoppable video ads
- conversion video ads

### Category 3: Speed & Automation
- fast video creation
- 2 minute video ads
- url to video
- automated ad creation

### Category 4: Templates & Tools
- video ad templates
- 90s video templates
- ecommerce video templates
- drag and drop video maker
