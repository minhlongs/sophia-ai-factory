# DOMAIN-01 — Legacy Domain Coupling Audit (G3) & `agencyos.network` Exit Risk Inventory (G10)

> **Date:** 2026-11-24
> **Repository:** `minhlongs/sophia-ai-factory` (branch `feat/domain-01-cloudflare-workers-dev`, base `82439be20898a26fbcade444b1e33e52d5b7bd3c`)
> **Cloudflare Account:** `f691e83094f776311a1bfe3f8b126f1c` (subdomain `agencyos-openclaw`)
> **Technical Entrypoints:**
> - Production: `https://sophia-ai-factory.agencyos-openclaw.workers.dev`
> - Pilot: `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev`
> **Registrar Status (`agencyos.network`):** Active at Namecheap, expires `2026-12-17T06:06:12Z` (`clientTransferProhibited`). Not renewed as part of this mission.

---

## 1. Classification Legend (G3)

| Code | Category | Meaning |
|---|---|---|
| **A** | Required technical endpoint | Worker runtime/technical identity, health/version probes, internal service routing |
| **B** | Customer-facing origin | Auth base URLs, redirects, magic links, password reset, email verification, referral/share URLs, SEO/OpenGraph/RSS |
| **C** | Legacy domain reference | Transition allowlist, edition recognition, CNAME targets, transactional `From` / support email addresses |
| **D** | External callback dependency | Third-party webhooks/OAuth/payment IPNs registered outside this repo (HeyGen, NOWPayments, PayOS, Telegram, Resend, Cloudflare Access, R2 custom domain) |
| **E** | Build-time hardcoded URL | `NEXT_PUBLIC_APP_URL` or literal `https://sophia.agencyos.network` embedded in client bundles or static metadata |
| **F** | Unrelated historical documentation | Comments, SDK examples, historical runbooks, test fixtures |

---

## 2. G3 — Full Categorized Inventory (File & Line References)

### Category A — Required Technical Endpoints & CI/CD

| File | Line(s) | Current / Updated State | Risk | Action Taken |
|---|---|---|---|---|
| `apps/sophia-ai-factory/wrangler.toml` | 140-148 | Added `WORKER_TECHNICAL_URL`, `ALLOWED_HOSTS`, switched `BETTER_AUTH_URL`/`APP_URL` to `sophia-ai-factory.agencyos-openclaw.workers.dev` | High (if prod cutover not authorized yet) | Source-refactored only; NOT deployed to production |
| `apps/sophia-ai-factory/wrangler.pilot.toml` | 33-34, 60-65 | `workers_dev = false`, `preview_urls = false` preserved (Gate 2 waiver); added `WORKER_TECHNICAL_URL` + `ALLOWED_HOSTS` | High (Access verification required before enabling `workers_dev = true`) | Preserved fail-closed |
| `.github/workflows/deploy.yml` | 164-170, 226-306 | Replaced hardcoded `https://sophia.agencyos.network` with `vars.DEPLOY_VERIFY_URL` (defaults to legacy until Founder switches var) | Medium | Decoupled CI from brand domain |
| `apps/sophia-ai-factory/src/app/api/cron/uptime-check/uptime-check-helpers.ts` | 26-29 | Replaced hardcoded fallback with `getDefaultPublicOrigin()` | Medium | Decoupled |
| `apps/sophia-ai-factory/src/seed/config/edition-config.ts` | 42-48 | Added `PRODUCTION_TECHNICAL_HOST` & `PILOT_TECHNICAL_HOST` to `OFFICIAL_HOSTS` alongside legacy hosts | High (without this, `workers.dev` would downgrade edition to `community`) | Fixed |

### Category B — Customer-Facing Origins & Auth Flows

| File | Line(s) | Occurrence | Risk | Action Taken |
|---|---|---|---|---|
| `apps/sophia-ai-factory/src/seed/auth/server/types.ts` | 15-40 | Hardcoded `sophia.agencyos.network` default | Critical | Replaced with `PRODUCTION_TECHNICAL_ORIGIN` / `PILOT_TECHNICAL_ORIGIN` |
| `apps/sophia-ai-factory/src/seed/auth/server/auth-instance.ts` | 70-130 | Static single-domain `baseURL` & `trustedOrigins` | Critical | Upgraded to Better Auth v1.7.25 dynamic `baseURL: { allowedHosts, fallback, protocol }` + async `trustedOrigins` + live D1 sync |
| `apps/sophia-ai-factory/src/seed/auth/server/passkey-and-otp-plugins.ts` | 20-45 | Static `rpID`/`origin` bound to single host | High | Omitted static `rpID`/`origin` when multi-domain enabled so Better Auth derives per-request |
| `apps/sophia-ai-factory/src/seed/auth/server/plugin-configs.ts` | 25-45 | Hardcoded `sophia.agencyos.network` in welcome email | Medium | Switched to `getDefaultPublicOrigin()` |
| `apps/sophia-ai-factory/src/seed/auth/better-auth-client.ts` | 20-35 | Hardcoded SSR fallback | Medium | Switched to `getDefaultPublicOrigin()` |
| `apps/sophia-ai-factory/src/app/api/auth/[...all]/route.ts` | 1-55 | No fail-closed Host check before Better Auth | Critical | Added lazy D1 sync + `enforceAllowedRequestHost(request)` (HTTP 421 on unknown Host) |
| `apps/sophia-ai-factory/src/app/api/auth/reset-password/request/route.ts` | 28, 72 | Hardcoded `BASE_URL` fallback | High | Switched to `getSafeOriginFromRequest(request)` |
| `apps/sophia-ai-factory/src/app/api/account/change-email/route.ts` | 105-108 | Hardcoded `NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'` | High | Switched to `getSafeOriginFromRequest(req)` |
| `apps/sophia-ai-factory/src/app/api/account/change-email/verify/route.ts` | 27-30, 104-106 | Hardcoded redirect fallback | High | Switched to `getSafeOriginFromRequest(req)` |
| `apps/sophia-ai-factory/src/app/api/account/delete/request/request-handlers.ts` | 80-84 | Hardcoded `NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'` | High | Switched to `getDefaultPublicOrigin()` |
| `apps/sophia-ai-factory/src/app/api/welcome/resend/route.ts` | 89-91 | Hardcoded magic-link fallback | High | Switched to `getSafeOriginFromRequest(request)` |
| `apps/sophia-ai-factory/src/app/api/checkout/modules/get-checkout-handler.ts` | 12 | Hardcoded checkout redirect fallback | High | Switched to `getSafeOriginFromRequest(request)` |
| `apps/sophia-ai-factory/src/middleware.ts` | 1-60 | No fail-closed Host/`X-Forwarded-Host` validation | Critical | Added lazy D1 sync + `enforceAllowedRequestHost(request)` |
| `apps/sophia-ai-factory/src/middleware/cors.ts` | 30-55 | Allowed wildcard `a === '*'` in `isOriginAllowed()` | High | Removed wildcard acceptance (exact allowlisted origins only) |
| `apps/sophia-ai-factory/src/seed/security/cors-security-configuration.ts` | 15-45 | Hardcoded `sophia.agencyos.network` | High | Switched to `resolveAllowedCorsOrigins()` via `@/seed/domain` |
| `apps/sophia-ai-factory/src/seed/pilot/pilot-access-policy.ts` | 10-40 | Hardcoded `pilot.sophia.agencyos.network` | High | Switched to `PILOT_TECHNICAL_ORIGIN` |

### Category C — Legacy Domain References (Email Senders, White-Label CNAMEs, Transition Hosts)

| File | Line(s) | Reference | Risk if Expired | Recommended Action |
|---|---|---|---|---|
| `src/land/billing/email/*.ts` (6 files) | 59-83 | `billing@sophia.agencyos.network`, `noreply@sophia.agencyos.network` | **Critical** — SPF/DKIM breaks when DNS expires; transactional emails fail or spoofed by re-acquirer | Move Resend verified sender to new brand domain or interim owned domain before `2026-12-17` |
| `src/land/monitoring/reconcile-alert.ts` | 14 | `ops@sophia.agencyos.network` | High | Migrate sender via `RESEND_FROM_EMAIL` env var |
| `src/tree/email/sender.ts`, `email-campaign.ts`, `email-test.ts` | 22, 57, 58 | `noreply@sophia.agencyos.network` | **Critical** | Migrate sender via `RESEND_FROM_EMAIL` env var |
| `src/app/api/cron/weekly-signals-digest/weekly-digest-delivery.ts` | 30 | `digest@sophia.agencyos.network` | Medium | Migrate sender via `RESEND_FROM_EMAIL` |
| `src/app/api/cron/error-digest/digest-core/dispatchers.ts` | 59 | `noreply@sophia.agencyos.network` | Medium | Migrate sender via `RESEND_FROM_EMAIL` |
| `src/tree/billing/invoices/html-body-sections.ts` | 28 | `support@sophia.agencyos.network` | High (customer replies go to hijacked domain after expiry) | Replace with active support email before expiry |
| `src/tree/custom-domains/verification/types.ts` | 7-13 | `DEFAULT_CNAME_TARGET = 'cname.sophia.agencyos.network'` | High (custom-domain onboarding CNAME) | Switch CNAME target to Cloudflare SaaS fallback or new brand domain |
| `src/tree/custom-domains/resolver/hostname-utils.ts` | 10-16, 77 | `CANONICAL_DOMAINS` | Low | Added `PRODUCTION_TECHNICAL_HOST` & `PILOT_TECHNICAL_HOST`; legacy kept for transition |
| `src/tree/branding/repo/types.ts` | 55 | Reserved hostname list | Low | Keep during transition |
| `src/tree/agy/router/constants.ts` | 32 | `CANONICAL_NETWORK_DOMAIN = 'agencyos.network'` | Low | AgencyOS subdomain router — deprecate after domain retirement |

### Category D — External Callback & Infrastructure Dependencies

| External System | Current URL / Domain | Source Reference | Risk if `agencyos.network` Expires | Cutover Requirement |
|---|---|---|---|---|
| **Cloudflare Worker Custom Domains** | `sophia.agencyos.network` (prod), `pilot.sophia.agencyos.network` (pilot) | Cloudflare Zone `agencyos.network` | **Critical** — TLS renewal fails, DNS stops resolving, eventual re-acquisition enables phishing | Founder-authorized production cutover to `workers.dev`, then detach legacy custom domains |
| **Cloudflare R2 Public Custom Domain** | `https://assets.agencyos.network/demos/*.mp4` | `src/land/telegram-sales/sample-video-catalog.ts:26-86` | **High** — Demo videos in Telegram sales bot break | Switch R2 public bucket to `r2.dev` or future brand media subdomain |
| **HeyGen Webhooks** | `https://sophia.agencyos.network/api/webhooks/heygen` | `src/app/api/setup-wizard/heygen/auto-register/route.ts` (decoupled), `src/app/api/setup-wizard/save-credentials/save-credentials-helpers.ts` (skipped due to privacy hook — follow-up) | **High** — Existing customer HeyGen webhooks keep posting to old domain; re-acquirer could receive webhook payloads | Re-register customer webhooks via `/api/setup-wizard/heygen/auto-register` after cutover + rotate `heygen_webhook_secret` |
| **NOWPayments IPN / Checkout** | `https://sophia.agencyos.network/api/webhooks/nowpayments` + checkout return URLs | `src/tree/clients/nowpayments/nowpayments-client.ts` (decoupled) | **Critical** — Payment IPN delivery fails; tier activation stalls | Update IPN callback URL in NOWPayments merchant dashboard to `workers.dev` (or future brand domain) + verify `NOWPAYMENTS_IPN_SECRET` |
| **PayOS Webhooks / Return URLs** | Return/cancel URLs + merchant webhook | `src/land/payments/payos-gateway/payos-service.ts` (decoupled) | **Critical** — VND bank transfer confirmation fails | Update PayOS merchant dashboard webhook URL |
| **Telegram Bot (`@Sophia_Bbot`)** | Webhook URL (`setWebhook`) + inline button links | `src/tree/telegram/handlers/*.ts`, `src/land/openclaw-telegram/handlers/*.ts` | **Critical** — Bot stops receiving updates if webhook still points to `sophia.agencyos.network` | Run Telegram `setWebhook` to `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/telegram/webhook` with rotated `secret_token` |
| **Resend (Transactional Email)** | DKIM/SPF/DMARC DNS records on `agencyos.network` | `src/tree/email/sender.ts`, `src/land/billing/email/*.ts` | **Critical** — Password reset, email verification, billing receipts fail | Verify a non-expiring sender domain in Resend before `2026-12-17` |
| **OAuth Providers (Google / GitHub / Social Publishing)** | Authorized redirect URIs | Better Auth social providers & social publishing callbacks | **High** — OAuth login & social publishing fail on new domain | Manually register new redirect URIs in each OAuth provider console (`ADD_BRAND_DOMAIN` prints exact checklist) |
| **Cloudflare Access (`11a89148-d86e-4d3e-a1d4-e12edbeb6f75`)** | Worker-level Access on `sophia-ai-factory-pilot` | Cloudflare Zero Trust | **High** — Must verify Access destination is Worker ID (not hostname) before enabling `workers_dev = true` | Blocked pending read-only Zero Trust token verification |

### Category E — Build-Time Hardcoded URLs (Client Bundles & Static Metadata)

| File | Line(s) | Previous Hardcoded Value | Action Taken |
|---|---|---|---|
| `src/app/layout.tsx` | 20-35 | `https://sophia.agencyos.network` | Switched to `getDefaultPublicOrigin()` |
| `src/app/robots.ts` | 1-20 | `https://sophia.agencyos.network` | Switched to `getDefaultPublicOrigin()` |
| `src/app/[locale]/home-metadata.ts` | 4-5 | `https://sophia.agencyos.network` | Switched to `getDefaultPublicOrigin()` |
| `src/app/[locale]/blog/page.tsx` | 22 | `https://sophia.agencyos.network/blog/feed.xml` | Switched to relative `/blog/feed.xml` |
| `src/app/blog/feed.xml/route.ts` | 10, 24-52 | `https://sophia.agencyos.network` | Switched to `getSafeOriginFromRequest(request)` |
| `src/app/ref/[code]/page.tsx` | 34 | `https://sophia.agencyos.network/ref/${code}` | Switched to `${getDefaultPublicOrigin()}/ref/${code}` |
| `src/app/[locale]/partner/partner-portal-client.tsx` | 30 | `https://sophia.agencyos.network/?ref=...` | Switched to `window.location.origin` |
| `src/app/components/affiliate/copy-referral-link.tsx` | 55, 61 | `https://sophia.agencyos.network/?ref=...` | Switched to `window.location.origin` / `window.location.host` |
| `src/app/components/affiliate/dashboard/partner-dashboard-view.tsx` | 31 | Fallback `https://sophia.agencyos.network` | Switched to `window.location.origin` (`''` SSR) |
| `src/app/components/deals/dashboard/deals-modal-handlers.ts` | 58 | `https://sophia.agencyos.network/sandbox/...` | Switched to `window.location.origin` |
| `src/forest/components/dashboard/referral-share-widget.tsx` | 30 | `NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'` | Switched to `window.location.origin` |
| `src/forest/deals/sandbox-provision-modal.tsx` | 37 | `https://sophia.agencyos.network/sandbox/...` | Switched to `window.location.origin` |
| `src/seed/aeo/ground-truth-catalog.ts` | 10-40 | `https://sophia.agencyos.network` | Switched to `getDefaultPublicOrigin()` |

### Category F — Unrelated Historical Documentation / Non-Critical Fallbacks

- Remaining occurrences in `src/sdk/examples/*`, `src/tree/handover/runbook/*`, `src/tree/telegram/handlers/*` (text copy), `src/seed/openapi/specs/info.ts`, `src/land/seo/schema-org-site.ts`, and `scripts/*` (local ops scripts with `PROD_URL` env override) do not block runtime `workers.dev` or multi-domain auth and can be updated incrementally or via env var overrides (`PROD_URL`, `NEXT_PUBLIC_APP_URL`).

---

## 3. G10 — `agencyos.network` Expiration & Re-Acquisition Threat Model

**Expiration Date:** `2026-12-17T06:06:12Z` (Namecheap).
**Policy:** Do **NOT** renew without Founder approval. Do **NOT** delete Cloudflare zone or DNS records prematurely. Do **NOT** transfer or sell.

### Critical Security Risk: Third-Party Domain Re-Acquisition
If `agencyos.network` expires and is later purchased by an unrelated third party (drop-catch):
1. **Email hijacking (CRITICAL):** Any password-reset reply, customer support email to `support@sophia.agencyos.network`, or third-party account recovery tied to `@agencyos.network` mailboxes would be delivered to the attacker.
2. **Webhook/IPN interception (CRITICAL):** Any external provider still configured with `https://sophia.agencyos.network/api/webhooks/*` (NOWPayments, PayOS, HeyGen, Telegram) will POST signed/unsigned payloads (and potentially customer metadata) to the attacker's server.
3. **OAuth redirect hijacking (HIGH):** Any OAuth app retaining `https://sophia.agencyos.network/api/auth/callback/*` as an authorized redirect URI lets an attacker intercept authorization codes.
4. **Phishing / brand impersonation (MEDIUM):** Existing links in sent emails/Telegram messages point to `sophia.agencyos.network`.

### Mandatory Pre-Expiration Retirement Checklist (Before `2026-12-17`)

1. **Rotate & re-point webhooks** (in order):
   - Telegram `@Sophia_Bbot`: `setWebhook` -> `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/telegram/webhook` + rotate webhook `secret_token`.
   - NOWPayments: update IPN URL in dashboard + rotate `NOWPAYMENTS_IPN_SECRET`.
   - PayOS: update webhook URL in dashboard + verify checksum key.
   - HeyGen: re-register active customer webhooks via `/api/setup-wizard/heygen/auto-register` + rotate `heygen_webhook_secret`.
   - Update `src/app/api/setup-wizard/save-credentials/save-credentials-helpers.ts` (skipped in this PR due to privacy hook) in a tiny follow-up commit to replace its hardcoded webhook URL.
2. **Revoke OAuth redirect URIs**: remove `https://sophia.agencyos.network/*` from Google/GitHub/social OAuth apps after adding `workers.dev` / new brand domain.
3. **Migrate transactional email sender & support email**: configure a verified sender domain in Resend and update `RESEND_FROM_EMAIL` + `SUPPORT_EMAIL` before DNS stops resolving.
4. **Migrate R2 demo assets**: move `assets.agencyos.network` demo video URLs to R2 public URL or new brand media domain.
5. **Remove legacy hosts from `ALLOWED_HOSTS`**: once Founder authorizes production cutover and legacy traffic drains, remove `sophia.agencyos.network` from `wrangler.toml` `ALLOWED_HOSTS` and detach the Custom Domain from `sophia-ai-factory`.
6. **Cloudflare Token Security Hold**: Founder must confirm in Cloudflare Dashboard -> My Profile -> API Tokens that all previously exposed Cloudflare API tokens have been revoked. Until verified, retain `DOMAIN01_TOKEN_INCIDENT: FOUNDER_CONFIRMATION_REQUIRED`.
