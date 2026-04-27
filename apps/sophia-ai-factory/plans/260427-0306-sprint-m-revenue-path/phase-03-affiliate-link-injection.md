# Phase M3 — Affiliate Link Injection

## Context Links
- Synthesis: `plans/reports/synthesis-260427-0250-revenue-pipeline-reality-check.md` (Blocker #3, gaps 3-6)
- Track 3: `plans/reports/researcher-260427-0250-track-03-affiliate-attribution-audit.md` (Stages 2-4 missing)
- Source code: `apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign.ts:104` (hardcoded description)
- Source code: `apps/sophia-ai-factory/src/lib/ai/script-prompt-builders.ts` (no CTA logic)
- Source code: `apps/sophia-ai-factory/src/lib/affiliates.ts` (program data loader, JSON-backed)
- Source code: `apps/sophia-ai-factory/src/lib/telegram/telegram-bot-campaign-handlers.ts:27` (campaign entry)

## Overview
- **Priority:** P1 (BLOCKER — even with real video, no monetization vehicle in output)
- **Status:** pending
- **Effort:** ~3 days (largest phase)
- **Description:** Add offer selector to /campaign Telegram flow + persistence in `affiliate_offers_selected` + short-link generator at `/api/r/[code]` + click logger writing `affiliate_clicks` + script-prompt-builder injects affiliate CTA into voiceover + description.

## Key Insights
- `affiliates.ts` reads from static JSON (`@/data/affiliate-programs.json`) — sufficient for MVP offer selection; no need to query D1 `affiliate_products` table yet
- Telegram FSM exists (`telegram-fsm-state-manager.ts`) — reuse for multi-step /campaign flow (topic → audience → offer → confirm)
- Short-link `/api/r/[code]` runs as Cloudflare Worker edge route — log click to D1 then 302 to merchant URL
- Click code = base32(8 bytes random) → ~13 chars URL-safe; collision prob negligible
- ip_hash uses SHA256(ip + daily_salt) for GDPR-friendly fingerprinting (no raw IP stored)
- Script CTA injection happens at prompt-build time so LLM weaves it naturally; description includes raw short-link

## Requirements

### Functional
- D1 schema: `affiliate_offers_selected` (link campaign↔offer + short-link code) + `affiliate_clicks` (click log)
- Telegram /campaign flow extended: after topic+audience, present top 3 offers (by EPC, tier-filtered) with inline keyboard → user picks → store selection
- Web `/dashboard/campaigns/new` form: add `<select>` with same offer list (same `affiliates.getTopPrograms` source)
- Short-link API: `GET /api/r/[code]` → look up `affiliate_offers_selected.short_code` → log click (`ip_hash`, `user_agent`, `referer`) → 302 redirect to `affiliate_link`
- `script-prompt-builders.ts` accepts optional `affiliateOffer` param → injects CTA line into prompt: "End with: 'Get {productName} here: {shortUrl}'"
- `generate-campaign.ts:104` description: append `\n\n👉 {shortUrl}` (one link per video; not multiple)
- Failed click lookup → 302 to homepage (don't 404; bad UX for share)

### Non-Functional
- Short-link response time <50ms p95 (D1 indexed lookup)
- Click logging is fire-and-forget (don't block redirect on insert)
- Code uniqueness enforced by UNIQUE constraint
- ip_hash respects GDPR (one-way + daily salt rotation)
- Files <200 LOC each per dev-rules
- Zero `:any` types; Zod validation on form input

## Architecture

### Data Flow
```
User /campaign topic="weight loss" → Telegram FSM
  → bot: "Pick offer:" [PhenQ €120/sale] [LeanBiome €80/sale] [Java Burn €60/sale]
  → user taps PhenQ
  → bot generates shortCode="r3kl9pq2"
  → INSERT affiliate_offers_selected (campaignId, offerId="phenq", shortCode, affiliateLink)
  → bot: "Confirm? [Yes] [Cancel]"
  → user confirms → INSERT campaigns (with status='queued')
  → inngest.send('campaign.created', {campaignId, ..., shortUrl: "https://sophia.agencyos.network/r/r3kl9pq2"})

Inngest generate-campaign:
  → ServiceFactory.getScriptService().generateScript({topic, audience, tier, affiliateOffer: {productName, shortUrl}})
  → script CTA injected
  → voiceover narrates CTA
  → description = `AI-generated video for ${audience}\n\n👉 ${shortUrl}`
  → distribute to YouTube/TikTok with description containing short-link

Viewer clicks short-link in description:
  GET /api/r/r3kl9pq2
  → SELECT affiliate_link, campaign_id, user_id, offer_id FROM affiliate_offers_selected WHERE short_code='r3kl9pq2'
  → INSERT affiliate_clicks (clickId, campaignId, userId, offerId, ipHash, userAgent, referer, ts)
  → 302 to https://[vendor].hop.clickbank.net/?tid={clickId}  // tid for ClickBank attribution
```

### Schema designs

#### `migrations/0020-affiliate-offers-selected.sql`
```sql
CREATE TABLE IF NOT EXISTS affiliate_offers_selected (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,                  -- maps to affiliate-programs.json id
  offer_name TEXT NOT NULL,                -- denormalized for click-time speed
  affiliate_link TEXT NOT NULL,            -- raw merchant URL with affiliate ID
  short_code TEXT NOT NULL UNIQUE,         -- 8-13 char URL-safe
  network TEXT NOT NULL DEFAULT 'clickbank' CHECK (network IN ('clickbank','shareasale','amazon','manual')),
  commission_rate REAL,                    -- snapshot at selection time
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_affoff_campaign ON affiliate_offers_selected(campaign_id);
CREATE INDEX IF NOT EXISTS idx_affoff_user ON affiliate_offers_selected(user_id);
CREATE INDEX IF NOT EXISTS idx_affoff_short_code ON affiliate_offers_selected(short_code);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  click_id TEXT NOT NULL UNIQUE,           -- separate UUID exposed as ClickBank tid
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT NOT NULL,
  short_code TEXT NOT NULL,
  ip_hash TEXT,                            -- SHA256(ip + daily_salt) — no raw IP
  user_agent TEXT,
  referer TEXT,
  country TEXT,                            -- CF-IPCountry header
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON affiliate_clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign ON affiliate_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON affiliate_clicks(created_at DESC);
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/lib/telegram/telegram-bot-campaign-handlers.ts` — extend `handleCampaign` to multi-step FSM (topic → audience → offer pick); use `telegram-fsm-state-manager.ts`
- `apps/sophia-ai-factory/src/lib/inngest/functions/generate-campaign.ts:104` — change description from hardcoded to `${baseDesc}\n\n👉 ${shortUrl}`; pass `affiliateOffer` into ServiceFactory.getScriptService context
- `apps/sophia-ai-factory/src/lib/ai/script-prompt-builders.ts:26` — extend `buildScriptUserPrompt` with optional `affiliateOffer?: {productName, shortUrl}` param; inject CTA into prompt
- `apps/sophia-ai-factory/src/lib/services/types.ts` — extend `IScriptService.generateScript` input with `affiliateOffer?` field
- `apps/sophia-ai-factory/src/lib/services/real/script-service.ts` — pass `affiliateOffer` to prompt builder
- `apps/sophia-ai-factory/src/lib/campaigns/create-campaign-core.ts` — accept `offerId` in event payload
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/components/create-campaign/campaign-form.tsx` — add offer dropdown
- `apps/sophia-ai-factory/src/app/actions/campaigns.ts` — accept `offer_id` formData; INSERT `affiliate_offers_selected` row + generate `short_code`

### Create
- `apps/sophia-ai-factory/migrations/0020-affiliate-offers-selected.sql`
- `apps/sophia-ai-factory/src/app/api/r/[code]/route.ts` — short-link redirect handler (<100 LOC)
- `apps/sophia-ai-factory/src/lib/affiliate-shortlink/short-code-generator.ts` — base32 8-byte → 13-char (<40 LOC)
- `apps/sophia-ai-factory/src/lib/affiliate-shortlink/click-logger.ts` — fire-and-forget D1 insert (<60 LOC)
- `apps/sophia-ai-factory/src/lib/affiliate-shortlink/ip-hash.ts` — SHA256(ip + daily_salt) (<30 LOC)
- `apps/sophia-ai-factory/src/lib/telegram/telegram-bot-offer-picker.ts` — inline keyboard builder for offer selection (<120 LOC)
- `apps/sophia-ai-factory/src/lib/telegram/telegram-bot-campaign-fsm.ts` — multi-step state machine (<150 LOC)
- Tests: `short-code-generator.test.ts`, `click-logger.test.ts`, `route.test.ts` (short-link redirect)

### Delete
- None

## Implementation Steps
1. Write `migrations/0020-affiliate-offers-selected.sql` + apply local + remote
2. Create `short-code-generator.ts`: `generateShortCode(): string` returns 13-char base32 from 8 random bytes; collision-retry loop (max 3) on UNIQUE failure
3. Create `ip-hash.ts`: `hashIp(ip: string): string` using SHA256(ip + dailySalt) — daily salt rotation via env `IP_HASH_DAILY_SALT` rotated by cron M5+
4. Create `click-logger.ts`: `logClick(params)` returns immediately; `void` background INSERT; logs error if INSERT fails
5. Create `src/app/api/r/[code]/route.ts`:
   - Parse `code` from params
   - SELECT `affiliate_link, campaign_id, user_id, offer_id` FROM `affiliate_offers_selected` WHERE `short_code=code`
   - If not found → 302 to `/`
   - Generate `clickId = crypto.randomUUID()`
   - Append `?tid=${clickId}` to affiliate_link (ClickBank tid param)
   - Call `logClick({clickId, campaignId, userId, offerId, ip: req.headers.get('cf-connecting-ip'), ua: req.headers.get('user-agent'), referer, country: req.headers.get('cf-ipcountry')})`
   - 302 redirect
6. Extend Telegram FSM:
   - `handleCampaign(chatId, topic)` enters state `awaiting_audience`
   - On audience reply, fetch `getTopPrograms(3, userTier)` → send inline keyboard with 3 buttons
   - On callback_query with `offer_id`, INSERT `affiliate_offers_selected` + create campaign + send Inngest event
7. Update `script-prompt-builders.ts`:
   ```ts
   export function buildScriptUserPrompt(
     topic: string, audience: string, affiliateOffer?: {productName: string, shortUrl: string}
   ): string {
     const cta = affiliateOffer
       ? `\n- End scene must include CTA: "Get ${affiliateOffer.productName} now at ${affiliateOffer.shortUrl}"`
       : ''
     return `Create a video script ... Requirements: ${cta}`
   }
   ```
8. Update `IScriptService.generateScript` signature + `RealScriptService` impl
9. Update `generate-campaign.ts`: load `affiliate_offers_selected` row by `campaignId` early; pass `affiliateOffer` into script + use `shortUrl` in description
10. Update `campaign-form.tsx` web UI: fetch offers via Server Action `getOffersForUser()` → render `<select>`
11. Write tests (3 files) + run `npm test`
12. `npm run build` 0 errors
13. Deploy + verify SHA match
14. Manual E2E: /campaign on Telegram → pick offer → wait pipeline → verify YouTube description contains short-link → click short-link → verify D1 `affiliate_clicks` row inserted

## Todo List
- [ ] Apply `migrations/0020-affiliate-offers-selected.sql` local+remote
- [ ] Create `short-code-generator.ts` + tests
- [ ] Create `ip-hash.ts` (with daily salt env)
- [ ] Create `click-logger.ts` + tests
- [ ] Create `src/app/api/r/[code]/route.ts` + tests
- [ ] Extend `script-prompt-builders.ts` with `affiliateOffer` param
- [ ] Update `IScriptService` types + RealScriptService
- [ ] Modify `generate-campaign.ts:104` description to include shortUrl
- [ ] Build Telegram FSM multi-step campaign flow (`telegram-bot-campaign-fsm.ts`)
- [ ] Build offer picker keyboard (`telegram-bot-offer-picker.ts`)
- [ ] Update `campaign-form.tsx` web UI with offer dropdown
- [ ] Update Server Action `createCampaign` to accept `offer_id` + INSERT affiliate_offers_selected
- [ ] `npm test` — all green
- [ ] `npm run build` — 0 errors
- [ ] Deploy + SHA-match verify
- [ ] E2E manual test: Telegram /campaign → offer pick → video generated → short-link in description → click → D1 row appears

## Success Criteria
- /campaign Telegram flow shows 3-offer picker; selection persists to D1
- Web `/dashboard/campaigns/new` has offer dropdown
- Generated video description contains `https://sophia.agencyos.network/r/{code}`
- Generated video voiceover (last scene) speaks the offer CTA naturally
- Hitting `/api/r/{code}` 302-redirects to merchant URL with `?tid={clickId}`
- D1 `affiliate_clicks` row appears within 100ms of redirect
- p95 short-link response time <50ms (Cloudflare Worker edge)
- All existing tests pass + 3 new test files green

## Risk Assessment + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FSM state lost mid-flow (Telegram bot restart) | Med | Med | Use existing `telegram-fsm-state-manager.ts` D1 persistence |
| Short-code collision (low prob, but happens) | Low | Low | Retry loop (max 3) on UNIQUE constraint failure |
| Click insert fails → unattributed conversion downstream | Med | High | Insert is fire-and-forget; logger writes failures to logger; M4 reconciliation can backfill from postback metadata |
| LLM ignores CTA injection (model-dependent) | Med | Med | Description (always present) carries link as fallback even if voiceover fails to mention |
| YouTube/TikTok description char limit (5000/2200) | Low | Low | Short-link adds <50 chars; well within limits |
| GDPR compliance — IP storage | Med | High | ip_hash with daily salt rotation; no raw IP retained |
| Affiliate JSON file outdated → broken merchant link | Med | High | M4 will catch via no-conversion signal; manual JSON refresh process; future Sprint: D1-backed offers |

## Security Considerations
- Short-code is unguessable (8 random bytes = 64 bits entropy) — prevents enumeration attacks
- `ip_hash` with daily salt is one-way; cannot reverse-engineer user identity
- `/api/r/[code]` is PUBLIC endpoint (no auth required) — clicks don't need session
- Rate-limit `/api/r/[code]` per IP (100 req/min) to prevent click-fraud spam — use existing `sql-rate-limiter.ts`
- Affiliate links contain user's affiliate_id (revenue source) — never log full URL with PII params
- ClickBank tid is opaque UUID — does not expose internal user_id
- CSP header allows redirect to external merchant domains via `Content-Security-Policy: ...; default-src 'self'` — verify response is 302 not HTML render
- Validate `short_code` matches `^[a-z2-7]{8,13}$` regex before D1 query (prevent SQL injection via prepared statements + extra defense)

## Next Steps (Dependencies)
- M4 (conversion attribution) requires `affiliate_clicks.click_id` to match ClickBank postback `tid`
- M5 (wallet) requires offer_id + commission_rate snapshot from `affiliate_offers_selected`

## Unresolved Questions
1. Does `getTopPrograms()` return enough variety per niche, or always same top 3? Need niche-aware sort to maximize relevance.
2. Should offer selection be SKIPPABLE (user generates video without affiliate)? MVP says no — offer mandatory; revisit if friction high.
3. Where to host the daily IP hash salt? Cloudflare KV or env var rotated daily? KV preferred (atomic).
4. Should short-links expire after N days (avoid forever-tracking)? MVP: no expiry; revisit at GDPR audit.
5. ClickBank tid param accepts string up to 24 chars — UUID is 36 chars. Truncate to first 24 chars or use 16-byte UUIDv7? Need to check ClickBank docs.
6. Should `description` be localized (VI vs EN) based on user language pref? Defer to Sprint O.
