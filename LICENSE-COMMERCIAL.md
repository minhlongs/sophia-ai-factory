# Sophia AI Factory — Commercial & Functional Source License (`LICENSE-COMMERCIAL`)

**Effective Date:** October 17, 2026
**Licensor:** AgencyOS / Sophia AI Factory (`https://sophia.agencyos.network`)

---

## 1. Scope of Commercial Modules

This Commercial License governs all files and subdirectories designated as `CLOUD_SAAS` or `ENTERPRISE_MASTER` in `apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts`, including:

- **Multi-Tenant SaaS Billing & Dunning:** `src/land/billing/`, `src/tree/billing/invoices/`
- **Automated Affiliate & Payout Engines:** `src/land/affiliates/`, `src/land/payouts/`
- **Autonomous Growth Triad (v12/v13/v14):** `src/land/growth/`, `src/land/growth-v13/`, `src/land/growth-v14/`, `src/land/growth-v15/`, `src/land/growth-v16/`
- **Managed Multi-Platform Social Direct Publisher OAuth Relays:** `src/land/social/`
- **White-Label Agency Subaccount Portal & Custom Domains:** `src/forest/admin/white-label/`, `src/tree/custom-domains/`
- **Cryptographic Merkle IPO Audit Vault & Handover Gate:** `src/tree/finance/merkle/`, `src/tree/handover/`

## 2. Permitted Uses Without a Paid License Key

Without a paid Commercial License (`RAAS_LICENSE_KEY`), you may:
1. View, read, and security-audit the source code of the Commercial Modules.
2. Run the automated test suites (`npm test`) and quality gates to verify contributions to the repository.

## 3. Prohibited Uses Without a Commercial License

Without a valid, cryptographically signed RaaS License Key issued by AgencyOS or an active subscription on `https://sophia.agencyos.network`, you **MAY NOT**:
1. Offer the Software (or any modified version) as a hosted SaaS, RaaS, managed agency portal, or multi-tenant service to third parties.
2. Bypass, stub, disable, or tamper with `resolveSophiaEdition`, `isCommercialFeatureEnabled`, or `verifyRaasLicenseToken` in `src/seed/`.
3. Remove or alter copyright notices, trademark badges, or license headers.

## 4. How to Obtain a Commercial License or Managed Cloud Subscription

| Tier | Pricing | Delivery Model | Best For |
|---|---:|---|---|
| **Community** | **$0** | Self-Hosted (Apache-2.0 Core) | Individual developers & contributors bringing their own Cloudflare + OAuth apps |
| **Basic (Starter)** | **$199 / mo** | Managed Sophia Cloud | Solopreneurs & creators launching faceless AI video channels |
| **Premium (Growth)** | **$399 / mo** | Managed Sophia Cloud | Growing teams using Social Direct Publisher + Affiliate Attribution |
| **Enterprise** | **$799 / mo** | Managed Sophia Cloud + SLA | Agencies running Growth Triad v14, multi-brand subaccounts & custom domains |
| **Master Handover** | **$4,999** (one-time) | Signed `RAAS_LICENSE_KEY` + Full White-Label Handover | Sovereign agencies & enterprises self-hosting all Commercial + White-Label modules |

- **Subscribe or Purchase Online:** [https://sophia.agencyos.network/pricing](https://sophia.agencyos.network/pricing)
- **Enterprise & Master Licensing Inquiries:** `licensing@agencyos.network`
