---
title: "Auto-Discovery Affiliate Section Implementation Plan"
description: "Implementation of the Affiliate Discovery section featuring a glassmorphism card grid of top 20 programs with neon glow effects."
status: pending
priority: P2
effort: 4h
branch: master
tags: [frontend, react, tailwind, ui-ux]
created: 2026-02-04
---

# Auto-Discovery Affiliate Section Implementation Plan

## 1. Overview
This plan outlines the implementation of the "Auto-Discovery Affiliate" section for the Sophia Proposal application. The section will display a curated list of top 20 affiliate programs in a responsive grid layout using glassmorphism design principles and neon glow effects consistent with the "Deep Space" theme.

## 2. Architecture & Design

### 2.1 Component Structure
- **New Component:** `app/components/sections/AffiliateDiscovery.tsx`
- **Data Source:** `app/lib/affiliate-data.ts` (Static data separation)
- **Integration:** `app/page.tsx` (After Features section)

### 2.2 Design Specifications
- **Theme:** Deep Space (Dark background, neon accents)
- **Card Style:**
  - Glassmorphism: `bg-white/5 backdrop-blur-lg border border-white/10`
  - Hover Effects: Neon glow (Cyan/Purple/Pink), scale up, border highlight
- **Layout:**
  - Desktop: 3 columns
  - Tablet: 2 columns
  - Mobile: 1 column
- **Typography:** Inter/Sans with gradient text for headers

### 2.3 Data Schema (`AffiliateProgram`)
```typescript
interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  commission: string;
  link: string; // Placeholder or actual link
  tags?: string[];
}
```

## 3. Implementation Phases

### Phase 1: Data Setup
**Goal:** Establish the data source for the 20 required affiliate programs.

1.  Create `app/lib/affiliate-data.ts`.
2.  Define `AffiliateProgram` interface.
3.  Populate `affiliatePrograms` array with the specified 20 programs:
    -   **High Tier (40-50%):** SmartSuite, Glide, Notion
    -   **Mid Tier (25-35%):** PandaDoc, SurveySparrow, Jasper, Webflow, Make, Monday.com
    -   **Standard Tier (15-20%):** Apollo, Loom, Instapage, Livestorm, Airtable, Calendly, Typeform, Intercom, Freshdesk, ClickUp, Zapier

### Phase 2: Component Development
**Goal:** Build the `AffiliateDiscovery` UI component.

1.  Create `app/components/sections/AffiliateDiscovery.tsx`.
2.  Implement Section Header:
    -   Title: "Auto-Discovery Affiliate Network" (or similar)
    -   Subtitle: Description of the ecosystem.
3.  Implement Card Component (internal or separate):
    -   Display Name, Category, Commission Rate.
    -   "Apply Now" / "View" button style.
    -   Apply Glassmorphism classes (`backdrop-filter`, `bg-opacity`).
4.  Implement Grid Layout:
    -   Use CSS Grid with responsive breakpoints (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

### Phase 3: Animation & Styling
**Goal:** Apply "MAX WOW" effects.

1.  Integrate `framer-motion`:
    -   Staggered entrance animations for cards.
    -   Hover states: `scale: 1.05`, `boxShadow` glow.
2.  Styling Refinement:
    -   Use neon colors for Commission badges (e.g., Cyan for >30%, Purple for others).
    -   Ensure text contrast on dark backgrounds.

### Phase 4: Integration & Verification
**Goal:** Integrate into the main page and verify.

1.  Import `AffiliateDiscovery` in `app/page.tsx`.
2.  Place component immediately after `<Features />`.
3.  Verify responsiveness on Mobile, Tablet, and Desktop.
4.  Check accessibility (contrast, focus states).

## 4. Technical Details

### 4.1 Data Mapping
| Program | Commission | Category |
| :--- | :--- | :--- |
| SmartSuite | 50% | No-Code |
| Glide | 50% | No-Code |
| Notion | 40% | Productivity |
| ... | ... | ... |

### 4.2 Libraries
- `framer-motion`: For animations.
- `lucide-react`: For icons (e.g., ExternalLink, Tag).
- `tailwind-merge` / `clsx`: For dynamic class handling (if needed).

## 5. Success Criteria
- [ ] Section displays all 20 specified programs.
- [ ] Layout matches the 3-column desktop / 1-column mobile requirement.
- [ ] Glassmorphism and Neon hover effects are visible and smooth.
- [ ] No layout shifts or responsiveness issues.
- [ ] Component is integrated into `page.tsx` after Features.

## 6. Questions
- Should the "Signup link" be a real functional link or a placeholder (`#`)? (Assuming placeholder `#` for now unless specified).
- Are there specific icons required for each category? (Will use generic category icons if not specified).
