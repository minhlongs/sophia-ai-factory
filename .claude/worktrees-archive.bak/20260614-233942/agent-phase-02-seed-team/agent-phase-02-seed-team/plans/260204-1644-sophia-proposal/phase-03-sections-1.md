# Phase 3: Core Sections Implementation (Part 1)

## Context
Implement the visual-heavy top sections of the landing page. Focus on storytelling and "wow" factor.

## Sections

### 1. Hero Section
- **Content:**
    - Headline: "Nền Tảng Video AI + Affiliate Marketing"
    - Subheadline: "Tự động sản xuất video, phân phối đa kênh, thu nhập thụ động"
    - Stats: $80/tháng, 30 videos, 95% saving, <15 mins.
    - CTA: "Xem Báo Giá" (scroll to #pricing).
- **Design:** Large gradient text, background grid/glow effects, perhaps a mock terminal or abstract 3D shape (if easy, otherwise nice CSS gradient blobs).

### 2. Workflow Diagram
- **Content:** Visualization of: Telegram -> OpenClaw -> n8n -> AI Tools -> Platforms.
- **Design:**
    - Interactive or animated flow.
    - Use icons for tools (OpenAI, ElevenLabs, etc.).
    - Connecting lines (SVG) that animate/pulse.

### 3. Features Matrix
- **Content:** Table comparing Minimal, Standard, Scale tiers.
- **Data:** See Mission Brief Features Matrix.
- **Design:**
    - Responsive table (scrollable on mobile or stacked cards).
    - Checkmarks (✅) and X marks (❌).
    - Highlight "Standard" column.

### 4. Tech Stack
- **Content:** Logos of OpenClaw, n8n, OpenRouter, ElevenLabs, D-ID, Pictory, Airtable, Cloudinary.
- **Design:** Grid layout, grayscale logos that colorize on hover.

## Implementation Steps

1.  Create `app/components/sections/Hero.tsx`
2.  Create `app/components/sections/Workflow.tsx`
3.  Create `app/components/sections/Features.tsx`
4.  Create `app/components/sections/TechStack.tsx`
5.  Assemble in `app/page.tsx`.

## Success Criteria
- [ ] Hero section grabs attention.
- [ ] Workflow is clear and visually appealing.
- [ ] Features table is readable on mobile.
- [ ] Tech stack logos are present.
