---
phase: 1
title: "Merge landing page — add RaaS sections"
priority: P1
status: completed
---

# Phase 1: Merge Landing Page

## Context Links
- Source: `apps/sophia-proposal/components/landing/`
- Target: `apps/sophia-ai-factory/src/app/components/sections/`
- Landing page: `apps/sophia-ai-factory/src/app/[locale]/page.tsx`

## Overview

Add RaaS-specific landing sections from proposal app to the existing ai-factory landing page. The landing should show BOTH products (Video Factory + RaaS).

## Key Insights

- ai-factory landing already has: Hero, Workflow, Features, SocialProof, Pricing, AffiliateDiscovery, ROICalculator, FAQ, Footer
- proposal landing has: Hero, ProposalGeneratorSection (69 lines), SocialProofSection (141 lines), FeaturesSection, HowItWorksSection, DemoSection, PricingSection, CTASection, FAQSection
- Only 2 sections are unique to proposal and worth merging: **ProposalGeneratorSection** and **DemoSection** (terminal preview of RaaS commands)
- SocialProof from proposal can be merged INTO existing SocialProof (add RaaS testimonials)

## Related Code Files

### Files to Create
- `src/app/components/sections/raas-showcase.tsx` -- adapted from ProposalGeneratorSection, shows RaaS value prop
- `src/app/components/sections/raas-demo-terminal.tsx` -- adapted from DemoSection/terminal-preview, shows AI commands

### Files to Modify
- `src/app/[locale]/page.tsx` -- add 2 new dynamic imports (RaaSShowcase, RaasDemoTerminal)
- `src/app/components/sections/social-proof.tsx` -- add RaaS testimonials/stats
- `messages/en.json` -- add `landing.raas.*` translation keys
- `messages/vi.json` -- add `landing.raas.*` translation keys

### Files NOT to touch
- All existing landing sections remain intact
- Proposal's landing components stay in proposal app (source only, no deletion yet)

## Implementation Steps

1. Read `apps/sophia-proposal/components/landing/proposal-generator-section.tsx` and adapt to ai-factory patterns:
   - Replace hardcoded text with `useTranslations('landing')` calls
   - Use ai-factory's UI components (`@/components/ui/*`)
   - Rename to `raas-showcase.tsx`, place in `src/app/components/sections/`
   - Keep under 200 lines

2. Read `apps/sophia-proposal/components/landing/terminal-preview.tsx` and create `raas-demo-terminal.tsx`:
   - Show RaaS AI command examples (proposal:create, video:create, lead:generate)
   - Terminal animation showing mission execution
   - Add i18n keys

3. Update `src/app/[locale]/page.tsx` -- add dynamic imports:
   ```
   Hero → Workflow → Features → RaaSShowcase → RaasDemoTerminal → SocialProof → Pricing → AffiliateDiscovery → ROICalculator → FAQ → Footer
   ```
   Insert RaaS sections between Features and SocialProof.

4. Update `social-proof.tsx` -- add RaaS stats:
   - "500+ proposals generated"
   - "17 AI commands available"
   - Keep existing video/affiliate stats

5. Add i18n keys to `messages/en.json` and `messages/vi.json` under `landing.raas.*`

## Todo List

- [x] Create `raas-showcase.tsx` section component
- [x] Create `raas-demo-terminal.tsx` section component
- [x] Update landing page to include new sections
- [x] Update social-proof with RaaS stats
- [x] Add en/vi translation keys
- [x] Verify build passes: `npm run build`

## Success Criteria

- Landing page shows Video Factory AND RaaS features
- All sections render without errors
- i18n works for en/vi
- No existing functionality broken
- `npm run build` passes with 0 errors
