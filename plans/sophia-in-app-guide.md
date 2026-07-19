# 📖 In-App User Guide — Khách Xem Biết Dùng Ngay

## OBJECTIVE

Convert existing excellent docs/ markdown files into IN-APP documentation pages.
Clients visit `/guide` on the website → beautiful, searchable guide → start using immediately.
No dev knowledge needed. Bilingual Vietnamese + English.

## EXISTING ASSETS (Already Written — Just Need UI)

The `docs/` folder already has:

1. `getting-started.md` — Step-by-step setup guide (bilingual)
2. `user-guide-visual.md` — A-Z screen guide for ALL 14 pages
3. `user-journey-visual-guide.md` — User journey map (ASCII art)
4. `faq.md` — 7-section bilingual FAQ
5. `telegram-bot-guide.md` — Telegram bot usage guide

## PHASE 1: Create /guide Route with Sidebar Navigation

### 1.1 Create Guide Layout

Create `src/app/[locale]/guide/layout.tsx`:

- Sidebar with navigation matching docs sections
- Mobile-responsive (hamburger menu on mobile)
- Match the dark neon theme of landing page
- Sticky sidebar on desktop
- "Back to Dashboard" link at top
- Content area renders markdown with nice typography

### 1.2 Create Guide Pages

Create these pages from existing docs:

| Route                 | Source                         | Content                   |
| --------------------- | ------------------------------ | ------------------------- |
| `/guide`              | `getting-started.md`           | Landing → getting started |
| `/guide/how-it-works` | `user-journey-visual-guide.md` | Journey map               |
| `/guide/screens`      | `user-guide-visual.md`         | All screens A-Z           |
| `/guide/faq`          | `faq.md`                       | FAQ                       |
| `/guide/telegram`     | `telegram-bot-guide.md`        | Telegram bot              |

### 1.3 Guide Page Component

Each guide page should:

- Render markdown content as React components
- Use glass-card styling with readable typography
- Have table of contents (auto-generated from headings)
- Support both Vietnamese and English sections
- Have "Next" / "Previous" navigation at bottom
- Include anchor links for deep linking

## PHASE 2: Add Guide Link to Navigation

### 2.1 Update Navbar

In `navbar.tsx`, add "Guide" / "Hướng Dẫn" link to the public nav:

- Position it between "Pricing" and "Affiliate Programs"
- Points to `/guide`

### 2.2 Add Guide Links to Dashboard

In the dashboard sidebar and onboarding banner:

- Add "📖 User Guide" link
- Link to `/guide` from the help/onboarding section

### 2.3 Add Guide Link to Footer

If there's a footer, add the guide link there too.

## PHASE 3: Content Rendering

### 3.1 Markdown Renderer Component

Create `src/components/guide/markdown-renderer.tsx`:

- Parse markdown content on the server side
- Render headings, tables, code blocks, blockquotes, lists
- Style tables with dark theme (glass effect)
- Style code blocks with syntax highlighting
- Style blockquotes as tip/info cards
- Make all external links open in new tab

### 3.2 Table of Contents Component

Create `src/components/guide/table-of-contents.tsx`:

- Auto-extract headings from content
- Sticky on desktop, collapsible on mobile
- Highlight current section on scroll
- Smooth scroll to section on click

## PHASE 4: Help Button (Fixed Position)

### 4.1 Floating Help Button

Create a floating "?" help button that appears on ALL authenticated pages:

- Fixed bottom-right position
- Opens a help panel with quick links:
  - 📖 User Guide
  - 🚀 Getting Started
  - ❓ FAQ
  - 💬 Telegram Bot

## PHASE 5: Build + Test + Ship

1. `npx next build` — MUST PASS
2. `npx vitest run` — ALL tests pass
3. Verify `/guide` page renders properly with content
4. Verify sidebar navigation works
5. Verify mobile responsive
6. Git commit: `feat(docs): in-app user guide — khách xem biết dùng ngay`
7. Git push to main

## QUALITY GATE

| #   | Criterion                                   | Required |
| --- | ------------------------------------------- | -------- |
| 1   | /guide page renders getting-started content | ✅       |
| 2   | /guide/faq page renders FAQ content         | ✅       |
| 3   | Sidebar navigation works                    | ✅       |
| 4   | "Guide" link in navbar                      | ✅       |
| 5   | Markdown renders tables, lists, links       | ✅       |
| 6   | Mobile responsive                           | ✅       |
| 7   | Dark theme matches landing page             | ✅       |
| 8   | Build passes                                | ✅       |
| 9   | All tests pass                              | ✅       |
| 10  | Committed & pushed                          | ✅       |

## RULES

- Content is ALREADY WRITTEN — do NOT rewrite docs, just render them
- Keep bilingual format (Vietnamese + English side by side)
- Match existing dark neon design system
- Make it accessible — large font, clear CTA, simple navigation
- The guide should work WITHOUT JavaScript for SEO (SSR)
- All content should be hard-coded (NOT fetched from API)
- Read the actual content from the docs/ folder and inline it into the pages
