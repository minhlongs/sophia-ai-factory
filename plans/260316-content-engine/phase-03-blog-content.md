---
phase: 03
title: "Blog Post Creation (5 Posts)"
status: pending
effort: 2h
owner: writer
---

# Phase 03: Blog Post Creation

## Context Links

- **Parent Plan:** [plan.md](./plan.md)
- **Input:** [Content Calendar](../../reports/marketing/content/content-calendar-30days.md)
- **Output:** `../../reports/marketing/content/blog-posts/`

## Overview

**Priority:** P1 | **Status:** ⏳ pending | **Effort:** 2h

Viết 5 SEO-optimized blog posts (1000-1500 words each) targeting keywords từ SEO research.

## Blog Post Topics

| # | Title | Target Keyword | Word Count | CTA |
|---|-------|----------------|------------|-----|
| 1 | How to Create Product Video Ads in 2 Minutes | create product video ads | 1200 | Start Free Trial |
| 2 | AI Video Marketing for E-commerce: Complete Guide | ai video marketing ecommerce | 1500 | Download Guide |
| 3 | 90s Video Ads That Convert: Examples & Templates | 90 second video ads | 1000 | View Templates |
| 4 | From URL to Video: Automated Ad Creation | url to video | 1000 | Try URL Import |
| 5 | Video Ads vs Static Images: ROI Comparison | video ads roi | 1200 | Calculate ROI |

## Requirements

### Functional Requirements
- [ ] 5 complete blog posts (markdown format)
- [ ] Each post optimized for target keyword
- [ ] Include internal linking structure
- [ ] Add CTAs to product pages
- [ ] Include meta descriptions

### Non-Functional Requirements
- Readability score: Grade 8-10 (Flesch-Kincaid)
- SEO score: 80+ (Yoast/RankMath standard)
- Original content (no AI detection flags)
- Scannable format (headings, bullets, images)

## Architecture

### Blog Post Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Blog Post Template                        │
├─────────────────────────────────────────────────────────────┤
│  Frontmatter:                                                │
│    - title, description, keywords, author, date             │
├─────────────────────────────────────────────────────────────┤
│  Introduction (100-150 words)                                │
│    - Hook, Problem, Promise                                 │
├─────────────────────────────────────────────────────────────┤
│  Body Sections (3-5 H2s)                                     │
│    - Each H2 has 2-3 H3s                                    │
│    - Include examples, data, screenshots                    │
├─────────────────────────────────────────────────────────────┤
│  Conclusion (50-100 words)                                   │
│    - Summary, Key Takeaway, CTA                             │
├─────────────────────────────────────────────────────────────┤
│  SEO Elements:                                               │
│    - Meta description (150-160 chars)                       │
│    - Internal links (2-3)                                   │
│    - External links (1-2 authoritative)                     │
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

**Directory to Create:**
- `../../reports/marketing/content/blog-posts/`

**Files to Create:**
- `blog-post-01-create-product-video-ads.md`
- `blog-post-02-ai-video-marketing-ecommerce.md`
- `blog-post-03-90s-video-ads-templates.md`
- `blog-post-04-url-to-video-automation.md`
- `blog-post-05-video-ads-roi-comparison.md`

## Implementation Steps

### Step 1: Setup & Outline (15 min)

1. Create blog-posts directory
2. Create outline for each post
3. Define keyword placement strategy
4. Gather reference materials

### Step 2: Write Post 1-2 (40 min)

1. Write "How to Create Product Video Ads in 2 Minutes"
2. Write "AI Video Marketing for E-commerce: Complete Guide"
3. Review for SEO optimization
4. Add CTAs and internal links

### Step 3: Write Post 3-4 (35 min)

1. Write "90s Video Ads That Convert"
2. Write "From URL to Video: Automated Ad Creation"
3. Review for SEO optimization
4. Add CTAs and internal links

### Step 4: Write Post 5 + Review (30 min)

1. Write "Video Ads vs Static Images: ROI Comparison"
2. Review all 5 posts for consistency
3. Final SEO check
4. Format and save

## Todo List

- [ ] Create blog-posts directory
- [ ] Write blog post 01 (How to Create Product Video Ads)
- [ ] Write blog post 02 (AI Video Marketing Guide)
- [ ] Write blog post 03 (90s Video Ads Templates)
- [ ] Write blog post 04 (URL to Video Automation)
- [ ] Write blog post 05 (Video Ads ROI)
- [ ] SEO review for all posts
- [ ] Add internal linking
- [ ] Add CTAs
- [ ] Save all posts to `../../reports/marketing/content/blog-posts/`

## Success Criteria

- [ ] 5 complete blog posts saved as markdown
- [ ] Each post 1000-1500 words
- [ ] Target keyword in title, H1, first paragraph, conclusion
- [ ] 2-3 internal links per post
- [ ] Clear CTA at end of each post
- [ ] Meta description for each post

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Posts quá ngắn/dài | Low | Use word count checker |
| SEO optimization thiếu | Medium | Follow SEO checklist |
| Content quá promotional | Medium | 70% educational, 30% promotional |
| AI detection flags | Low | Human review and edit |

## Security Considerations

- Không include confidential company data
- Use publicly available case studies only
- No customer data without permission

## Next Steps

**Upon Completion:**
1. Update plan.md phase status
2. Handoff blog posts cho Phase 04 (social media repurposing)
3. Begin social media content creation (Phase 04)

**Dependencies:**
- ← Blocked By: Phase 02 (Content Calendar)
- → Blocks: Phase 04 (Social Media - can repurpose blogs)

---

## Appendix: SEO Checklist per Post

- [ ] Target keyword in title
- [ ] Target keyword in H1
- [ ] Target keyword in first 100 words
- [ ] Target keyword in 2-3 H2s
- [ ] Target keyword in conclusion
- [ ] Meta description (150-160 chars)
- [ ] 2-3 internal links
- [ ] 1-2 external authoritative links
- [ ] Image alt text includes keyword
- [ ] URL slug includes keyword
- [ ] Readability score Grade 8-10
