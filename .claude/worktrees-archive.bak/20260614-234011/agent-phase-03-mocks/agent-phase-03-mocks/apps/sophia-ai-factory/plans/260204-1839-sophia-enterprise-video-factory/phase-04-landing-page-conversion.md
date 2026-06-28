# Phase 4: Landing Page (Conversion & Pricing)

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Implement conversion-focused sections: Pricing, ROI, FAQ, and Footer.

## Overview
- **Priority**: P1
- **Status**: Pending
- **Description**: This phase focuses on closing the sale. The Pricing table must clearly differentiate the tiers. The ROI Calculator adds interactive value. The FAQ handles objections.

## Key Insights
- **Pricing Psychology**: Highlight the "Recommended" tier (Premium). Use "Anchor Pricing" (Enterprise).
- **ROI Calculator**: Simple inputs (Videos/mo, Avg Views, CPM/Affiliate) -> Big Output ($$$).
- **Trust**: FAQ should answer questions about "AI Quality", "Copyright", and "Support".

## Requirements
1.  **Pricing Section**:
    -   3 Cards: Basic, Premium (Glow), Enterprise.
    -   Feature comparison list (Checkmarks).
    -   Toggle: Monthly/Yearly (UI only for now).
2.  **ROI Calculator**:
    -   Inputs: Number of Channels, Videos per Week, Exp. Views.
    -   Output: Projected Monthly Revenue.
    -   Interactive: Sliders or Input fields.
3.  **FAQ Section**:
    -   Accordion style.
    -   Glassmorphic look.
4.  **Footer**:
    -   Links, Socials, Copyright.
    -   "Made with ❤️ by Mekong CLI".

## Architecture
- **Sections**: `app/components/sections/pricing.tsx`, `app/components/sections/roi-calculator.tsx`, `app/components/sections/faq.tsx`.
- **UI**: `app/components/ui/slider.tsx`, `app/components/ui/accordion.tsx`.

## Related Code Files
- `app/components/sections/pricing.tsx`
- `app/components/sections/roi-calculator.tsx`
- `app/components/sections/faq.tsx`
- `app/components/layout/footer.tsx`
- `app/components/ui/slider.tsx`

## Implementation Steps
1.  **Build Pricing Section**:
    -   Create PricingCard component.
    -   Map data from `config/tiers.ts`.
2.  **Build ROI Calculator**:
    -   Create state for inputs.
    -   Implement calculation logic (Simple formula).
    -   Display result with counting animation.
3.  **Build FAQ Section**:
    -   Create Accordion component (using Framer Motion for expand/collapse).
    -   Add content.
4.  **Build Footer**:
    -   Standard layout.
5.  **Integrate**: Add to `app/page.tsx`.

## Todo List
- [ ] Implement `Pricing` section.
- [ ] Implement `ROI Calculator` section.
- [ ] Implement `FAQ` section.
- [ ] Implement `Footer`.
- [ ] Create `Slider` component (if needed, or standard input range).
- [ ] Verify interactivity.

## Success Criteria
- [ ] Calculator updates numbers in real-time.
- [ ] Pricing cards highlight differences clearly.
- [ ] FAQ expands/collapses smoothly.

## Risk Assessment
- **Risk**: Calculator logic being too optimistic/misleading.
- **Mitigation**: Add a disclaimer "Estimates only".

## Next Steps
- Proceed to Phase 5: Affiliate Discovery Engine.
