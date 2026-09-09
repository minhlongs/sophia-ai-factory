# CUSTOMER HANDOVER MATRIX — SOPHIA AI FACTORY

**Date:** 2026-09-09
**Certification:** SUPREME HANDOVER
**Audience:** Non-technical CEO customer (bilingual VI + EN)
**Status:** CONDITIONAL — platform is live and degraded; two gates (identity, provider) are BLOCKED.

---

## 1. Tổng quan / Overview 🏭

Sophia AI Factory là nền tảng **no-code, no-tech** để bạn tạo video AI (YouTube faceless + affiliate empires). Bạn tự cung cấp API keys (BYOK — Bring Your Own Keys), Sophia xử lý phần còn lại.

Sophia AI Factory is a **no-code, no-tech** platform for you to create AI videos (faceless YouTube + affiliate empires). You provide your own API keys (BYOK — Bring Your Own Keys), Sophia handles the rest.

---

## 2. Khách hàng nhận được gì / What the customer receives 📦

| Item | Description | Status |
|---|---|---|
| 🏭 Platform access | Full Sophia AI Factory (web app, dashboard, creative studio) | ✅ Live |
| 🤖 Telegram bot | @Sophia_Bbot — campaign management via `/campaign`, `/status`, `/results` | ✅ Live |
| 💳 Payment | NOWPayments integration (crypto payments) | ✅ Live |
| 🎬 Video generation | HeyGen (certified) — AI avatar video rendering | ✅ Live |
| 🖼️ Image generation | fal.ai — AI image generation | ⚠️ Needs FAL_KEY |
| 🔊 Voiceover | ElevenLabs — text-to-speech | ⚠️ Needs ELEVENLABS key |
| 🎭 Avatars | D-ID — talking avatar | ⚠️ Needs D-ID key |
| ✍️ Script generation | OpenRouter / Anthropic — AI script writing | ⚠️ Needs OPENROUTER or ANTHROPIC key |

---

## 3. Khách hàng TỰ CẤU HÌNH gì / What the customer self-configures 🔑

Tích hợp được cấu hình qua **Setup Wizard** (bước onboard duy nhất). Không cần developer.

All integrations are configured via the **Setup Wizard** (single onboarding step). No developer needed.

| Integration | Key needed | Where to get it |
|---|---|---|
| 🖼️ Image generation | `FAL_KEY` | [fal.ai](https://fal.ai) → Dashboard → API Keys |
| 🔊 Voiceover | `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) → Profile → API Keys |
| 🎭 Avatars | `D_ID_API_KEY` | [d-id.com](https://d-id.com) → API Settings |
| ✍️ Script generation | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) → Keys |
| ✍️ Script generation (alt) | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| 🤖 Telegram bot | Bot token | [@BotFather](https://t.me/BotFather) on Telegram |
| 💳 Payment | NOWPayments API key | [nowpayments.io](https://nowpayments.io) → Account → API Keys |

### Bước cấu hình / Configuration steps 🛠️

1. **Đăng ký tài khoản** trên sophia.agencyos.network / **Sign up** at sophia.agencyos.network
2. **Mở Setup Wizard** → nhập API keys cho nhà cung cấp bạn muốn dùng / **Open Setup Wizard** → enter API keys for providers you want to use
3. **Lưu** → keys được mã hóa AES-GCM, lưu trữ an toàn / **Save** → keys are AES-GCM encrypted, stored securely
4. **Bắt đầu tạo video!** / **Start creating videos!**

---

## 4. Nhà vận hành quản lý gì / What the operator manages 🏗️

| Responsibility | Description |
|---|---|
| 🚀 Platform deploy | CF-direct doctrine (`npm run deploy:full`) |
| 🗄️ Database | Cloudflare D1 (synchronous, auto-migration) |
| ☁️ Storage | R2 buckets (cache, backups, media) |
| 🔐 Secrets | CF Workers secrets (platform-level, NOT customer BYOK) |
| 📊 Monitoring | Sentry (error capture), wrangler tail (logs) |

**KHÔNG cần operator cung cấp credential cho platform hoạt động.** Khách hàng tự cấu hình BYOK.

**Operator does NOT need to provide credentials for the platform to function.** Customer self-configures BYOK.

---

## 5. Trạng thái handover / Handover readiness 🚦

| Flow | Status | Notes |
|---|---|---|
| 🏭 Setup Wizard | ✅ READY | BYOK onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen) |
| 🤖 Telegram Bot | ✅ READY | Webhook `/api/webhooks/telegram` — secret-token verified |
| 💳 NOWPayments IPN | ✅ READY | Webhook `/api/webhooks/nowpayments` — signature verified |
| 🎬 HeyGen video | ✅ READY | Certified provider, key present |
| 🖼️ fal.ai image | ⚠️ CONDITIONAL | Provider certified PRODUCTION_CANDIDATE, but **FAL_KEY not configured** in production |
| 🔊 ElevenLabs TTS | ⚠️ CONDITIONAL | Provider code wired, but **ELEVENLABS_API_KEY not configured** in production |
| 🎭 D-ID avatar | ⚠️ CONDITIONAL | Provider code wired, but **D_ID_API_KEY not configured** in production |

---

## 6. Các hạn chế đã biết / Known limitations ⚠️

| Limitation | Impact | Mitigation |
|---|---|---|
| 🔴 **No authorized founder account** | Cannot run controlled production canary with real user | Operator must create/authorize a real founder account before GREEN |
| 🔴 **FAL_KEY absent** | Image generation returns `NO_API_KEY` before reaching provider | Operator must configure `FAL_KEY` in CF Workers secrets |
| 🟡 **Degraded health** | `/api/health` returns `degraded` (telemetry/reality-loop data-absence artifact) | KNOWN-RED — tracked, not a new business failure |
| 🟡 **Local SHA ≠ Live SHA** | Local `57fcc931c` is 1 commit ahead of live `34219be6` | Stale-deploy signal — deploy latest to close gap |
| 🟡 **Sentry sourcemaps** | Errors captured but not symbolicated (no `SENTRY_AUTH_TOKEN`) | Optional — wrangler tail is canonical log stream |
| 🟡 **No external backup cron** | `/api/cron/d1-backup` exists but not registered with external scheduler | Per no-tech doctrine — ad-hoc manual trigger only |

---

## 7. Khuyến nghị / Recommendation 🎯

**CONDITIONAL HANDOVER** — Platform is live and functional for HeyGen video + Telegram + NOWPayments. Full GREEN handover requires:

1. **Operator tạo/ủy quyền founder account thật** / Operator creates/authorizes a real founder account
2. **Operator cấu hình FAL_KEY** trong CF Workers secrets / Operator configures FAL_KEY in CF Workers secrets
3. **Deploy commit mới nhất** để khớp local/live SHA / Deploy latest commit to match local/live SHA

Sau 3 bước trên, chạy lại certification → có thể đạt **GREEN → CUSTOMER HANDOVER READY**.

After the above 3 steps, re-run certification → can reach **GREEN → CUSTOMER HANDOVER READY**.

---

*End of handover matrix. Cross-reference: `SUPREME-HANDOVER-BASELINE.md`, `SUPREME-HANDOVER-CERTIFICATE.md`.*
