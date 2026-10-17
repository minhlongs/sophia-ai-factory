# Sophia AI Factory Constitution — GOAL

**Repository:** `/Users/macbook/sophia-ai-factory`  
**Product:** Sophia AI Factory — Open-Core AI Video & Revenue-as-a-Service (RaaS) platform (`Apache-2.0` Community Core + `Sophia Commercial / FSL-1.1` Managed Cloud & Enterprise RaaS).  
**Primary app:** `apps/sophia-ai-factory/`  
**Production:** `https://sophia.agencyos.network`  
**Date:** 2026-10-17  

## North Star

Sophia ships an Open-Core self-serve AI video and revenue automation platform where developers can self-host the `Apache-2.0` Community Core for free, and non-technical CEOs/agencies run on Sophia Managed Cloud or unlock the `$4,999` Enterprise Master license—bringing their own AI keys (BYOK), paying through supported providers, and receiving measurable business output without operator-managed third-party setup.

## Hard Goals

1. **First paying customer** — close at least one paid customer via NOWPayments or PayOS, then prove the full chain: auth → BYOK setup → payment → tier activation → first AI video → direct social publish.
2. **Open-Core PLG + $1M ARR path** — grow developer/agency adoption via the Public GitHub `Apache-2.0` Community Core and convert self-hosters to Managed Cloud (`/api/open-core/portability`) while validating pricing, unit economics, and repeatable acquisition.
3. **Honest solo-company score ceiling** — maintain the honest score ceiling defined by the no-tech doctrine (`91.5/100`); do not inflate with operator-managed gates or unverified claims.
4. **Protected flows stay unbroken** — Setup Wizard, Telegram Bot (`@Sophia_Bbot`), and NOWPayments IPN tier activation are release blockers.
5. **Canonical GitHub Actions CI/CD deployment** — production deploy runs through `.github/workflows/deploy.yml` on push to `main`, followed by mandatory bit-for-bit SHA verification at `https://sophia.agencyos.network/api/version`. Local direct deploy is blocked without `EMERGENCY_CF_DIRECT=1`.

## Product Positioning & Open-Core Editions

- **Community Edition (`SOPHIA_EDITION=community`, `Apache-2.0`):** Free self-hosted core on Public GitHub (`seed/` 4-layer foundation, AES-256-GCM BYOK Setup Wizard, bilingual `/ask` 4-advisor router, Telegram Bot `@Sophia_Bbot`, single-workspace AI script/TTS/video studio).
- **Managed Cloud Edition (`SOPHIA_EDITION=cloud`, `$199 / $399 / $799 per month`):** Hosted on Cloudflare Workers + D1 + R2 + KV + Inngest, with Direct Social Publisher Cockpit (`/dashboard/social-publisher`), Growth Triad v14, and automated affiliate payouts.
- **Enterprise / Master Handover (`SOPHIA_EDITION=enterprise`, `$4,999 one-time`):** Self-hosted commercial unlock via cryptographically signed `RAAS_LICENSE_KEY` (`SOPHIA-RAAS-v1.<payload>.<hmac-sha256>`), enabling White-Label Agency Subaccount Portals, Custom Domains, Cryptographic Merkle IPO Audit Vault, and Day-1 Master Handover probes.
- **Constraint:** Customers self-input API keys and third-party integrations (BYOK); operator does not manage customer RaaS infrastructure.
- **Language:** Customer-facing content must remain bilingual Vietnamese + English.

## Non-Goals

- Splitting Community and Commercial code into separate repositories.
- Moving payment providers away from NOWPayments (USDT) and PayOS without a founder business decision (Polar.sh and PayPal remain banned).
- Bypassing GitHub Actions CI/CD quality gates or `/api/version` SHA parity checks.
