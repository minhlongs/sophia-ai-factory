# Self-Hosting Sophia AI Factory vs. Sophia Managed Cloud

> **Bilingual Guide (English & Tiếng Việt)** — How to run the `Apache-2.0` Community Core locally and when to upgrade to **Sophia Managed Cloud** (`https://sophia.agencyos.network`) or **Master Handover (`$4,999`)**.

---

## 1. Edition Overview (`SOPHIA_EDITION`)

Sophia AI Factory supports three runtime editions configured via `SOPHIA_EDITION` (resolved in `src/seed/config/edition-config.ts`):

1. **`SOPHIA_EDITION=community` (Default for Self-Hosters — Free / Apache-2.0)**
   - Includes the 4-layer foundation (`seed/`), BYOK AES-256-GCM Setup Wizard, Bilingual `/ask` Router & 4-Advisor Consultation (`tree/ask/`), Telegram Bot commands, and single-workspace AI video script/TTS generation.
2. **`SOPHIA_EDITION=cloud` (Official Managed SaaS — `$199 / $399 / $799 per month`)**
   - Hosted at `https://sophia.agencyos.network`.
   - Includes pre-approved TikTok Content Posting API v2, YouTube Data API v3, and Meta Instagram Reels OAuth relays, 24/7 Inngest durable queues, Growth Triad v14 (Thompson Sampling MAB + Fractional Half-Kelly allocator), and automated affiliate payouts.
3. **`SOPHIA_EDITION=enterprise` (Self-Hosted Commercial / Master Handover — `$4,999`)**
   - Unlocked on self-hosted infrastructure by setting a cryptographically signed `RAAS_LICENSE_KEY` (`SOPHIA-RAAS-v1.<payload>.<hmac-sha256>`) verified by `src/seed/security/raas-license-verifier.ts`.
   - Enables White-Label Agency Subaccount Portal, Custom Domains, Cryptographic Merkle IPO Audit Vault, and Day-1 Master Handover probes.

---

## 2. Running the Community Edition Locally

```bash
cp .env.community.example apps/sophia-ai-factory/.env.local
cd apps/sophia-ai-factory
npm install
npm run type-check
npm test
npm run dev
```

---

## 3. Why Non-Technical CEOs & Agencies Choose Sophia Managed Cloud

While developers can self-host the Community Core, running a production multi-channel AI video and affiliate business requires:
- **Platform Publisher Integrations:** Direct social publishing adapters (TikTok, YouTube, Meta) require provider API credentials and approved developer access. Sophia Cloud provides configured cloud integration endpoints.
- **Zero-Ops Durable Infrastructure:** Managed Cloudflare Workers edge runtime, D1 SQLite storage, R2 media storage, Inngest job execution, and verified operational runbooks.
- **Quantitative Revenue Optimization:** Growth Triad v14 automatically evaluates video performance hooks using Thompson Sampling and Half-Kelly allocation models.

👉 **Subscribe or request a Master License Key:** [https://sophia.agencyos.network/pricing](https://sophia.agencyos.network/pricing)
