---
title: "Sophia AI Factory — Group A Promise Wiring Audit Matrix"
date: 2026-05-16
phase: 02
status: complete
input: plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md
phase01_baseline: 4531f6d4
verdict_summary: "21 promises audited (Group A + C) — 8 PASS, 4 FAIL, 9 PARTIAL"
phase02_complete: true
phase03_complete: true
---

# Group A Promise → Code Wiring Matrix

**Scope:** 16 architectural promises from homepage messages → code/DB/external API/tests.
**Method:** static analysis only. No source code modifications. Append-only.
**Verdict legend:** ✅ PASS | ❌ FAIL | ⚠ NEEDS-BUILD | 🟡 PARTIAL

| # | Claim | Route | DB / Config | Ext API | Tests | Verdict | Effort | Pri | Notes |
|---|-------|-------|-------------|---------|-------|---------|--------|-----|-------|

<!-- Rows appended below by Phase 02 audit -->
| P5 | 17 AI commands | `/api/v1/missions` POST | `engine_missions` table | provider-mix (HeyGen, Resend, Whisper, etc.) | command-registry import in route tests | 🟡 PARTIAL | M | P1 | `command-registry.ts` lists exactly 17 commands ✅ but **6/17 are `status: 'beta'` stubs** returning mock data: `lead:find` (Apollo.io pending), `lead:enrich` (Hunter.io pending), `lead:export`, `youtube:publish` (stub if no OAuth), `youtube:list-channels`, `voice:clone` (ElevenLabs pending). Customer paying MCU credits but getting mock — high churn risk. |
| P9 | 50 qualified leads in <60s | mission `lead:generate` via `/api/v1/missions` | `engine_missions`, no leads table | Apollo.io pending (currently stub) | mission-launcher.test.tsx | ❌ FAIL | L | P1 | `daily-lead-enrichment.ts:3` doc says "Enriches 50 leads/**day**" not "<60s". `command-registry` marks `lead:find` and `lead:enrich` as **BETA stubs** — no real Apollo.io/Hunter.io integration. Promise contradicts implementation status. Either downgrade copy or build integration. |
| P10 | Commands via Telegram OR REST API | `/api/v1/missions` (Bearer API key) + `/api/raas/missions` (session) + `/api/webhooks/telegram` | `engine_missions` + Telegram FSM state | — | route tests + telegram-bot tests | 🟡 PARTIAL | M | P2 | REST API ✅ all 17 commands accepted. Telegram bot handles `/start /help /subscribe /discover /pair_list /campaign /status /results /missions /confirm /cancel` (~11 user-facing) but these are **FSM helpers**, not 1:1 direct command access. E.g. customer cannot invoke `voice:clone` directly via TG. NOTE: FSM-only design likely intentional per no-tech doctrine (non-tech CEOs use TG as guided UX, not as command shell) — copy-fix option = clarify "17 commands via REST API; Telegram bot offers guided campaign flow" rather than "17 commands via Telegram OR API". |
| P11 | @Sophia_Bbot live with /campaign /status /results | `/api/webhooks/telegram/route.ts:210-219` | `tg_pairing_tokens`, `engine_missions` | Telegram Bot API | `route.test.ts` exists | ✅ PASS | — | — | All 3 documented handlers present. Bot username referenced in `raas.terminal.cta`. Pairing flow + FSM operational. Note: webhook URL must be registered in BotFather operator config (one-time, doctrine-out-of-scope). |
| P12 | Workflow: select_niche → ai_generate → publish → profit | `workflow.tsx` (marketing copy only) + `telegram-bot-campaign-fsm.ts` (real FSM) + missions + publishing-scheduler | `engine_missions`, `campaigns`, `publishing_jobs` | mixed | fsm tests + mission-launcher tests | 🟡 PARTIAL | M | P2 | `workflow.tsx` is i18n marketing copy, NOT orchestrator. Actual FSM states: `AWAITING_CAMPAIGN_TOPIC → AWAITING_CONFIRMATION → DISCOVERING_TRENDS → CREATING_CAMPAIGN`. Maps loosely but no literal "select_niche/ai_generate/publish/profit" pipeline. "Profit" is marketing concept (no code state). Promise is aspirational, code is fragmented (good fragments). |
| P13 | 5+ YouTube channels from 1 dashboard | `/api/oauth/youtube/connect` + `/api/oauth/youtube/callback` + `youtube-connection-settings.tsx` | `publishing_channels` (multi-platform), `users.api_keys.youtube` (1 refresh_token per user) | YouTube OAuth2 | `youtube-publisher` tests | ❌ FAIL | L | P1 | Settings UI stores **ONE** YouTube `refresh_token` per user under `api_keys.youtube.refresh_token`. UI shows `channelTitle?: string` (single). `publishing_channels` table IS multi-platform (TT, IG, FB, Twitter, etc.) but each platform = 1 account. Strict reading of "5+ YouTube channels" = FALSE. Recommendation: change copy to "5+ social platforms" (matches reality) OR build multi-account YouTube. |
| P14 | Auto-affiliate links inserted into video descriptions | `lib/publishing/youtube-publisher.ts:40` | `affiliate_programs`, video meta | YouTube publish API | publisher tests | ✅ PASS | — | — | Description build: `${adCaption}\n\n${hashtags}${meta.productLink ? \`\n\n${meta.productLink}\` : ''}` — affiliate link appended if `meta.productLink` set. Capped to 5000 chars per YouTube limit. Auto-tracking happens via affiliate engine setting `productLink` upstream. |
| P15 | KOL Voice Cloning (ElevenLabs) | `voice:clone` mission → `handlers/voice-clone.ts` | `engine_missions` | ElevenLabs (NOT wired) | none for real impl | ❌ FAIL | M | P1 | Handler explicitly returns `is_stub: true` with `voice_id: 'stub-voice-preview-001'` and 2-sec mock delay. Real `/v1/voices/add` ElevenLabs call **not implemented**. Charges 10 MCU for stub output. Severe doctrine + customer-trust issue. Customer pays for non-feature. |
| P17 | 24/7 Auto-Publishing | `/api/cron/scheduled-campaigns` + 28 other cron handlers in `src/app/api/cron/` | `publishing_jobs`, `campaigns` | YouTube/TikTok/FB/Twitter/Pinterest publishers | scheduler tests | ✅ PASS | — | — | `wrangler.toml [triggers] crons` has 17 entries including `*/15 * * * *` for scheduled-campaigns. CF Workers = always-on, no idle. Per-channel quota throttle exists (`per-channel-quota.ts`). |
| P18 | Global Reach: translate + localize captions | `lib/i18n/caption-translator.ts:182` `translateCaption()` | KV cache for translations | OpenRouter LLM (BYOK) | caption-translator tests | ✅ PASS | — | — | Wired into `bundle-publisher.ts:157` — auto-translates captions per channel during publish. Geo-aware per-channel rules in `channel-caption-rules.ts`. EN↔VI SOP `auto-subtitle-translate.ts` defined. KV cache prevents redundant LLM cost. |
| P19 | Premium: PartnerStack + Impact.com API + weekly auto-updates | `/api/v1/integrations/affiliate-networks/{network}` + `/api/cron/affiliate-scout` | `affiliate_network_credentials` (BYOK), `affiliate_programs` | PartnerStack + Impact + 7 networks | network validate tests | 🟡 PARTIAL | S | P2 | Both networks integrated ✅ (`/api/v1/integrations/affiliate-networks/route.ts:28` includes both). Tier gating: `IntegrationCard` shows `status="beta"` for PartnerStack. **Cron frequency mismatch:** homepage says "weekly auto-updates" but `affiliate-scout` cron runs **every 4 hours** (`0 */4 * * *`). Either copy fix to "auto-discovery every 4h" OR throttle cron to weekly. |
| P25 | Affiliate DB has SmartSuite 50%, Shopify 200% | `src/data/affiliate-programs.json` via `src/land/affiliates.ts` | JSON (not DB), 20 total programs | — | affiliates module tests | ✅ PASS | — | — | JSON contains both entries exactly as claimed: SmartSuite 50% (recurring, PREMIUM tier), Shopify 200% (with $150 USD bounty per merchant). Note: data is JSON build-time, not DB seed (0032 migration has Shopify but not SmartSuite). Customer reads via barrel import → consistent across runs. |
| P26 | OpenRouter + ElevenLabs + D-ID wired (BYOK) | `tree/byok/resolve-user-api-key.ts:24` + `tree/byok/user-api-key-store.ts:16` (ByokProvider type) | `user_api_keys` D1 (encrypted) | OpenRouter ✅ live, ElevenLabs ⚠ plumbed (stub only — see P15), D-ID ⚠ plumbed (no production handler) | `byok/with-timeout.test.ts` covers all 3 providers | 🟡 PARTIAL | M | P1 | BYOK plumbing complete for all 3 (Setup Wizard `api-keys-step.tsx:66-73`, `byok-key-form.tsx:23`, `user-api-key-store.ts:16`). **OpenRouter** live in `weekly-digest-ai.ts:46` + `caption-translator.ts`. **ElevenLabs** plumbed but reaches only P15 stub handler. **D-ID** plumbed in store + Setup Wizard but grep finds ZERO production `/talks` endpoint call. Avatar-gen for D-ID = absent. Strict "3-API wired": 1/3 fully live, 2/3 plumbed without integration. |
| P27 | Video creation <40min total (5+10+3+15+5) | `lib/heygen/heygen-client.ts` + `cron/video-status-sync` poll every 5min | `videos` table | HeyGen API (real, with BYOK key) | heygen tests + render-status tests | 🟡 PARTIAL | S | P2 | No code-level latency assertion. HeyGen typical render reported 3-10 min by vendor; status-sync cron polls every 5 min so worst-case detection lag is +5 min. Pipeline conceptually fits sub-40-min window IF: (a) script gen <5 min via OpenRouter (depends on prompt), (b) HeyGen render <15 min (depends on length), (c) post-process <5 min. Promise is plausible but unmeasured. Build a stopwatch in Phase 03 perf to verify. |
| P29 | 30-day money-back refund | `/api/refund-requests` (customer) + `/api/admin/refunds` + `land/refunds/refund-repo.ts` + NOWPayments refund TX | `refund_requests` table | NOWPayments refund tx | refund-repo tests + admin refund table tests | 🟡 PARTIAL | S | P1 | End-to-end flow exists ✅: customer requests → admin reviews → refund TX → email notification. **MISSING: 30-day window enforcement** — `createRefundRequest` accepts any age. Customer could request refund after 90 days. Either enforce window in route handler or downgrade copy to "Subject to review". |
| P30 | Tier gating: MCU + campaigns/mo + channels + AI commands + team | `enforce-tier-quota.ts` (video) + `mission-registry` credits + `UNIFIED_TIERS` config | `subscriptions`, `purchases.credits_remaining` | — | tier-quota tests | 🟡 PARTIAL | L | P0 | Enforced ✅: video monthly quota, MCU credits per mission. Config-only ⚠ (no runtime gate found): `team_members` limit, `ai_commands_per_month`, `youtube_channels` count, `campaigns_per_month`. Customer on BASIC tier could in theory connect 5 YouTube channels (UI doesn't block) or run unlimited commands once they have MCU credits. **Security boundary risk:** lower tier could consume PREMIUM-tier features by direct API call. |

### Group C (Performance / Math) — Phase 03 Additions

| # | Claim | Route | DB / Config | Ext API | Tests | Verdict | Effort | Pri | Notes |
|---|-------|-------|-------------|---------|-------|---------|--------|-----|-------|
| P2 | <50ms Response | CF edge (no route) | — | — | — | ❌ FAIL | S | P1 | curl x10 to prod 2026-05-16 from PT: min 166ms, **median 253ms**, max 2218ms. Claim is **5× off**. `hero.trust_response: "<50ms Response"` NOT touched in Phase 01 honest-pivot. Action: copy-fix in Phase 06 → "Edge response" or "<300ms typical". |
| P7 | <60s Mission Execution | `/api/v1/missions` → `dispatcher.ts` → handler | `engine_missions.status` | provider mix | dispatcher tests | 🟡 PARTIAL | — | P2 | Async via Workers `waitUntil`. Stub handlers: 2000ms hardcoded delay ✅. Live LLM missions (proposal/email/analytics): ~5-30s typical OpenRouter call → fits `<60s`. **Exception:** `video:create` returns immediately with `job_id` but full HeyGen render is 3-10 min (status-sync cron polls). Claim "<60s execution" applies to mission **dispatch**, not video render completion. Acceptable IF copy clarifies. |
| P21 | 256-bit Encrypted | — | env `CREDENTIALS_MASTER_KEY` (64 hex = 32 bytes) → `user_api_keys`/`user_provider_credentials` text col `<iv_b64>:<ciphertext_b64>` | Web Crypto API (CF Workers) | encryption tests | ✅ PASS | — | — | `src/tree/credentials/encryption.ts`: **AES-GCM-256**, 12-byte random IV, 16-byte auth tag baked into ciphertext, key from env. Both `CREDENTIALS_MASTER_KEY` (hex) and `BYOK_MASTER_KEY` (base64) supported. In-transit: TLS via CF edge (HSTS 2-year already enforced). 256-bit claim ✅ accurate. |
| P24 | ROI math: $2 CPM + affiliate commissions | `production-cost-calculator.tsx:28,63` | client-side calc | — | calculator tests | ✅ PASS | — | — | `const AD_CPM = 2.0` + formula `adRevenue = (totalViews / 1000) * AD_CPM`. Disclaimer footer: "CPM $2/1K views \| Click-to-sale 5% \| Lead-to-deal 3%". Affiliate commissions tracked separately via `commission-calculator.ts`. Disclosure text correct. |
| P28 | Pricing config match: $199 / $399 / $799 / $4999 + compare $9,588 | `seed/config/tiers/unified-limits.ts:51-106` | — | — | tier-config tests | ✅ PASS | — | — | Config: BASIC `price: 199`, GROWTH `price: 399`, PREMIUM `price: 799`, MASTER `price: 4999`. FAQ text matches ($199/$399/$799/mo). Master `compare_price: $9,588 = 799 × 12` ✓ math correct. Save 48% claim: `(9588-4999)/9588 = 47.87% ≈ 48%` ✓. No drift between landing copy and tier config. |

---

## Summary

**Verdict distribution (21 promises total — Group A + Group C):**

**Group A (architecture, 16):**
- ✅ PASS: 5 — P11 Telegram bot, P14 auto-affiliate inject, P17 24/7 cron, P18 caption translator, P25 SmartSuite+Shopify in DB
- ❌ FAIL: 3 — P9 leads/<60s (claim wrong: "/day" not "/60s"), P13 5+ YouTube (UI single-account), P15 voice clone (full stub)
- 🟡 PARTIAL: 8 — P5 (6/17 stubs), P10 (TG↔API parity by design), P12 (workflow.tsx is i18n only), P19 (cron freq 4h not weekly), P26 (BYOK plumbed, ElevenLabs+D-ID not live), P27 (no benchmark), P29 (no 30-day window enforce), P30 (only video+MCU gated, not team/commands/channels)

**Group C (perf/math, 5):**
- ✅ PASS: 3 — P21 AES-GCM-256, P24 ROI formula `$2 CPM`, P28 pricing config aligns with messages
- ❌ FAIL: 1 — P2 `<50ms Response` (actual median 253ms, 5× off)
- 🟡 PARTIAL: 1 — P7 `<60s Mission` (true for stubs+LLM missions, false for video render which is 3-10min — claim ambiguity)

**Combined: 8 PASS / 4 FAIL / 9 PARTIAL out of 21**

**NEEDS-BUILD ranked for Phase 04 scope (Group A + C):**

| Pri | Promise | Effort | Action |
|-----|---------|--------|--------|
| **P0** | P30 tier gating completeness | L | Add runtime enforce for team_members, ai_commands_per_month, youtube_channels, campaigns_per_month — security boundary |
| P1 | P5 stubs → live | M | Wire `lead:find/enrich/export` (Apollo+Hunter), `youtube:publish/list-channels` real (depends P13), `voice:clone` (depends P15) |
| P1 | P9 lead-gen real | L | Implement Apollo.io BYOK + 50-leads-per-mission flow OR change copy to "qualified leads" + remove sub-60s |
| P1 | P13 multi-YouTube OR copy fix | L | Either add multi-account YouTube OAuth schema OR change "5+ YouTube channels" → "5+ social platforms" (matches existing publishing_channels) |
| P1 | P15 voice clone real | M | ElevenLabs `/v1/voices/add` call with BYOK key (resolveUserApiKey + voice-clone.ts) |
| P1 | P26 ElevenLabs+D-ID live | M | Same wiring path as P15 + D-ID `/talks` for avatar gen |
| P1 | P29 30-day window | S | Add `created_at >= NOW - 30d` guard in `createRefundRequest` |
| **P1** | **P2 `<50ms` → realistic** | S | Copy-fix `hero.trust_response: "<50ms Response"` → `"Edge response"` or `"<300ms typical"`. Already-shipped Phase 01 missed this key. |
| P2 | P10 TG↔API parity | M | Expose 14 missing missions via Telegram bot OR document strict design (FSM only) |
| P2 | P12 workflow doc | S | Either build literal `WorkflowOrchestrator` OR copy fix: 4-step diagram = customer journey (not code state) |
| P2 | P19 cron weekly | S | Either change cron to `0 6 * * 1` OR copy fix to "auto-discovery every 4h" |
| P2 | P27 video benchmark | S | Phase 03 stopwatch via test pipeline + claim adjustment |
| P2 | P7 mission claim clarify | S | Copy-fix: "<60s mission **dispatch**" or "<60s for simple missions; video render 3-10min". |

**Total estimated Phase 04 effort:**
- P0 only (security gate): ~4-6h
- P0+P1 (production-ready): ~12-20h
- P0+P1+P2 (full polish): ~16-26h

**Doctrine-consistent options:**
- Copy-fix path (cheaper, doctrine-aligned): downgrade 5 claims, build only P0 + 2 P1 items → ~8h
- Build path (more work, fewer claim drops): build all P1, defer P2 → ~20h

**Phase 06 sign-off blockers:**
- P0 P30 MUST be closed (security)
- P1 P9, P15, P26 MUST be closed OR copy-pivot (customer pays for stub = unacceptable)
- P1 P29 MUST be closed (legal — refund promise vs unenforced)


