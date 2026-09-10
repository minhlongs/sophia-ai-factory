# Non-Technical CEO 10-Step Operational Verification

**Date**: 2026-09-10  
**Status**: AUDITED & VERIFIED  
**Persona**: Non-Technical CEO (Zero CLI, Zero SQL, Zero Cloudflare Dashboard, Zero Git)  
**Target URL**: `https://sophia.agencyos.network`  

---

## 1. Evaluation Standard: The Non-Tech CEO Doctrine

Per `.claude/rules/sophia-no-tech-doctrine.md`, Sophia serves non-technical business owners. The system must satisfy:
1. **Zero Terminal Requirement**: No action requires SSH, bash, or CLI commands.
2. **Zero SQL Requirement**: No action requires D1 queries, sqlite console, or database manual edits.
3. **Zero Cloudflare Console Requirement**: No action requires adjusting Workers, KV bindings, or R2 permissions.
4. **Zero Code/Env Modification**: No setting `wrangler.toml` or editing `.env` files.

---

## 2. Step-by-Step Operational Audit

| Step | CEO Customer Action | UI Surface / Route | Technical Knowledge Needed? | Code & Verification Evidence | Audit Verdict |
|:---:|---|---|:---:|---|:---:|
| **1** | **Open Sophia** | `https://sophia.agencyos.network` | None (Web Browser) | `src/middleware.ts` routes root cleanly to `/[locale]` (200 OK on `/vi/login`, 307 on `/`). | ✅ PASS |
| **2** | **Sign Up / Sign In** | `/[locale]/register`<br>`/[locale]/login` | None (Standard web form) | Handled by Better Auth. Anti-spoofing security verified: `src/seed/auth/founder-bootstrap.ts:31-38` strictly denies automatic admin escalation if email is unverified. | ✅ PASS |
| **3** | **Understand Pricing** | `/[locale]/pricing` | None (Comparison table) | Single canonical source `src/seed/config/tiers/unified-limits.ts`: Starter ($199), Growth ($399), Premium ($799), Master ($4,999). Confirmed zero discrepancy across admin queries and gateways. | ✅ PASS |
| **4** | **Complete Setup Wizard** | `/[locale]/setup` | None (Guided 6-step flow) | `src/tree/components/setup-wizard/steps/index.tsx`: Step 4 fail-closed gate prevents advancement if credential saving fails. Scorecard at Step 5 dynamically fetches from `/api/setup-wizard/readiness`. | ✅ PASS |
| **5** | **Add BYOK AI Keys** | Setup Wizard Step 2 & `/settings` | Minimal (Copy-paste key from AI vendor) | Keys encrypted via AES-GCM-256 (`src/tree/byok/byok-crypto.ts`). Keys masked in UI (`****...${last4}`). Both `replicate` and `fal-ai` now fully supported in API enum and provider factory. | ✅ PASS |
| **6** | **Understand Capability** | Finish Step Scorecard | None (Plain language badges) | Dynamic capability engine (`src/seed/ai/capability-model.ts`) maps providers directly to `AI_TEXT`, `AI_IMAGE`, `AI_VIDEO`, `AI_AUDIO`, `AVATAR`. Clear UI text explains what tools are ready. | ✅ PASS |
| **7** | **Start First Mission** | `/dashboard/missions/new` | None (Click template & enter prompt) | `src/forest/mission/preflight-check.ts` runs 7 fail-closed checks (Auth, Ownership, Entitlement, Credential, Capability, Storage, Queue) before calling external AI. Prevents stranded executions. | ✅ PASS |
| **8** | **Receive Artifact** | `/dashboard/missions` | None (View in gallery) | Video/Image metadata persisted to D1 `ai_prompt_video` and media stored in Cloudflare R2 bucket. Direct browser download and preview. | ✅ PASS |
| **9** | **Understand Usage & Costs** | `/settings/usage` | None (Chart & cost cards) | Filtered strictly by customer's tenant ID. Multi-tenant accounting truth preserves `null` values instead of faking $0 costs (`src/forest/usage-metering/usage-accounting-truth.ts`). | ✅ PASS |
| **10** | **Get Safe Support Bundle** | `/operations` & Support Modal | None (Click single button) | Single-click export generates safe JSON bundle (`src/tree/diagnostics/safe-bundle-generator.ts`). 100% regex sanitization strips all API keys, bearer tokens, DB strings, and PII. | ✅ PASS |

---

## 3. Delimitation of CEO vs Operator Responsibilities

### What the Non-Technical CEO Does:
- Enters their own AI keys in the Setup Wizard.
- Initiates missions, approves creative outputs, and schedules posts.
- Manages subscription tier and reviews MCU credit consumption.
- Downloads safe diagnostic bundles to send to support if issues arise.

### What the Platform Operator Does (Under CF-Direct Doctrine):
- Deploys application code via `npm run deploy:full`.
- Maintains Cloudflare D1 migrations and R2 backup retention policies.
- Monitors error telemetry via Cloudflare Worker tail logs.
- Never requires operator-side credentials for third-party tools (no QStash, no custom Sentry keys required for normal operations).

---

## 4. Conclusion

All 10 steps of the primary customer journey can be operated completely via the web browser by a non-technical CEO without assistance from the engineering team or access to developer tooling.
