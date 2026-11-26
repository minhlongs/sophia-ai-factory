# Sophia AI Factory Constitution — GOAL

**Repository:** `minhlongs/sophia-ai-factory`
**Product:** Sophia AI Factory — **100% Crypto + SaaS Agentic Affiliate & Video Harness** (Craft Studio 4-step workflow, Policy-as-Code 4-matrix compliance, OpenRouter 1-Key BYOK + TTS, Browser MP4 `$0` + HeyGen BYOK, Smartlink `/api/r/`).
**Primary app:** `apps/sophia-ai-factory/`
**Canonical Production URL:** `https://sophia-ai-factory.agencyos-openclaw.workers.dev`
**Permanent Internal R&D Pilot URL (`$0 RaaS`):** `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev`
**Updated:** 2026-11-26 (Baseline `7e607edb`)

## North Star

Empower non-technical founders, solo operators, and internal R&D teams to produce, comply-check, render, distribute, and monetize Crypto & SaaS affiliate video campaigns end-to-end with **100% customer BYOK** (1 OpenRouter key for scripts + TTS, optional HeyGen key for avatar MP4) and zero operator-managed third-party credentials.

## Hard Goals

1. **Zero-friction Affiliate Studio (`/dashboard/first-value`)** — 4-step Craft Studio (`Setup & Offer → Script & 4-Matrix Policy Preflight → Video MP4 & /api/r/ Shortlink → Revenue & Ops`) with 5-minute hands-on guide (`/guide`).
2. **Proactive 4-Matrix Compliance (`src/seed/compliance/policy-preflight-engine.ts`)** — enforce Jurisdiction (`US FTC`, `UK FCA`, `EU MiCA`, `VN`, `SG MAS`), Platform (`TikTok`, `YouTube Shorts`, `IG/FB Reels`), Provider (`HeyGen`, `D-ID`, `OpenRouter TTS`, `Browser MP4`), and Vertical (`Crypto`, `SaaS`) rules before render/publish.
3. **Dual-Sync Parity (Production + Permanent Internal R&D `$0 RaaS`)** — keep `sophia-ai-factory` (Production, D1 `sophia-raas-db`) and `sophia-ai-factory-pilot` (Internal R&D `$0 RaaS`, `PILOT_WINDOW_MODE="OPEN_INTERNAL_RD"`, `PAYMENTS_ENABLED="false"`, isolated D1 `sophia-pilot-db` with 910 tables) bit-for-bit synced on every release.
4. **Protected Flows stay unbroken** — Setup Wizard (BYOK), Affiliate Studio (`/api/first-value`), Smartlink (`/api/r/`), NOWPayments IPN, and PayOS backup.
5. **Verified Deployment Contract** — CI/CD via `.github/workflows/deploy.yml` and/or authorized Dual-Sync Wrangler deploy (`wrangler.toml` + `wrangler.pilot.toml`), always followed by mandatory `/api/version` bit-for-bit SHA parity and HTTP 200 `/api/health` verification.
6. **Bilingual Vietnamese + English** — all customer-facing copy remains bilingual (`messages/vi.json`, `messages/en.json`), zero developer jargon.

## Non-Goals

- Selling physical retail / e-commerce dropshipping (Sophia is strictly Crypto + SaaS Affiliate).
- Using banned billing providers (Polar.sh and PayPal remain permanently banned).
- Requiring operator-provided third-party AI/video credentials for customer workloads.
