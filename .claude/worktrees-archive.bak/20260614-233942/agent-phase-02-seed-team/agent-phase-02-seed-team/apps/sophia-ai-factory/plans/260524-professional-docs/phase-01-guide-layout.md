# Phase 01: Guide Layout Restructure

**Priority:** HIGH | **Impact:** Professional docs structure
**Status:** TODO

## Problem
- Guide sidebar has 2 sections (HƯỚNG DẪN + THAM KHẢO) with 7 links — feature-first
- Labels hardcoded in Vietnamese — not i18n'd
- Missing workflow-first sections: Payments, Affiliate, Use Cases, Workspace

## Tasks

- [ ] 1.1 Restructure GUIDE_SECTIONS in layout.tsx to workflow-first 8 sections
- [ ] 1.2 Add i18n keys for all sidebar labels
- [ ] 1.3 Add collapsible section groups (accordion-style)
- [ ] 1.4 Add search input at top of sidebar (UI only, Phase 05 wires logic)

## New Sidebar Structure

```
🚀 Getting Started
  ├── Quick Start (existing /guide)
  ├── How It Works (existing /guide/how-it-works)
  └── Screen Guide (existing /guide/screens)

🎬 Create Content
  ├── Your First Video (/guide/first-video) — NEW
  └── Campaign Templates (/guide/templates) — NEW

💰 Payments & Billing
  ├── USDT Payment (/guide/payments/usdt) — NEW
  ├── VND Bank Transfer (/guide/payments/vnd) — NEW
  └── Plans & Pricing (/guide/payments/plans) — NEW

🤝 Affiliate Program
  └── Earn 70% Commission (/guide/affiliate) — NEW

🔌 Integrations
  ├── Integrations (existing /guide/integrations)
  ├── Telegram Bot (existing /guide/telegram)
  └── Bot Commands (existing /guide/commands)

📚 Use Cases
  ├── CEO Video Marketing (/guide/use-cases/ceo-marketing) — NEW
  ├── E-commerce Videos (/guide/use-cases/ecommerce) — NEW
  └── Real Estate Tours (/guide/use-cases/real-estate) — NEW

❓ Help
  └── FAQ (existing /guide/faq)
```

## Files to Modify
- `src/app/[locale]/guide/layout.tsx` — restructure GUIDE_SECTIONS + i18n
- `messages/en.json` — add guide.sidebar.* keys
- `messages/vi.json` — add guide.sidebar.* keys

## Success Criteria
- Sidebar shows 7 workflow-first sections
- All labels bilingual via next-intl
- Existing guide URLs still work
- Build passes
