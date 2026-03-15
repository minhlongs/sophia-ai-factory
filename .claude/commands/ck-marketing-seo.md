# Marketing SEO - Search Engine Optimization Bundle

> **Binh Pháp Ch.3 謀攻 (Strategic Attack):** "Không đánh mà thắng - Win without fighting"

## Skills Activated

- `seo-audit` - Full SEO health check
- `programmatic-seo` - Scale SEO pages
- `schema-markup` - Structured data
- `content-strategy` - Content planning

## Syntax

```bash
/marketing-seo audit [--full|--quick]           # SEO audit
/marketing-seo programmatic --pattern="..."    # Build SEO pages at scale
/marketing-seo schema --type=LocalBusiness     # Add structured data
/marketing-seo content --topic="..."           # Content strategy
```

## When to Use

- Site không rank trên Google
- Cần tạo nhiều landing pages
- Thiếu structured data
- Content strategy planning

## Audit Framework (Priority Order)

1. **Crawlability & Indexation** - Can Google find it?
2. **Technical Foundations** - Speed, mobile, HTTPS
3. **On-Page Optimization** - Titles, meta, headings
4. **Content Quality** - E-E-A-T signals
5. **Authority & Links** - Backlink profile

## Technical SEO Checklist

```markdown
### Crawlability

- [ ] robots.txt configured
- [ ] XML sitemap exists
- [ ] Important pages < 3 clicks
- [ ] No orphan pages

### Indexation

- [ ] site:domain.com check
- [ ] Canonical tags correct
- [ ] No accidental noindex
- [ ] HTTPS everywhere

### Speed (Core Web Vitals)

- [ ] LCP < 2.5s
- [ ] INP < 200ms
- [ ] CLS < 0.1
```

## On-Page SEO Checklist

```markdown
### Title Tags

- [ ] Unique per page
- [ ] Primary keyword near start
- [ ] 50-60 characters
- [ ] Compelling & click-worthy

### Meta Descriptions

- [ ] 150-160 characters
- [ ] Includes keyword
- [ ] Has CTA

### Content

- [ ] Keyword in first 100 words
- [ ] H1 contains primary keyword
- [ ] Logical heading hierarchy
- [ ] Alt text on images
```

## Programmatic SEO Templates

```bash
# City pages
/marketing-seo programmatic --pattern="[service]-in-[city]"

# Comparison pages
/marketing-seo programmatic --pattern="[product]-vs-[competitor]"

# How-to pages
/marketing-seo programmatic --pattern="how-to-[action]-with-[product]"
```

## Schema Types

```bash
/marketing-seo schema --type=LocalBusiness    # Restaurants, stores
/marketing-seo schema --type=Product          # E-commerce
/marketing-seo schema --type=Article          # Blog posts
/marketing-seo schema --type=FAQPage          # FAQ sections
/marketing-seo schema --type=HowTo            # Tutorials
```

## Output Format

```markdown
## Executive Summary

- Overall health: [Good/Warning/Critical]
- Top 3 priorities

## Technical Issues

| Issue | Impact | Fix | Priority |

## On-Page Issues

| Page | Issue | Fix |

## Action Plan

1. Critical fixes (blocking)
2. High-impact improvements
3. Quick wins
4. Long-term recommendations
```

## Related Commands

- `/marketing-local` - Local SEO focus
- `/marketing-copy` - Content writing
- `/marketing-cro` - Conversion optimization

## ĐIỀU 50

> Audit → Fix → Rank → Win organic traffic
> Không đánh mà thắng!
