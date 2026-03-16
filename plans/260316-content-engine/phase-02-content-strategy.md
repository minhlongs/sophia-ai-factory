---
phase: 02
title: "Content Strategy & 30-Day Calendar"
status: pending
effort: 1.5h
owner: planner
---

# Phase 02: Content Strategy & 30-Day Calendar

## Context Links

- **Parent Plan:** [plan.md](./plan.md)
- **Input:** [Phase 01 Report](../../reports/marketing/content/seo-keyword-research.md)
- **Output:** `../../reports/marketing/content/content-calendar-30days.md`

## Overview

**Priority:** P1 | **Status:** ⏳ pending | **Effort:** 1.5h

Xây dựng content strategy và editorial calendar 30 ngày dựa trên SEO research từ Phase 01.

## Key Insights

### Content Strategy Principles
- **70-20-10 Rule:** 70% educational, 20% promotional, 10% experimental
- **Platform-First:** Content tailored per platform (LinkedIn vs Twitter vs Instagram)
- **SEO-Driven:** Every piece targets specific keywords from research

### Content Pillars (Proposed)
1. **AI Video Education** - How-to, tutorials, best practices
2. **E-commerce Growth** - Marketing strategies, case studies
3. **Product Deep Dives** - Features, use cases, templates
4. **Industry Trends** - AI marketing, video advertising trends
5. **Customer Success** - Case studies, testimonials, results

## Requirements

### Functional Requirements
- [ ] Define 4-5 content pillars
- [ ] Create 30-day editorial calendar
- [ ] Assign content types per day
- [ ] Include platform distribution plan
- [ ] Define success metrics per content type

### Non-Functional Requirements
- Calendar phải realistic (sustainable pace)
- Balance evergreen và timely content
- Include content repurposing strategy

## Architecture

### Content Calendar Structure

```
┌──────────────────────────────────────────────────────────────┐
│                    30-Day Content Calendar                    │
├──────────────────────────────────────────────────────────────┤
│  Week 1: Foundation & Education                              │
│  ├─ Day 1-2: Blog posts (SEO)                                │
│  ├─ Day 3-5: Social media (awareness)                        │
│  └─ Day 6-7: Email nurture (engagement)                      │
├──────────────────────────────────────────────────────────────┤
│  Week 2: Product Focus                                       │
│  ├─ Day 8-9: Feature highlights                              │
│  ├─ Day 10-12: Tutorial videos                               │
│  └─ Day 13-14: Customer stories                              │
├──────────────────────────────────────────────────────────────┤
│  Week 3: Authority Building                                  │
│  ├─ Day 15-17: Industry insights                             │
│  ├─ Day 18-19: Thought leadership                            │
│  └─ Day 20-21: Webinars/live content                         │
├──────────────────────────────────────────────────────────────┤
│  Week 4: Conversion Push                                     │
│  ├─ Day 22-24: Case studies (social proof)                   │
│  ├─ Day 25-27: Limited offers (urgency)                      │
│  └─ Day 28-30: Retargeting content                           │
└──────────────────────────────────────────────────────────────┘
```

## Related Code Files

**Files to Create:**
- `../../reports/marketing/content/content-calendar-30days.md`
- `../../reports/marketing/content/content-pillars.md`

**Files to Update:**
- `../../docs/project-roadmap.md` (add content milestones)

## Implementation Steps

### Step 1: Define Content Pillars (20 min)

1. Review SEO research from Phase 01
2. Define 4-5 core content pillars
3. Map keywords to each pillar
4. Document pillar descriptions

### Step 2: Content Types & Mix (15 min)

1. Define content types: blog, social, video, email, infographic
2. Set target mix percentages
3. Define repurposing rules (1 blog → 5 social → 1 email)

### Step 3: Build 30-Day Calendar (45 min)

1. Create day-by-day calendar
2. Assign content type per day
3. Map to content pillars
4. Include target keywords
5. Add CTAs and success metrics

### Step 4: Platform Strategy (10 min)

1. Define platform-specific guidelines
2. Set posting frequency per platform
3. Document best practices per channel

## Todo List

- [ ] Define content pillars (4-5 themes)
- [ ] Create content type mix strategy
- [ ] Build 30-day editorial calendar
- [ ] Add platform distribution plan
- [ ] Define success metrics
- [ ] Write strategy document
- [ ] Save to `../../reports/marketing/content/content-calendar-30days.md`

## Success Criteria

- [ ] 4-5 clearly defined content pillars
- [ ] 30-day calendar với daily content items
- [ ] Mỗi content item có: title, pillar, type, platform, keyword, CTA
- [ ] Platform guidelines documented
- [ ] Success metrics defined per content type

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calendar quá ambitious | High | Build buffer days, realistic capacity |
| Content pillars quá rộng | Medium | Focus on core differentiators |
| Platform spread too thin | Medium | Prioritize 2-3 core platforms first |

## Security Considerations

N/A (content strategy phase)

## Next Steps

**Upon Completion:**
1. Update plan.md phase status
2. Handoff calendar cho Phase 03-05 (content creation)
3. Begin blog post creation (Phase 03)

**Dependencies:**
- ← Blocked By: Phase 01 (SEO Research)
- → Blocks: Phase 03, 04, 05 (Content Creation)

---

## Appendix: Content Calendar Template

| Day | Date | Content Title | Pillar | Type | Platform | Keyword | CTA | Status |
|-----|------|---------------|--------|------|----------|---------|-----|--------|
| 1 | D1 | How to Create Product Videos | Education | Blog | Website | ai video generator | Try Free | Draft |
| 2 | D2 | Twitter thread on video trends | Trends | Thread | Twitter | video marketing | Follow | Scheduled |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
