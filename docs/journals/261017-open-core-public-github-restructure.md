# Technical Journal — 25-Step Modularization & Open-Core Public GitHub + Commercial SaaS Restructuring

- **Date:** 2026-10-17
- **Commits:** `eaf9ed69a` (25-Step Modularization `< 180 LOC`) & `1b4c1699b` (25-Step Open-Core Public GitHub + Commercial SaaS Architecture)
- **Tag:** `v1.52.0-open-core`

## Context & Problem Statement

Sophia AI Factory needed to complete two interlocking architectural milestones:
1. **Strict Module Size & 4-Layer Discipline (`eaf9ed69a`):** Eliminate the final executable modules exceeding 180 lines (`src/tree/ask/ask-router.ts`, `src/tree/billing/invoices/html-formatter.ts`, `src/seed/security/signature.ts`) while keeping 100% backward-compatible facades (≤ 25 LOC) and zero layer boundary violations across `seed -> tree -> forest -> land`.
2. **Public GitHub Open-Core + High-Margin Commercial SaaS Monetization (`1b4c1699b`):** The GitHub repository (`minhlongs/sophia-ai-factory`) was already set to `PUBLIC` visibility, yet held a conflicting "All rights reserved" proprietary `LICENSE` and lacked runtime edition boundaries between free developer self-hosting and the paid Managed Cloud SaaS (`BASIC $199/mo`, `PREMIUM $399/mo`, `ENTERPRISE $799/mo`, `MASTER $4,999`).

## Architectural Decisions & Implementation

1. **Single-Repo Open-Core Dual-Licensing (Apache-2.0 + Sophia Commercial / FSL-1.1):**
   - Rather than splitting into two repositories (which would double CI/CD maintenance and break atomic 4-layer commits), we adopted the Cal.com / Supabase / n8n Open-Core pattern.
   - `seed/` primitives, BYOK AES-256-GCM Setup Wizard, Bilingual `/ask` Router, Telegram Bot commands, and single-channel AI video studio are licensed under **Apache-2.0** (`COMMUNITY` scope).
   - Multi-platform pre-approved Social Direct Publisher OAuth relays, Growth Triad v14 (Thompson Sampling MAB + Half-Kelly allocator), Affiliate Attribution & USDT Mass-Payouts, Multi-Tenant SaaS Billing, White-Label Agency Subaccount Portal, Custom Domains, Merkle IPO Audit Vault, and Day-1 Master Handover are governed by **`LICENSE-COMMERCIAL.md`** (`CLOUD_SAAS` and `ENTERPRISE_MASTER` scopes).

2. **Cryptographic RaaS License Token & Tier Rank Enforcement:**
   - Implemented `src/seed/security/raas-license-verifier.ts` (`SOPHIA-RAAS-v1.<base64url>.<hmac-sha256>`) using Web Crypto `computeHmacHex` and constant-time `timingSafeEqual`.
   - Hardened `src/seed/config/edition-config.ts` to parse `new URL(appUrl).hostname` (preventing query/subdomain spoofing) and enforce `TIER_RANK` (`FREE < BASIC < PREMIUM < ENTERPRISE < MASTER`) so a lower-tier license cannot unlock `MASTER` features.

3. **Self-Host-to-Cloud Conversion Funnel:**
   - Built `src/tree/open-core/workspace-portability.ts` (HMAC-verified JSON bundle export/import with strict provider & channel preset validation and zero plaintext key export), `src/tree/open-core/version-beacon.ts` (circuit-breaker protected, opt-out upstream version check), and `src/components/open-core/commercial-upgrade-modal.tsx` (bilingual Director's Control Deck modal).

## Verification Evidence

- **GitHub Actions CI/CD (`deploy.yml`):** Stage 1 Quality Gate (`tsc`, `eslint`, `check:boundaries`, `i18n:validate`, `vitest`) passed 100% in CI; live `/api/version` verified `shortSha: "eaf9ed69"` with `post-deploy-smoke.mjs` passing 4/4 checks (`200 /api/health`, `200 /api/version`, `307 /login`, `200 /vi/login`), and `1b4c1699b` (`v1.52.0-open-core`) queued directly behind it.
