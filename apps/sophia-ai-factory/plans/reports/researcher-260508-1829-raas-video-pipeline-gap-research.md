# Research: OSS Repos vá GAP cho user FREE100 SOP → video → auto-distribute

**Date:** 2026-05-08 18:29 PT
**Mode:** parallel (5 Gemini queries song song, 3 hoàn tất, 2 bị rate-limit và bị kill khi đã dump partial — video gen lấy đầy đủ, faceless factory fallback model knowledge)
**Stack hiện có (Sophia):** Next.js 16 + CF Workers + D1 + Better Auth + Inngest + Polar.sh + RaaS gate

## TL;DR

Sophia đã có khung Inngest workflow + mission handlers đầy đủ. **5 GAP chính** cản user FREE100 chạy hết flow:
1. **Distribution multi-platform** (chỉ có youtube-publish, thiếu TikTok/Reels/FB/X) → **Upload-Post NPM** (CF-native, OAuth bridge)
2. **Video gen provider** (video-visual handler tồn tại nhưng provider/quality chưa rõ) → **Wan 2.1** qua Replicate, **Fish Speech** cho voice clone
3. **Video assembler licensing** (nếu đang dùng Remotion phải xác minh giấy phép thương mại) → **Revideo** (MIT, drop-in TS)
4. **Credit metering** (D1 ledger có thể thin) → **OpenMeter** event ingest từ Worker
5. **Trial state machine + Sentry DSN ops** (đã được note trước đó) → **Polar.sh** subscription webhooks + ops fix

## 1. Video gen pipeline (8 repo, Gemini ✅)

| Repo | Stars | License | GAP fills | CF/Next fit |
|---|---|---|---|---|
| **Wan 2.1/2.2** (Wan-Video/Wan2.1) | 16k | Apache 2.0 | SOTA text-to-video, MoE, 1080p | High complexity → trigger qua Replicate/RunPod |
| **HunyuanVideo** (Tencent) | 12k | Tencent custom (free SMB) | Cinematic motion + avatar | High → dedicated GPU |
| **Duix-Avatar** (HeyGem clone) | 13k | Duix community | HeyGen alt local | Med-High → microservice |
| **Fish Speech** | 30k | Fish Audio research | Zero-shot voice clone 5s, multilingual | Med → FastAPI wrapper |
| **LivePortrait** | 18k | Custom/academic | Photo→talking head, fast inference | Low-Med → consumer GPU |
| **OpenShorts** (mutonby) | 2k | MIT | End-to-end script→video | Low → Modal/fly.io trigger |
| **Revideo** (redotvideo) | 4k | MIT | Programmatic TS video editor (Remotion alt) | **Very Low → CF native** |
| **ViMax** (HKUDS) | 3.3k | Academic | Multi-agent director/screenwriter | High |

**Recommendation cho Sophia:**
- BYOK provider Replicate/RunPod gọi Wan 2.1 từ `video-visual.ts` mission handler
- Fish Speech thay/bổ sung `voice-clone.ts` (zero-shot clone 5s = killer feature cho FREE100 user)
- **Revideo** thay Remotion trong `video-compose.ts` nếu đang dùng commercial Remotion (kiểm tra license)

## 2. Auto-distribution multi-platform (8 repo, Gemini ✅)

| Repo | Stars | License | Platforms | ToS Risk | CF fit |
|---|---|---|---|---|---|
| **Postiz** (gitroomhq) | 30k | AGPL-3.0 | 28+ (TT/YT/IG/X/LI/FB/Pin/Reddit/Threads/Mastodon) | Low (official APIs) | High complexity, NestJS sidecar |
| **Upload-Post NPM** | 500 | MIT | TT/IG/YT/LI/X/FB/Pin/Reddit/Threads/Bluesky | Medium (bridge) | **Low → perfect CF Workers** |
| **MoneyPrinterTurbo** | 53k | MIT | TT/Shorts/Reels | Med (spam flag) | High (Python/MoviePy) |
| **OpenShorts** (gitroomhq) | 2k | MIT | TT/Shorts/Reels | Low | Med (TS port-able) |
| **Mixpost Lite** | 3.2k | MIT | FB/X/Mastodon (Lite) | Low | High (PHP/Laravel) |
| **yit** (azimjohn) | 1k | MIT | TT/Shorts/Reels | **High** (browser stealth) | Med (CF Browser Rendering) |
| **TikTokAutoUploader** (makiisthenes) | 1.5k | MIT | TikTok | High (Phantomwright) | Low/Med (HTTP version) |
| **n8n-video-to-shorts** | 1.2k | MIT | YT Shorts | Low | Med (translate flow) |

**Recommendation cho Sophia:**
- **Adopt Upload-Post NPM** ngay → mở TikTok/IG Reels/FB/X chỉ với 1 SDK, lưu OAuth refresh token vào D1
- Fallback Postiz patterns (mã nguồn) để học OAuth flow cho từng platform khi cần in-house
- **AVOID** stealth browser (yit, TikTokAutoUploader) trong production SaaS — ToS risk = ban toàn user

## 3. Faceless content factory (model knowledge fallback — Gemini bị rate-limit)

| Repo | Stars (~est) | License | Coverage | Lock-in |
|---|---|---|---|---|
| **ShortGPT** (RayVentura) | 6k+ | MIT | idea→script→voice→video→YT upload | OpenAI default, plug-able |
| **MoneyPrinter** (FujiwaraChoki) | 10k+ | MIT | full pipeline TT/Shorts | OpenAI/ElevenLabs |
| **AI-Shorts-Generator** (riolaf05) | 1k+ | MIT | script+TTS+stitch | OpenAI |
| **CrewAI examples** | 35k (framework) | MIT | multi-agent content factory | provider-agnostic |
| **LangGraph content workflow** | 14k (framework) | MIT | DAG content agent | provider-agnostic |
| **agency-swarm** (VRSEN) | 3k+ | MIT | role-based content team | OpenAI strong |
| **content-craft** | <1k | MIT | blog→video repurpose | OpenAI |
| **MoneyPrinterTurbo** | 53k | MIT | already covered §2 | local/cloud |

**Recommendation:** Sophia đã có equivalent (mission handlers + Inngest workflow). Không nhập trọn repo nào, nhưng **clone prompt patterns** từ ShortGPT script.py + MoneyPrinter video pipeline để cải thiện `video-scripting.ts` quality.

## 4. Workflow orchestration (6 repo, Gemini ✅)

| Engine | Stars | License | Durable | CF fit | Multi-tenant |
|---|---|---|---|---|---|
| **Inngest** ✅ (Sophia đang dùng) | 5.3k | Apache 2.0 | Native HTTP push | **Excellent** | Concurrency keys |
| **Trigger.dev v3/v4** | 14.8k | Apache 2.0 | MicroVMs checkpoint | Good | Connect feature |
| **Windmill** | 16.4k | AGPL-3.0 | High perf | Strong | Workspaces |
| **Activepieces** | 22.1k | MIT | Moderate | Moderate | Embedded iPaaS |
| **Hatchet** | 7.1k | MIT | DAG + Postgres | Good | Fairness |
| **Mastra** | 19.4k | MIT | Plug-in (Inngest/Temporal) | **Excellent TS-native** | Code-defined |

**Recommendation:** Sophia chọn **Inngest = đúng**. Bổ sung **Mastra** làm AI agent orchestrator cho prompt graphs phức tạp (script→hook→outline→draft→polish), giữ Inngest cho durable steps.

## 5. Metering / BYOK / Billing (6 repo, Gemini ✅)

| Repo | Stars | License | GAP | Friction |
|---|---|---|---|---|
| **OpenMeter** | 3.5k | Apache 2.0 | High-scale usage metering (tokens/frames/sec) | Low (REST ingest) |
| **Infisical** | 16k | MIT | BYOK secret store native CF | **Very Low** |
| **Flexprice** | 1.2k | Apache 2.0 | Credit ledger AI-native (prepaid+grants) | Med |
| **Polar.sh** ✅ (Sophia đang dùng) | 4k | Apache 2.0 | MoR + trial + affiliate | Low |
| **Trigger.dev** (covered §4) | 11k | Apache 2.0 | Long-running trial expiry job | Low CF SDK |
| **Refferq** | <1k | MIT | Reflio successor, Next.js affiliate | Med |

**Recommendation:**
- **Polar.sh** giữ nguyên (đã chốt trong rule "ALL-IN POLAR")
- Đánh giá D1 credit ledger hiện tại; nếu còn thin → ingest events vào **OpenMeter** + dùng Flexprice double-entry logic làm reference
- **Infisical** cho BYOK LLM keys nếu dashboard BYOK hiện tại chỉ encrypt-at-rest D1

## GAP → Repo mapping cho FREE100 user flow

| Sophia GAP | Severity | OSS giải quyết |
|---|---|---|
| TikTok / IG Reels / FB Reels publish | **P0** | Upload-Post NPM |
| X / LinkedIn / Threads publish | P1 | Upload-Post NPM |
| Voice clone quality (BYOK) | P1 | Fish Speech |
| Talking-head avatar cheap | P2 | LivePortrait |
| Remotion → MIT alternative (verify license) | P1 | Revideo |
| High-scale usage metering | P2 | OpenMeter |
| Trial-expiry durable job | P1 | Trigger.dev (hoặc Inngest scheduled fn) |
| BYOK secret rotation | P2 | Infisical |
| Sentry DSN missing in prod | **P0 ops** | (config-only, không cần repo) |
| Multi-agent script quality | P2 | ShortGPT/MoneyPrinter prompts + Mastra |

## Implementation strategy (3 phases)

**Phase 1 (Week 1) — P0 unblocker cho FREE100 user:**
- Integrate Upload-Post NPM → mở TikTok/Reels/FB publish trong `youtube-publish.ts` → rename `social-publish.ts`
- Cấu hình Sentry DSN qua `wrangler secret put`
- Verify Remotion license; nếu commercial → swap Revideo

**Phase 2 (Week 2-3) — Quality:**
- Replicate Wan 2.1 cho `video-visual.ts` (BYOK key)
- Fish Speech BYOK cho `voice-clone.ts`
- Audit credit ledger; nếu thin → OpenMeter event ingest

**Phase 3 (Week 4+) — Polish:**
- Mastra agent graph cho `video-scripting.ts` (clone ShortGPT/MoneyPrinter prompts)
- Infisical migrate BYOK key store
- LivePortrait talking-head làm tier upsell

## Unresolved questions

1. Provider hiện tại của `video-visual.ts` là gì? (ComfyUI? Replicate? Closed API?) → ảnh hưởng rec Wan 2.1
2. `video-compose.ts` có dùng Remotion commercial license không? → quyết định swap Revideo
3. D1 credit ledger schema hiện như thế nào (ai-native double-entry hay flat int)? → quyết định Flexprice/OpenMeter
4. BYOK store hiện encrypt-at-rest cách nào (D1 column, KV, R2)? → Infisical migration cost
5. Có quota Replicate/RunPod budget cho Wan 2.1 inference (~$0.05/giây video) không?
6. Postiz AGPL-3.0 có ảnh hưởng nếu fork code patterns? Upload-Post MIT an toàn — nhưng phụ thuộc bridge service uptime, có acceptable không?
