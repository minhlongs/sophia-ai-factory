# Phase 3: SOP Creator + Marketplace

## Overview

- **Priority:** P1
- **Status:** pending
- **Mục tiêu:** Polish SOP Creator UI, build Marketplace foundation, content catalog

## Requirements

### Functional
- SOP Creator: multi-step wizard, template selection, AI-generated content, preview + edit
- Marketplace: browse SOPs, preview, purchase/activate, usage tracking
- Content catalog: categories, search, rating, tags
- Integration: SOP Creator → usage metering → billing

### Non-functional
- SOP generation < 30s per document
- Marketplace catalog load < 2s
- Search: full-text + tag filter
- Mobile responsive

## Architecture

```
SOP Creator:
Wizard → Template → AI Generate → Preview → Save → Usage Meter

Marketplace:
Catalog → Search → Detail → Activate → Billing → User Library

Data Model:
sop_templates, sop_documents, marketplace_listings, purchases
```

## Related Code Files

| Action | Path |
|--------|------|
| SOP Creator pages | `app/[locale]/dashboard/sop-creator/` |
| Marketplace pages | `app/[locale]/dashboard/sop-marketplace/` |
| SOP actions | `app/[locale]/dashboard/sop-creator/actions.ts` |
| i18n | `messages/vi.json`, `messages/en.json` |

## Implementation Steps

1. **SOP Creator polish** — fix UX gaps, add template categories, improve preview
2. **Marketplace foundation** — catalog pages, search, listing cards
3. **Content catalog** — seed data, categories, tags
4. **Purchase flow** — activate SOP → deduct credits → add to user library
5. **Integration** — wire SOP usage → metering → billing

## Todo List

- [ ] Audit existing SOP Creator pages
- [ ] Fix UX issues (loading states, error handling, empty states)
- [ ] Add template categories (marketing, sales, ops, HR)
- [ ] Build marketplace catalog page
- [ ] Build SOP detail page
- [ ] Implement purchase/activate flow
- [ ] Add search + filter
- [ ] Wire to usage metering
- [ ] E2E test: browse → activate → use → billed

## Success Criteria

- SOP Creator: full wizard flow works end-to-end
- Marketplace: browse, search, activate SOPs
- Purchase flow: credits deducted, SOP added to library
- Mobile responsive

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI generation timeout | MEDIUM | Show progress, cache results |
| Content quality varies | LOW | Template system + user editing |
| Billing mismatch on purchase | HIGH | Idempotency key per purchase |
