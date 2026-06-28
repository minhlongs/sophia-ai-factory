# Phase 08: Vietnam Market Localization

**Priority:** LOW | **Impact:** VN market conversion + local relevance
**Status:** COMPLETE (2026-05-24)

## Problem
- Primary market is Vietnam but product feels generic/international
- No language selector in UI — users must edit URL to switch locale
- No VN-specific social proof or testimonials
- No Zalo integration mention (dominant VN messaging platform)
- Blog has only 3 hardcoded Vietnamese posts
- No VN holiday campaign templates (Tet, Mid-Autumn, National Day)

## Tasks

- [x] 8.1 Add language selector to navbar
      - Toggle between 🇻🇳 Tiếng Việt and 🇺🇸 English
      - Use next-intl's locale switching
      - Persist choice in cookie
      - File: `src/app/components/layout/navbar.tsx`

- [x] 8.2 Add VN-specific testimonials
      - Replace or supplement generic testimonials with VN-context ones
      - Mention platforms VN users care about: TikTok VN, YouTube VN, Zalo
      - Use Vietnamese names (not initials)
      - File: social proof component + i18n

- [x] 8.3 Add VN campaign templates
      - Tet (Lunar New Year) template
      - Mid-Autumn Festival template  
      - Vietnam National Day (Sep 2) template
      - Add to `src/lib/templates/campaign-templates.ts`

- [x] 8.4 Update FAQ with VN-specific questions
      - "How do I pay with VND?" (link to PayOS option)
      - "Can I use Zalo for customer engagement?"
      - "Is there VAT on subscription?"
      - File: FAQ component + i18n

- [x] 8.5 Add Zalo mention in integrations/guide
      - Guide page mentions YouTube/TikTok/Instagram but not Zalo
      - Add Zalo as supported channel in guide
      - File: `src/app/[locale]/guide/integrations/page.tsx` or similar

## Files to Modify
- `src/app/components/layout/navbar.tsx` — language selector
- Social proof component — VN testimonials
- `src/lib/templates/campaign-templates.ts` — VN holiday templates
- FAQ component — VN questions
- Guide integrations page — Zalo mention
- `messages/en.json` + `messages/vi.json` — i18n

## Constraints
- Bilingual (EN + VI)
- Don't break existing locale routing
- Keep testimonial disclaimer ("illustrative and unverified")
- VN holiday campaign templates should use Vietnamese copy with EN translation

## Success Criteria
- Language selector visible in navbar
- VN testimonials with local context
- 3 VN holiday campaign templates added
- FAQ has VN-specific answers
- Build passes
