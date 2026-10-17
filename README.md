# Sophia AI Factory — Autonomous AI Video & Revenue-as-a-Service (RaaS) Platform

> **Open-Core Dual-License Architecture** (`Apache-2.0` Community Core + `Sophia Commercial / FSL-1.1` Enterprise & Cloud Modules)
> **Official Managed Cloud SaaS:** [https://sophia.agencyos.network](https://sophia.agencyos.network) | **Pricing & Enterprise Licensing:** [https://sophia.agencyos.network/pricing](https://sophia.agencyos.network/pricing)

**Sophia AI Factory** is an edge-native, bilingual (Vietnamese + English) autonomous AI video production and affiliate revenue engine built on **Next.js 16**, **Cloudflare Workers / D1 / R2 / KV**, and **Inngest**.

---

## ☁️ Sophia Managed Cloud vs. Self-Hosted Community Edition

Looking for managed Cloudflare edge hosting, Inngest durable workflow execution, and pre-configured multi-channel distribution? **Deploy with Sophia Managed Cloud.**

| Capability | Community Self-Hosted (`Apache-2.0`) | Sophia Cloud (`$199 – $799/mo`) | Master Handover (`$4,999`) |
|---|:---:|:---:|:---:|
| **4-Layer Foundation (`seed` + `tree` Core)** | ✅ Included | ✅ Managed | ✅ Full Source + License |
| **BYOK Envelope Encryption Vault (`AES-256-GCM`)** | ✅ Included | ✅ Managed | ✅ Included |
| **Bilingual `/ask` Intent Router & 4-Advisor Consultation** | ✅ Included | ✅ Managed | ✅ Included |
| **Single-Workspace AI Script, TTS & Video Studio** | ✅ Included | ✅ Managed | ✅ Included |
| **Direct Social Publisher Adapters (TikTok, YouTube, Meta)** | ⚙️ Bring Own Dev Apps | ✅ **Configured Cloud Adapters** | ✅ Dedicated Adapter Handover |
| **Growth Triad v14 (Thompson Sampling MAB + Half-Kelly)** | 🔒 Commercial | ✅ **Included (PREMIUM+)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **Affiliate Attribution & Automated USDT Mass-Payouts** | 🔒 Commercial | ✅ **Included** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **White-Label Agency Subaccount Portal & Custom Domains** | 🔒 Enterprise | ✅ **Included (ENTERPRISE)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **Cryptographic Merkle IPO Audit Vault & 10-Gate Handover** | 🔒 Enterprise | ✅ **Included (ENTERPRISE)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |

👉 **[Start on Sophia Cloud](https://sophia.agencyos.network/pricing)** | **[Self-Hosting Guide (`docs/SELF_HOSTING.md`)](docs/SELF_HOSTING.md)**

---

## 🚀 5-Minute Developer Quickstart (Community Edition)

```bash
# 1. Clone the repository and copy the Community environment template
git clone https://github.com/minhlongs/sophia-ai-factory.git
cd sophia-ai-factory
cp .env.community.example apps/sophia-ai-factory/.env.local

# 2. Install dependencies & run the development server
cd apps/sophia-ai-factory
npm install
npm run dev
```

Open `http://localhost:3000/vi/setup-wizard` (or `/en/setup-wizard`) to enter your own AI provider keys (OpenRouter, ElevenLabs, HeyGen, D-ID) encrypted locally with Web Crypto AES-256-GCM.

### Export & Import Workspace Configuration
Tested the Community Edition locally and ready to transfer your non-secret settings to another deployment or Sophia Cloud? Use the Settings Dashboard **Open-Core & Portability** panel or `exportWorkspaceBundle()` (`src/tree/open-core/workspace-portability.ts`) to export signed channel presets and routing strategies (raw BYOK API keys are never exported).

---

## 🏛️ 4-Layer Mekong Architecture (`seed -> tree -> forest -> land`)

Every module in `apps/sophia-ai-factory/src/` obeys strict one-way import boundaries (`npm run check:boundaries`) and a `< 180 LOC` file budget:

```text
seed   -> Foundational primitives (types, tier configs, D1 client, Web Crypto HMAC/AES, circuit breaker)
tree   -> Reusable domain logic (BYOK store, Bilingual /ask router, social pacing, Merkle audit vault)
forest -> Infrastructure orchestrators (Inngest durable jobs, RaaS gateway, quota enforcer, UI portals)
land   -> Business workflows & Server Actions (NOWPayments/PayOS billing, payouts, affiliates, growth)
```

---

## 🛠️ Tech Stack & Production Doctrine

- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict mode, zero `:any`)
- **Edge Runtime & Storage:** Cloudflare Workers (OpenNext), Cloudflare D1 (SQLite), Cloudflare R2, Cloudflare KV
- **Payments:** NOWPayments (USDT crypto primary) + PayOS (Vietnam domestic backup)
- **Authentication:** Better Auth v1.6.2 (`emailAndPassword` + Magic Link + Organization RBAC)
- **Background Workflows:** Inngest durable functions
- **Internationalization:** `next-intl` (100% parity across Vietnamese `vi` and English `en`)
- **Design System:** Director's Control Deck (`src/app/globals.css` — Warm Amber `--primary` + Indigo `--accent`)

---

## 📜 Licensing & Governance

- **Community Core (`Apache-2.0`):** See [`LICENSE`](LICENSE).
- **Commercial & Enterprise Modules (`FSL-1.1 / Sophia Commercial License`):** See [`LICENSE-COMMERCIAL.md`](LICENSE-COMMERCIAL.md) and [`src/seed/config/open-core-manifest.ts`](apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts).
- **Contributing & CLA:** See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Security Policy:** See [`SECURITY.md`](SECURITY.md).
- **Trademarks:** See [`TRADEMARKS.md`](TRADEMARKS.md).
