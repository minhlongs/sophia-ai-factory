# Sophia Revenue Pipeline — Reality Check Synthesis

**Date:** 2026-04-27 02:50 PT
**Audit scope:** End-to-end campaign pipeline + revenue observability + affiliate attribution
**Verdict:** 🔴 **PRODUCT DOES NOT EARN REVENUE TODAY.** Tech debt = 0. Revenue = $0.

---

## Executive summary

Hardening tracks (B2 / Phase 17 / T2 / T3 / L1 / P49 / Doc-Sync) đóng. Code clean. CI GREEN. Tests pass. **Nhưng nếu user thật trả USDT hôm nay rồi /campaign, họ sẽ:**

1. Hit `campaigns` table missing → DB insert fail → pipeline chết trước Inngest step đầu tiên.
2. Nếu (1) fix → ServiceFactory auto-mock returns fake video, user trả tiền nhận output bịa.
3. Nếu (2) fix → video không chứa affiliate link (description hardcoded generic text).
4. Nếu (3) fix → click không được track (no `/api/r/[code]` redirect endpoint).
5. Nếu (4) fix → conversion không attribute (ShareASale adapter stub, không có webhook handler).
6. Nếu (5) fix → user wallet không có cơ chế nhận commission (no payout logic).

**6 gaps chí mạng, mỗi gap đều block revenue. Không phải tech debt — là feature missing.**

---

## Top 3 critical blockers (revenue-prioritized)

### 🔴 BLOCKER #1 — `campaigns` D1 table missing
- **File:** `src/lib/inngest/functions/generate-campaign.ts` insert into D1 `campaigns`; migrations folder không có table này
- **Impact:** Pipeline crash on first DB write. 0% campaigns can complete.
- **Fix effort:** ~2h (write migration + verify FK to users/licenses + apply via wrangler)

### 🔴 BLOCKER #2 — Auto-mock silence mode
- **File:** `src/lib/services/factory.ts` (ServiceFactory) — when API keys absent, silently returns mock data with `success: true`
- **Impact:** User pays → "success" UI → fabricated video. Fraud risk + churn.
- **Fix effort:** ~4h (kill mock fallback in production env, throw `MissingCredentialsError`, surface to user)

### 🔴 BLOCKER #3 — Affiliate link never reaches video
- **File:** `src/lib/ai/script-prompt-builders.ts` — affiliate link injection NOT implemented; description in `generate-campaign.ts:104` hardcoded `"AI-generated video content for ${audience}"`
- **Impact:** Even if video succeeds, no monetization vehicle in output.
- **Fix effort:** ~1 day (offer selector in /campaign UX + short-link generator + inject CTA into script + description)

---

## Full gap matrix

| # | Stage | Status | File evidence | Revenue blocker? |
|---|-------|--------|---------------|------------------|
| 1 | Affiliate offer discovery (ClickBank) | ✅ Works | `src/lib/inngest/functions/auto-discover-affiliates.ts` | No |
| 2 | Affiliate offer storage | ✅ Works | `affiliate_products` D1 table | No |
| 3 | User selects offer per campaign | ❌ Missing | No UI/API for selection | YES |
| 4 | Link injection into script/description | ❌ Missing | `script-prompt-builders.ts` lacks link logic | YES |
| 5 | Short-link generation w/ tracking ID | ❌ Missing | No redirect handler in `src/app/api/` | YES |
| 6 | Click tracking | ❌ Missing | No `affiliate_clicks` table or endpoint | YES |
| 7 | Conversion webhook (ShareASale/CJ/Awin) | ❌ Stub | Adapter empty | YES |
| 8 | Conversion attribution → user | ❌ Missing | No linking table campaign↔conversion | YES |
| 9 | Payout calculation/wallet | ❌ Missing | No revenue-share config | YES |
| 10 | `campaigns` D1 table | ❌ Missing | Not in `migrations/` | YES (pipeline crash) |
| 11 | `raas_licenses` D1 table | ❌ Missing | Only Supabase migration | YES (revenue endpoint 500) |
| 12 | API key env vars in wrangler.toml | ❌ Missing | OPENROUTER_API_KEY, ELEVENLABS_API_KEY, HEYGEN_API_KEY, NOWPAYMENTS_* not set | YES (forces mock mode) |
| 13 | Telegram bot @Sophia_Bbot live | ⚠️ Unverified | Webhook handler exists, no production confirmation | Possibly |
| 14 | NOWPayments IPN webhook tested live | ⚠️ Unverified | Handler exists, no production confirmation of receipt | YES (no money in) |

---

## Recommended fix sequence (revenue-first, not code-quality first)

### Sprint M (Money) — minimum viable revenue path (~1 week)

**Phase M1 — Unblock pipeline (~1 day)**
1. Create `campaigns` D1 migration + apply (Blocker #1)
2. Create `raas_licenses` D1 migration + apply (Track 2 finding)
3. Set production env vars in wrangler.toml + Cloudflare Secrets: OPENROUTER_API_KEY, ELEVENLABS_API_KEY, HEYGEN_API_KEY, NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, TELEGRAM_BOT_TOKEN, INNGEST_*

**Phase M2 — Kill auto-mock fraud (~0.5 day)**
4. ServiceFactory: throw `MissingCredentialsError` in production when key absent (Blocker #2)
5. Inngest function: catch + notify user via Telegram with refund offer

**Phase M3 — Connect affiliate link to revenue (~3 days)**
6. Add `affiliate_offers_selected` table linking campaign↔offer
7. Add offer selector to /campaign Telegram flow + Setup Wizard
8. Build short-link service: `/api/r/[code]` → log click → 302 redirect to merchant
9. Inject affiliate CTA into script-prompt-builder (1 link in voiceover + description)
10. Schema: `affiliate_clicks` (clickId, campaignId, userId, timestamp, ip_hash) + `affiliate_conversions` (conversionId, clickId, amount, commission, payout_status)

**Phase M4 — Receive money (~1 day)**
11. ShareASale postback handler (or Amazon Associates report poller — easier MVP)
12. Match conversion → click → campaign → user
13. Calculate commission (e.g., 70% to user, 30% to Sophia)

**Phase M5 — Pay user (~1 day)**
14. Wallet balance accumulator
15. Manual payout MVP (admin approves via dashboard) — automated wallet later

**Total Sprint M: ~6.5 days for first dollar earned by a real user.**

### Sprint O (Observability) — see what's happening (~1 day)

16. Public revenue dashboard: total revenue, active licenses, campaigns this week, conversions
17. Per-user wallet endpoint: balance, pending, paid out
18. Webhook receipt confirmation: log every NOWPayments IPN to a queryable table

---

## Recommendation

**Stop closing tech debt. Start shipping revenue path.**

Anh có 2 options:
- **Option A — Sprint M (revenue-first, ~1 week):** Fix 14 items above to make the FIRST dollar happen. Hardening goes on hold.
- **Option B — Continue hardening:** Keep modularizing, demote logger calls, refactor. Product remains $0/mo.

Brutal honest: Option B = polishing a car with no engine. Option A = build the engine.

---

## Unresolved questions

1. **Are there ANY production payments received?** Cannot verify without DB access. Suggest: query Cloudflare D1 dashboard for `payment_events` row count.
2. **Is Inngest actually deployed?** Inngest needs cloud account or self-hosted instance — Cloudflare Workers can't host long-running Inngest dev server. Where is it running?
3. **Is @Sophia_Bbot Telegram webhook URL configured pointing at production?** Need: `curl https://api.telegram.org/bot$TOKEN/getWebhookInfo`
4. **Affiliate network choice for MVP** — ShareASale (postback complex), Amazon Associates (poll-based, easier), ClickBank (already discovered)? Picks affect Sprint M3.
5. **Revenue-share split** — 70/30? 80/20? Tier-dependent? Affects Phase M4/M5 design.

---

## Source reports

- Track 1 (E2E pipeline): `plans/reports/researcher-260427-0250-track-01-e2e-pipeline-audit.md`
- Track 2 (Revenue visibility): `plans/reports/researcher-260427-0250-track-02-revenue-visibility-audit.md`
- Track 3 (Affiliate attribution): `plans/reports/researcher-260427-0250-track-03-affiliate-attribution-audit.md`
