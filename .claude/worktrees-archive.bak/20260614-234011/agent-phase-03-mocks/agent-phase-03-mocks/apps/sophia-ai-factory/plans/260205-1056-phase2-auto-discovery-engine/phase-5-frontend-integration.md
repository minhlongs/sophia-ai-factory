# Phase 5: Frontend Integration
**Status:** Pending
**Priority:** Medium

## Overview
Build the User Interface for the Discovery Engine within the Sophia AI Factory app.

## Components

### 1. Discovery Dashboard (`/discovery`)
- **Search Bar:** Large, central.
- **Filters Sidebar:** Range sliders for Commission, Checkboxes for Networks.
- **Results Grid:** Cards showing Product Image, Title, SPS Score (Visual Badge), Commission, Network Icon.

### 2. Product Card
- **Visuals:** Thumbnail, "Hidden Gem" badge if applicable.
- **Metrics:** Display "SPS: 92/100", "Est. Earn: $45".
- **Actions:** "Generate Content" (Links to Sophia's content generation), "Save to Favorites".

### 3. "Top 50" View
- Dedicated layout for the Option B curated list.
- Ranking numbers (1-50).
- Trend indicators (Up/Down arrows).

## Implementation Steps
1.  [ ] Create `src/app/dashboard/discovery/page.tsx`.
2.  [ ] Build `ProductCard` component.
3.  [ ] Build `SearchFilters` component.
4.  [ ] Connect to `/api/discovery/search`.
5.  [ ] Implement "Save" functionality (connect to User's saved lists).

## Success Criteria
- [ ] User can search and filter products.
- [ ] "Generate Content" button works (passes product context to AI).
- [ ] UI is responsive and follows design system (Tailwind).
