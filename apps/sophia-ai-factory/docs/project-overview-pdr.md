# Project Overview & Product Development Requirements (PDR)

## Project Name
Sophia AI Factory (Revenue-as-a-Service Platform)

## Executive Summary
Sophia AI Factory is a **no-code, no-tech Revenue-as-a-Service (RaaS) platform** for non-technical CEOs running AI-powered content generation businesses. It enables users to discover high-performing affiliate products, generate engaging scripts using LLMs, create AI-narrated videos with avatars, and manage the publishing workflow—**all without touching code or third-party provider configuration**.

The core differentiator is **BYOK (Bring Your Own Keys) + Setup Wizard**: Users configure everything (OpenRouter, ElevenLabs, D-ID, NOWPayments, Telegram) via a user-friendly 4-step Setup Wizard. The operator ships the platform only—no third-party setup required to make the product "complete."

## Product Identity (No-Tech Doctrine, effective 2026-05-15)

**Sophia customers are non-technical.** Every integration (API keys, payment providers, affiliate networks, AI services, Telegram bots) is configured by the **customer themselves** via the Setup Wizard or in-app forms. The **operator does NOT manage any third-party infrastructure** on behalf of customers.

**Implications:**
1. Customer self-inputs everything (BYOK).
2. Operator manages platform code + CF Workers infrastructure only.
3. No operator-side credentials required for production readiness.
4. Any feature requiring operator setup is **out of scope** until customer-self-configurable.

See `.claude/rules/sophia-no-tech-doctrine.md` for full positioning.

## Core Value Proposition
- **Zero-Code Setup**: Fully automated onboarding via Setup Wizard; no developer needed.
- **BYOK Integration**: Customers own all API keys; operator provides empty platform.
- **End-to-End Automation**: From idea to video file without manual editing.
- **Scalable Architecture**: Built on Next.js 16 + Cloudflare Workers, edge-ready.

## Product Requirements (PDR)

### 1. Functional Requirements

#### 1.1 Setup Wizard (Customer-Self-Configuration)
- **Goal**: Allow non-tech CEOs to configure all integrations in 4 steps.
- **Features**:
  - **Step 1: Introduction** – Value prop + feature overview.
  - **Step 2: AI Services** – OpenRouter key validation; optionally Anthropic/OpenAI.
  - **Step 3: Voice & Avatar** – ElevenLabs, D-ID, HeyGen keys validation.
  - **Step 4: Payments & Telegram** – NOWPayments (crypto-first) or PayOS (VN backup), Telegram bot token.
- **Constraints**: All keys stored encrypted in D1 (customer-owned). Error handling must be plain English; no stack traces. Wizard auto-triggers if any key missing.

#### 1.2 Dashboard & Workspace
- **Goal**: Central command center for CEO to launch campaigns.
- **Features**:
  - **Campaign Dashboard** – List all campaigns, view performance metrics (CTR, revenue, video count).
  - **Quick Actions** – Create new campaign, browse affiliate products, test voice/avatar.
  - **Tier Status** – Show current tier (BASIC/PREMIUM/ENTERPRISE/MASTER) + upgrade button.

#### 1.3 Campaign Builder (Signal → Mission → Content → Handover)
- **Phase 1 (Signal)**: CEO identifies profitable niche + audience (via affiliate tools).
- **Phase 2 (Mission)**: AI generates 3–5 video scripts from product URL + niche angle.
- **Phase 3 (Content)**: Customer selects script, voice (ElevenLabs), avatar (D-ID/HeyGen), background music (API.AI).
- **Phase 4 (Handover)**: Video renders + uploads to customer's channel (YouTube, TikTok, Telegram).

#### 1.4 Content Generation Pipeline
- **Script Generation**: OpenRouter (LLM) generates AIDA/PAS/Storytelling frameworks.
- **Voiceover**: ElevenLabs TTS (customer's API key).
- **Avatar/Video**: D-ID (standard) or HeyGen (premium, customer-paid).
- **Music**: MusicAPI or Pexels background.
- **Delivery**: Remotion renders → uploads to R2 → webhook to customer's platform.

### 2. Non-Functional Requirements

#### 2.1 Usability ("The Mom Test")
- The application must be usable by someone with zero coding knowledge.
- Error messages must be plain English, not stack traces.
- "Wizard" mode must activate automatically if configuration is missing.

#### 2.2 Performance
- **Core Web Vitals**: LCP < 2.5s on Dashboard.
- **Build Time**: < 1 minute on Vercel.
- **API Latency**: Real-time feedback during Wizard validation (< 2s).

#### 2.3 Security
- **API Key Storage**: Keys stored securely in environment variables (server-side only access where possible).
- **Access Control**: Basic Auth for Admin routes (optional but recommended).

## Tech Stack (Post-Consolidation 2026-04-14)
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4.
- **Auth**: Better Auth (customer self-managed via Setup Wizard).
- **Database**: Cloudflare D1 (primary, encrypted BYOK keys) + Supabase (OAuth callbacks only).
- **Infrastructure**: Cloudflare Workers (CF-direct deploy via wrangler CLI).
- **Job Queue**: Inngest (async video render, cron jobs, webhooks).
- **Storage**: Cloudflare R2 (video cache, backups with 30d lifecycle).
- **AI Services**: OpenRouter (LLM — customer-provided key via Setup Wizard).
- **Voice/Avatar**: ElevenLabs (TTS), D-ID / HeyGen (avatar — customer keys).
- **Music**: MusicAPI (optional, customer-provided).
- **Payment**: NOWPayments (USDT TRC20, primary) + PayOS (Vietnam domestic, backup).
- **Observability**: Sentry (error tracking, optional sourcemaps), Cloudflare logs.

## Tier Model (Effective 2026-05-15)

| Tier | Video Cap | API Unlock | Admin UI | Price | Target |
|------|-----------|-----------|----------|-------|--------|
| **BASIC** | 100/mo | ❌ | ❌ | Free (pilot) | Evaluation, feature exploration |
| **PREMIUM** | Unlimited | ✅ | ❌ | $299/mo | Solo creators, small agencies |
| **ENTERPRISE** | Unlimited | ✅ | ✅ | $999/mo | Agencies, teams, operators |
| **MASTER** | Unlimited | ✅ | ✅ | Operator only | Platform operators (internal) |

Each tier activated via NOWPayments IPN webhook on customer payment.

## Production Status
- **Live URL**: https://sophia.agencyos.network
- **Current SHA**: d86659bf (deployed 2026-05-22T07:04Z)
- **Build Status**: ✅ 0 errors, 1398+ tests pass
- **Doctrine**: No-tech v1.28.1 (suspension for this audit — operator-creds in-scope for 100/100 target)
- **Honest Rubric Score**: 87.5/100 (prior architecture audit 2026-05-21; rubric sum honest vs narrative-inflated)

## Development Status
- [x] **Phase 1: Foundation** – Next.js 16, D1 consolidation, Better Auth.
- [x] **Phase 2: Setup Wizard** – 4-step BYOK onboarding.
- [x] **Phase 3: Campaign Builder** – Signal→Mission→Content→Handover.
- [x] **Phase 4: Monetization** – NOWPayments IPN, tier enforcement, quota gates.
- [x] **Phase 5: Telegram Bot** – @Sophia_Bbot integration.
- [x] **Phase 6: Video Engine** – HeyGen + D-ID + Remotion rendering.
- [x] **Phase 7: Production Smoke** – Manual CEO smoke-test SOP.
- [x] **Phase 8: CF-Direct Deploy** – wrangler CLI doctrine (GitHub Actions archived).
- [ ] **Phase 9: Go-Live 100/100** – Complete audit coverage (in progress, deadline TBD).

## Success Metrics
- **Time-to-First-Video**: < 15 minutes post-Setup Wizard.
- **Setup Completion Rate**: > 90% of new customers complete Wizard without errors.
- **Video Generation Reliability**: 99% uptime for render→upload pipeline.
