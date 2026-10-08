# Research: Comment-to-DM Trigger Router, Conversational Closer & Attribution Ledger

**Project:** Sophia AI Factory | **Layer:** Land & Forest Orchestration | **Status:** APPROVED  
**Doctrine Alignment:** BYOK, Cloudflare Workers + D1, Serverless Inngest, Web Crypto HMAC, YAGNI/KISS/DRY.

---

## 1. Architectural Overview & Component Fit
- **Comment-to-DM Router (`forest/comment-router`):** Ingests comment webhooks (TikTok Webhooks, IG Graph API, YouTube PubSub/Webhook), matches intent keywords (`ib`, `link`, `giá`, `deal`, `tư vấn`), throttles rate-limits, and dispatches outbound DM via channel adapters (Telegram Bot API, IG Messaging Graph API, WhatsApp Cloud API).
- **Conversational Affiliate Closer (`land/conversational-closer`):** LLM sales state machine (OpenRouter / Claude Haiku / GPT-4o-mini) handling objections (pricing, legitimacy, feature fit), generating localized shortlinks with sub_id & UTM tags, and rotating scarcity coupons.
- **Lead Conversion & Attribution Ledger (`migrations/0456_lead_attribution_ledger.sql`):** Append-only click-through and postback reconciliation schema on D1, tying comment origin -> lead chat -> shortlink click -> network postback -> commission settlement.

---

## 2. Technical Evaluation & Trade-off Matrix

| Component | Option A (Self-Hosted Edge / D1) | Option B (External SaaS: ManyChat/Zapier) | Fit / Choice |
|---|---|---|---|
| **Comment Trigger Ingestion** | Cloudflare Worker Webhook + KV Rate Limiter | ManyChat Pro Webhook Rules | **Option A**: Avoids 3rd-party recurring fees; obeys BYOK; native D1 audit trail |
| **Outbound Messaging Gateway** | Direct REST API (Meta Graph v20.0 + Telegram Bot API) | Twilio Conversations SDK | **Option A**: Zero SDK bloat; pure `fetch()` with circuit-breaker from `@/seed/security` |
| **Sales Agent Reasoning** | Edge LLM prompt via OpenRouter BYOK (Haiku / 4o-mini) | LangChain / Flowise agent orchestration | **Option A**: Fits 128KB edge memory; sub-500ms latency; no heavy Python/Node runtime |
| **Attribution Storage** | Cloudflare D1 with compound indices + Web Crypto SHA-256 | External ClickHouse / Supabase | **Option A**: Single synchronous DB client (`createServerClient()`); strict ACID within D1 limits |

### Credibility & Source Verification:
1. *Meta Graph API Webhooks & Messaging Docs (v20.0)*: Validated 24-hr messaging window for Instagram DM & WhatsApp Cloud API.
2. *TikTok for Business Webhook Specification (2026)*: Webhook `comment.create` delivery with HMAC-SHA256 signature verification.
3. *Cloudflare Workers Runtime API*: Zero Node crypto; requires Web Crypto SubtleCrypto (`crypto.subtle.digest`, `verify`).

---

## 3. Component 1: Comment-to-DM Trigger Router

### Intent Matching & Normalization Engine:
- Regex tokenization normalizing Vietnamese diacritics and slang:
  - Patterns: `/(?:^|\s)(?:ib|inbox|link|gi[aá]|deal|mua|h[oỏ]i|t[uư]\s*v[aấ]n|xin\s*link)(?:$|\s|[!?.,])/i`
- Idempotency & De-duplication: KV key `comment_seen:{platform}:{comment_id}` TTL 86400s prevents duplicate trigger storms.
- Fan-Out Routing Logic:
  - If commenter has DM-open permission (Instagram/TikTok Business): Direct outbound DM with deep-link CTA.
  - If platform forbids cold DM without mutual follow: Automated reply comment with t.me deep-link (`https://t.me/Sophia_Bbot?start=c_{campaignId}_{videoId}_{commentId}`).

---

## 4. Component 2: Conversational Affiliate Closer (LLM FSM)

### Finite State Machine (FSM):
1. `GREETING_QUALIFY`: Acknowledge product inquiry, ascertain buyer intent (niche, use case, budget).
2. `OBJECTION_HANDLING`: Address price resistance, platform safety, or feature doubts using structured offer context.
3. `LINK_DISPATCH`: Emit tailored affiliate shortlink with dynamic parameters (`utm_source={platform}&utm_medium=dm&sub_id={lead_id}`).
4. `FOLLOWUP_NUDGE`: Inngest delayed event (24h) checking conversion status; sends urgency voucher if unclicked.

### Anti-Ban & Compliance Safeguards:
- Human-like typing delay jitter (1.2s - 3.5s).
- Dynamic message variation avoiding duplicate message blocks on Meta/TikTok.
- Mandatory Opt-Out keyword detection (`stop`, `huỷ`, `ngưng`) setting `lead.opted_out = 1`.

---

## 5. Component 3: D1 Database Schema & Ledger

```sql
-- D1 Migration: Lead Attribution & Conversational Closer Ledger
CREATE TABLE IF NOT EXISTS dm_leads (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('tiktok', 'instagram', 'youtube', 'telegram', 'whatsapp')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  source_video_id TEXT,
  source_comment_id TEXT,
  initial_intent TEXT,
  funnel_state TEXT NOT NULL DEFAULT 'NEW' CHECK(funnel_state IN ('NEW', 'QUALIFIED', 'LINK_SENT', 'CLICKED', 'CONVERTED', 'LOST', 'OPTED_OUT')),
  assigned_offer_id TEXT REFERENCES affiliate_offers(id),
  lead_score INTEGER NOT NULL DEFAULT 10,
  opted_out INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS dm_conversion_ledger (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES dm_leads(id),
  offer_id TEXT NOT NULL REFERENCES affiliate_offers(id),
  click_id TEXT UNIQUE NOT NULL,
  sub_id TEXT NOT NULL,
  utm_campaign TEXT,
  affiliate_network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED')),
  payout_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  postback_payload TEXT,
  converted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_dm_leads_plat_user ON dm_leads(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_leads_funnel ON dm_leads(funnel_state);
CREATE INDEX IF NOT EXISTS idx_dm_ledger_subid ON dm_conversion_ledger(sub_id);
CREATE INDEX IF NOT EXISTS idx_dm_ledger_click ON dm_conversion_ledger(click_id);
```

---

## 6. Adoption Risks, Mitigations & Concrete Recommendation

### Adoption Risks:
1. **Platform API Policy Suspension:** Meta & TikTok enforce strict anti-spam policies on automated DM unsolicited outreach.  
   *Mitigation:* Default to Telegram Bot t.me bridge links for comment replies where direct DM APIs are restricted.
2. **Postback Discrepancy / Cookie Stripping:** Mobile in-app browsers stripping UTM / click parameters.  
   *Mitigation:* Use Server-to-Server (S2S) click IDs stored in D1 shortlinks passed through `sub_id`.

### Ranked Recommendations:
1. **Rank 1 (Immediate implementation):** Telegram-centric Bridge & Inngest Dispatcher. Route TikTok/IG comments to reply comment inviting user to `@Sophia_Bbot?start=c_{offerId}` where Conversational Closer executes with 100% policy safety.
2. **Rank 2 (Follow-up phase):** Meta Graph API Direct Instagram DM Webhook for accounts verified under Meta Business Portfolio.
3. **Rank 3 (Deferred):** WhatsApp Cloud API (requires per-conversation message template fee, violates lean BYOK model).

### Limitations & Unresolved Questions:
- TikTok direct Private Messaging API for non-enterprise accounts remains in restricted alpha; verified Webhook Comment trigger + Telegram bridge is mandatory fallback.
- Unresolved: Will client provide a dedicated Meta Graph App with `instagram_manage_messages` permission, or solely rely on Sophia's Telegram Sales bot?
