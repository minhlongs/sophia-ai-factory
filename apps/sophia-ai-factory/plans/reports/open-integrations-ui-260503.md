# Open Integrations UI — Report 260503

## Tier Gates Removed
None found. All `/dashboard/integrations` pages already gate only on `!user → redirect('/auth/login')`. No PREMIUM/ENTERPRISE tier checks existed. The string `tier: 'PREMIUM'` at `webhooks/docs/page.tsx:62` is payload example data only.

## Main Nav Changes
**File:** `src/app/[locale]/dashboard/layout.tsx`
- Hardcoded `"MCU Credits"` → `{t('sidebar.credits')}` (line ~141)
- Hardcoded `"Integrations"` → `{t('sidebar.integrations')}` (line ~148)
- Added Webhooks subnav entry (indented, w/ "NEW" badge) linking `/dashboard/integrations/webhooks`
- Added BYOK subnav entry (indented) linking `/dashboard/byok`
- Hardcoded `"Provider Keys / BYOK"` removed from top-level nav (now subnav under Integrations)
- `"API Keys"` kept as top-level item (separate from BYOK)
- Net: +12 lines, layout stays 312 LOC

## Integrations Page Restructure
**Files modified/created:**
- `src/app/[locale]/dashboard/integrations/page.tsx`: 203 → 108 LOC (rewrite into category-sectioned layout)
- `src/app/[locale]/dashboard/integrations/integration-card.tsx`: NEW, 85 LOC

Sections:
- **Channels:** YouTube, TikTok, Instagram (beta), Pinterest, LinkedIn, Zalo (coming soon + NEW badge)
- **Webhooks:** Outbound Webhooks card → `/dashboard/integrations/webhooks` (NEW badge)
- **Affiliate Networks:** Impact, PartnerStack (beta), Binance/Bybit/Bitget/Coinbase (coming soon)
- **BYOK:** OpenRouter, ElevenLabs, D-ID → `/dashboard/byok`

Each card shows: name, status badge, optional NEW badge, connected/not-connected state, action CTA.

## i18n Keys Added
- `dashboard.integrations.*`: 23 keys (page_title, page_subtitle, 4 section pairs, statuses, buttons, badges, info)
- `dashboard.sidebar.*`: 4 keys (integrations, byok, webhooks, credits)
- **Total: 27 keys × 2 locales = 54 entries**
- Both `messages/en.json` and `messages/vi.json` updated, JSON valid.

## TypeScript Check
- `npx tsc --noEmit`: 0 new errors in modified/created files
- 2 pre-existing errors in `src/lib/affiliates/scout/client-impact-radius.ts` and `src/app/api/v1/integrations/affiliate-networks/route.ts` — unrelated, existed before this change

## Skipped / Notes
- Webhooks page (`/dashboard/integrations/webhooks`) already accessible to all — no change needed
- Mobile nav (`MobileNav` component) not modified — it renders from separate config, integrations already accessible
- No new deps added
- BYOK/webhook business logic untouched
