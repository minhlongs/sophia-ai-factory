# Sophia AI Factory — Autonomous AI Video & Revenue-as-a-Service (RaaS) Platform

> **Open-Core Dual-License Architecture** (`Apache-2.0` Community Core + `Sophia Commercial / FSL-1.1` Enterprise & Cloud Modules)
> **Official Managed Cloud SaaS:** [https://sophia.agencyos.network](https://sophia.agencyos.network) | **Pricing & Enterprise Licensing:** [https://sophia.agencyos.network/pricing](https://sophia.agencyos.network/pricing)

**Sophia AI Factory** is an edge-native, bilingual (Vietnamese + English) autonomous AI video production and affiliate revenue engine built on **Next.js 16**, **Cloudflare Workers / D1 / R2 / KV**, and **Inngest**.

---

## ☁️ Sophia Managed Cloud vs. Self-Hosted Community Edition

Don't want to spend 2–4 weeks passing TikTok/YouTube/Meta OAuth developer app reviews, provisioning Cloudflare D1/R2/KV bindings, or operating 24/7 Inngest durable workers? **Launch in 60 seconds on Sophia Managed Cloud.**

| Capability | Community Self-Hosted (`Apache-2.0`) | Sophia Cloud (`$199 – $799/mo`) | Master Handover (`$4,999`) |
|---|:---:|:---:|:---:|
| **4-Layer Foundation (`seed` + `tree` Core)** | ✅ Included | ✅ Managed | ✅ Full Source + License |
| **BYOK Envelope Encryption Vault (`AES-256-GCM`)** | ✅ Included | ✅ Managed | ✅ Included |
| **Bilingual `/ask` Intent Router & 4-Advisor Consultation** | ✅ Included | ✅ Managed | ✅ Included |
| **Single-Workspace AI Script, TTS & Video Studio** | ✅ Included | ✅ Managed | ✅ Included |
| **Pre-Approved TikTok, YouTube Shorts & IG Reels OAuth Relay** | ❌ Bring Own Dev Apps | ✅ **1-Click Connect** | ✅ Dedicated App Handover |
| **Growth Triad v14 (Thompson Sampling MAB + Half-Kelly)** | 🔒 Commercial | ✅ **Included (PREMIUM+)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **Affiliate Attribution & Automated USDT Mass-Payouts** | 🔒 Commercial | ✅ **Included** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **White-Label Agency Subaccount Portal & Custom Domains** | 🔒 Enterprise | ✅ **Included (ENTERPRISE)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |
| **Cryptographic Merkle IPO Audit Vault & 10-Gate Handover** | 🔒 Enterprise | ✅ **Included (ENTERPRISE)** | ✅ Unlocked via `RAAS_LICENSE_KEY` |

👉 **[Start Instantly on Sophia Cloud](https://sophia.agencyos.network/pricing)** | **[Self-Hosting Guide (`docs/SELF_HOSTING.md`)](docs/SELF_HOSTING.md)**

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

### Migrate Local Workspace to Sophia Cloud in 60 Seconds
Tested the Community Edition locally and ready for automated multi-channel publishing and Growth Triad optimization? Use `exportWorkspaceBundle()` (`src/tree/open-core/workspace-portability.ts`) to export your channel presets and routing strategy into Sophia Cloud with zero reconfiguration.

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
