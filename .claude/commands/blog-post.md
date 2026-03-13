---
description: ✍️ Content Generation — Blog Posts, Articles, Documentation
argument-hint: [topic] [format: long|short|seo|technical]
---

**Think harder** để tạo content: <topic>$ARGUMENTS</topic>

**IMPORTANT:** Content phải value-driven, SEO-optimized, và brand-consistent.

## Content Types

| Type | Length | Purpose | SEO Focus |
|------|--------|---------|-----------|
| Blog post | 1,500-3,000 words | Thought leadership | High |
| Technical doc | 500-2,000 words | Documentation | Medium |
| Case study | 800-1,500 words | Social proof | Medium |
| White paper | 3,000-5,000 words | Authority building | Low |
| Landing page | 300-800 words | Conversion | High |

## Content Generation Workflow

### 1. Topic Research
```bash
# Keyword research (via API)
curl -s "https://api.semrush.com/keywords" \
  -d "phrase=agency+automation" \
  -H "Authorization: Bearer $SEMRUSH_KEY"

# Competitor analysis
curl -s "https://api.ahrefs.com/content-explorer" \
  -d "q=AI+automation+agency" \
  -H "Authorization: Bearer $AHREFS_KEY"
```

### 2. Outline Generation
```markdown
# [Blog Post Title]

## Hook (100 words)
- Problem statement
- Why it matters
- Promise to reader

## Problem Deep Dive (300 words)
- Current state
- Pain points
- Cost of inaction

## Solution Overview (400 words)
- Main concept
- How it works
- Key benefits

## Implementation (500 words)
- Step 1: ...
- Step 2: ...
- Step 3: ...

## Case Study/Example (300 words)
- Before/after
- Metrics
- Testimonial

## CTA (100 words)
- Next step
- Offer
- Urgency
```

### 3. Draft Writing
```bash
# Generate first draft
cat > content/draft.md << 'EOF'
# AgencyOS: Automate Your Agency Operations

In today's fast-paced digital landscape, agencies struggle with...

[Continue with full draft following outline]
EOF
```

### 4. SEO Optimization
```bash
# Check keyword density
node scripts/check-seo.js content/draft.md \
  --keywords "agency automation, AI operations, RaaS" \
  --target-density "1-2%"

# Generate meta tags
node scripts/generate-meta.js content/draft.md \
  --output content/draft.meta.json
```

### 5. Review & Publish
```bash
# Grammar check
grammarly-lint content/draft.md

# Readability score
node scripts/readability.js content/draft.md
# Target: Flesch-Kincaid Grade 8-10

# Publish to CMS
curl -X POST https://cms.agencyos.network/api/posts \
  -H "Authorization: Bearer $CMS_TOKEN" \
  -d @content/draft.final.json
```

## Content Templates

### Blog Post Template
```markdown
---
title: "[Compelling Title with Number/Power Word]"
description: "[Meta description, 150-160 chars]"
keywords: [primary, secondary, long-tail]
category: [Engineering/Marketing/Product]
author: [Name]
date: [YYYY-MM-DD]
cover_image: /images/[slug]-cover.png
---

## Introduction
Start with a hook—a surprising statistic, relatable problem, or bold statement.

> "80% of agencies waste 20+ hours weekly on manual operations."

## The Problem
Explain why this matters. Use data, examples, and empathy.

## The Solution
Introduce your approach. Be specific and actionable.

## Step-by-Step Guide
Break down the implementation into clear steps.

### Step 1: [Action]
Explanation + code example + screenshot.

### Step 2: [Action]
Explanation + code example + screenshot.

## Results
Show the impact with metrics.

## Conclusion
Summarize and provide clear next steps.

---

**CTA:** Ready to automate your agency? [Get started with AgencyOS](/signup)
```

### Technical Documentation Template
```markdown
---
title: "[Feature] Documentation"
version: "1.0.0"
last_updated: "[Date]"
---

## Overview
[Brief description of what this feature does]

## Prerequisites
- [List requirements]

## Installation
```bash
npm install @agencyos/feature-name
```

## Configuration
```typescript
// config.ts
export default {
  apiKey: process.env.API_KEY,
  // ...
};
```

## Usage
### Basic Example
```typescript
import { Feature } from '@agencyos/feature-name';

const instance = new Feature(config);
await instance.method();
```

### Advanced Example
[More complex usage pattern]

## API Reference
### `methodName(params)`
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param1` | string | Yes | Description |

## Troubleshooting
### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| Error X | ... | ... |

## Related
- [Link to related docs]
```

## Content Distribution

```bash
# Cross-post to platforms
curl -X POST https://api.buymeacoffee.com/api/posts \
  -H "Authorization: Bearer $BMC_TOKEN" \
  -d @content/draft.final.json

# Schedule social posts
curl -X POST https://api.buffer.com/1/updates/create \
  -d "text=New blog post: [Title] [URL]" \
  -d "profile_ids=[twitter,linkedin]" \
  -H "Authorization: Bearer $BUFFER_TOKEN"

# Email newsletter
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_KEY" \
  -d @content/newsletter.json
```

## Content Calendar

```yaml
# content/calendar.yml
2026-03:
  - week1:
      topic: "AI Automation Trends 2026"
      format: blog
      status: draft
  - week2:
      topic: "Case Study: 10x Agency Efficiency"
      format: case-study
      status: research
  - week3:
      topic: "RaaS Architecture Deep Dive"
      format: technical
      status: outline
  - week4:
      topic: "Monthly Roundup"
      format: newsletter
      status: pending
```

## Related Commands

- `/social-media` — Social media content
- `/email-campaign` — Email marketing
- `/landing-page` — Landing page copy
