# Phase 4: Core Sections Implementation (Part 2)

## Context
Implement the conversion-focused and interactive sections.

## Sections

### 5. Pricing Section
- **Content:** 3 Tiers (Minimal: 35M, Standard: 55M, Scale: 85M).
- **Design:**
    - 3 Cards side-by-side (stack on mobile).
    - "Standard" card highlighted (glow, slightly larger).
    - List of features with checkmarks.
    - CTA button for each.

### 6. ROI Calculator
- **Logic:**
    - Inputs: Videos/mo (slider), Views/video (slider), CTR (slider), Conversion Rate (slider), Commission (input).
    - Formulas:
        - Monthly Revenue = Videos * Views * (CTR/100) * (Conv/100) * Commission.
        - Annual Revenue = Monthly * 12.
        - ROI = ((Monthly Revenue - Monthly Cost) / Monthly Cost) * 100%. (Need to select Tier for cost).
- **Design:** Interactive card with sliders and dynamic result display.

### 7. Affiliate Programs
- **Content:** Top 10 programs from research (CoinLedger, Jasper, etc.).
- **Design:** Grid of cards showing Logo, Name, Commission %.

### 8. FAQ Section
- **Content:** Q&A from brief.
- **Design:** Accordion (expand/collapse).

### 9. CTA Footer
- **Content:** Contact info (Email, Zalo, Calendly).
- **Design:** Simple, centered, strong final CTA.

## Implementation Steps

1.  Create `app/components/sections/Pricing.tsx`
2.  Create `app/components/sections/ROICalculator.tsx` (use `useState` for logic)
3.  Create `app/components/sections/Affiliates.tsx`
4.  Create `app/components/sections/FAQ.tsx`
5.  Create `app/components/sections/Footer.tsx`
6.  Add to `app/page.tsx`.

## Success Criteria
- [ ] Pricing accurately reflects brief.
- [ ] ROI Calculator works and updates in real-time.
- [ ] FAQ is interactive.
- [ ] Footer has correct links.
