---
title: "Phase 5: Frontend Integration"
description: "Building the 'Top 50' Dashboard and high-conversion UI."
status: completed
priority: P2
effort: 1 week
tags: [phase5, frontend, ui, ux]
created: 2026-02-05
---

# Phase 5: Frontend Integration (兵勢 - Energy)

**Goal:** Visualize the "Sophia Index" in a way that feels like a "Superpower" for the user. High-density, actionable data.

**Context:**
- **Binh-Pháp Principle:** "Energy may be likened to the bending of a crossbow; decision, to the releasing of a trigger."
- **Focus:** Data visualization, filtering, "Gem" highlighting.

## Key Insights
- **"Bloomberg Terminal" Vibe:** Users paying $1,200 want density and precision, not whitespace and fluff.
- **Badges:** Visual cues for "Gem", "Trending", "New" are critical for quick scanning.

## Requirements

### Functional
1.  **Top 50 Grid/List:** Sortable columns (SPS, Commission, Velocity).
2.  **Filter Sidebar:** Slider for Min SPS, Categories, Price Range.
3.  **Product Detail Modal:** Velocity chart, Description, "Get Link" button.

### Non-Functional
1.  **Interaction Speed:** Instant filtering (client-side for Top 50).
2.  **Responsiveness:** Works on Desktop (primary) and Tablet.

## Architecture: UI Components

- **`DiscoveryDashboard`:** Main container.
- **`ProductCard`:** High-density card showing thumbnail, SPS badge, Sparkline (velocity).
- **`FilterPanel`:** Faceted search controls.
- **`GemBadge`:** Animated or distinct visual indicator.

## Implementation Steps

1.  **Component Scaffolding:**
    - Create `ProductCard`, `GemBadge` using Tailwind.
    - Implement Skeleton loaders.

2.  **State Management:**
    - Use URL-based state (search params) for shareable filter views.
    - Integrate TanStack Query for data fetching.

3.  **Visualization:**
    - Add simple sparkline chart (Recharts or SVG) for 30-day Gravity trend.

4.  **Polish:**
    - Tooltips explaining "SPS Score".
    - "Copy Link" clipboard interaction.

## Resource Allocation
- **Backend (0%):** Done.
- **Frontend (100%):** React components, CSS, State.

## Victory Metrics
- **LCP:** < 1.5s for Dashboard.
- **CLS:** 0 (Skeleton loading).
- **UX:** User can filter to "Health Gems > $50" in < 3 clicks.

## Risk Assessment
- **Risk:** Information Overload.
- **Mitigation:** Progressive disclosure. Show SPS/Price first, expand for Description/History.
