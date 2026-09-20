# Handoff Report: Milestone 1 Hostname Router & White-Label Email Formatter

**Agent**: `teamwork_preview_explorer_m1_3`  
**Parent**: Orchestrator (`78b5382f-0b81-4402-ad59-b06284d61c09`)  
**Date**: 2026-09-20  
**Status**: Investigation Complete & Blueprint Ready  
**Scope**: Milestone 1 (Enterprise White-Label & Custom Domain Engine) — Hostname-to-Tenant Edge Router & White-Label Email Formatter  

---

## 1. Observation

### 1.1 Existing Hostname and Middleware Routing Infrastructure
- **Location**: `apps/sophia-ai-factory/src/middleware.ts`
  - In lines 68–160, `proxyImpl(request: NextRequest)` intercepts all non-static requests (`matcher: ['/((?!_next|_worker|auth/callback|api/version|.*\\..*).*)']`).
  - Lines 76: `if (isInternalOrStatic(pathname)) return NextResponse.next();`
  - Lines 141–142:
    ```typescript
    const nonce = generateNonce();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CSP_NONCE_HEADER, nonce);
    ```
  - Lines 149–159: Dispatches to sub-pipeline handlers passing `requestHeaders`:
    ```typescript
    const apiRes = await handleApiPipeline(request, pathname, pathLocale, startTime, requestHeaders, nonce, needsCsrfSeed);
    if (apiRes) return apiRes;
    const dashRes = await handleDashboardPipeline(request, pathLocale, requestHeaders, nonce, needsCsrfSeed);
    if (dashRes) return dashRes;
    return handlePublicPipeline(request, origin, requestHeaders, nonce, needsCsrfSeed);
    ```
  - Each pipeline handler applies `requestHeaders` to the returned response using:
    `NextResponse.next({ request: { headers: requestHeaders } })` or `NextResponse.rewrite(..., { request: { headers: requestHeaders } })`.
- **D1 Access at Edge Runtime**:
  - `apps/sophia-ai-factory/src/seed/db/client.ts` lines 207–243: `getD1()` retrieves `D1Database` from `globalThis.__env__.DB`, fallback `globalThis.__env.DB`, or `Symbol.for('__cloudflare-context__')`.
  - Used in `src/seed/security/d1-rate-limiter.ts` and `src/forest/middleware/rate-limiter.ts` line 39 directly from middleware without blocking.
- **Missing Custom Domain Logic**:
  - The folder `apps/sophia-ai-factory/src/tree/custom-domains/` does not yet exist.
  - No parsing of incoming `Host` or `X-Forwarded-Host` headers currently takes place for tenant association.
  - All requests currently assume single-tenant or canonical domain execution on `sophia.agencyos.network`.

### 1.2 Existing Email Templating & Sender Architecture
- **Core Email Sender**: `apps/sophia-ai-factory/src/tree/email/sender.ts`
  - Lines 13–21:
    ```typescript
    export interface EmailParams {
      to: string;
      from?: string;
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
      tags?: Array<{ name: string; value: string }>;
    }
    ```
  - Line 35: `const from = params.from ?? process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';`
  - Direct HTTP POST to Resend API (`https://api.resend.com/emails`) with Bearer token authentication.
- **Layout & Branding Primitives**: `apps/sophia-ai-factory/src/tree/email/templates/shared-layout.ts`
  - Lines 7–10:
    ```typescript
    export const BRAND_COLOR = '#7c3aed';
    export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
    export const SUPPORT_EMAIL = 'support@mekongmind.com';
    export const SENDER_FROM = process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';
    ```
  - Lines 30–42: `brandHeader()` renders static hardcoded `"Sophia AI Factory"`; `footer()` renders static `Support: support@mekongmind.com`.
  - Line 58: `export function htmlToText(html: string): string` converts HTML to plain text fallback.
- **Existing Tenant Branding Resolver**: `apps/sophia-ai-factory/src/land/billing/email/tenant-branding-resolver.ts`
  - Lines 12–16:
    ```typescript
    export interface ResolvedEmailBranding {
      fromName: string | null;
      footerMarkdown: string | null;
      logoUrl: string | null;
    }
    ```
  - Lines 64–76: `appendEmailFooter(html, footerMarkdown)` appends a basic escaped footer block.
  - Lines 81–84: `buildLogoImgTag(logoUrl)` renders `<img src="${logoUrl}" alt="logo" ...>`.
  - Tested in `src/app/api/v1/branding/__tests__/upload.test.ts` lines 110–151.
- **Tenant Settings Definition**: `apps/sophia-ai-factory/src/seed/tenant-settings/defaults.ts`
  - Lines 17–28:
    ```typescript
    export interface BrandingSettings {
      logoUrl: string | null;
      primaryColor: string;
      accentColor: string | null;
      agencyName: string | null;
      welcomeMessage: string | null;
      customDomain: string | null;
      emailFromName: string | null;
      emailFooter: string | null;
      faviconUrl: string | null;
      socialMeta: SocialMeta | null;
    }
    ```
- **Organization Branding Repository**: `apps/sophia-ai-factory/src/tree/branding/org-branding-repo.ts`
  - Queries `org_branding` table (`org_id`, `agency_name`, `logo_url`, `primary_color`, `watermark_policy`) and `tenant_settings WHERE namespace = 'branding'`.

### 1.3 Layer Boundary Enforcement
- `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` strictly enforces:
  - `tree → land`: Forbidden (`grep -rn "from ['\"]@/land" src/tree/`).
  - `tree → forest`: Forbidden (`grep -rn "from ['\"]@/forest" src/tree/`).
  - `seed → tree/forest/land`: Forbidden.
  - `land → forest`: Forbidden.
  - Banned legacy imports: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

---

## 2. Logic Chain

### 2.1 Hostname-to-Tenant Edge Router (`hostname-resolver.ts` & `middleware.ts`)
1. **Observation 1.1**: The Edge runtime receives incoming requests where the `Host` or `X-Forwarded-Host` header identifies the domain targeted by the browser.
2. **Fact**: Canonical infrastructure domains (`sophia.agencyos.network`, `localhost`, `*.pages.dev`, `*.workers.dev`) serve the core platform and must not incur database queries on every request.
3. **Reasoning**:
   - Create an edge filter `isInternalOrCanonicalHostname(hostname)` that evaluates canonical domains via exact matching and suffix checking (`.pages.dev`, `.workers.dev`, `.agencyos.network`, `localhost`).
   - If matched, the resolver returns early with `{ isInternal: true, whitelabelActive: false, tenantOrgId: null }` with zero D1 overhead.
   - For custom hostnames (e.g. `portal.creatoragency.com`):
     - Normalize: strip port, trim whitespace, lowercase.
     - Check an in-memory isolate LRU cache (TTL 60 seconds) to prevent D1 saturation under high edge traffic.
     - Query `custom_domains` in D1:
       ```sql
       SELECT org_id, hostname, active, ssl_status
       FROM custom_domains
       WHERE hostname = ?1 AND active = 1
       LIMIT 1
       ```
     - If active (`active = 1` and `ssl_status = 'active'`), mark `whitelabelActive = true`.
4. **Header Injection (Observation 1.1)**:
   - In `src/middleware.ts`, after creating `requestHeaders = new Headers(request.headers)`, invoke `resolveTenantFromHostname(db, host)`.
   - Inject the headers:
     - `x-tenant-org-id`: `context.tenantOrgId`
     - `x-custom-domain`: `context.customDomain`
     - `x-whitelabel-active`: `'true'` or `'false'`
   - These headers propagate into `handleApiPipeline`, `handleDashboardPipeline`, and `handlePublicPipeline`, enabling downstream Server Components, Route Handlers, and Actions to read `headers().get('x-tenant-org-id')` without redundant queries.

### 2.2 White-Label Email Formatter (`email-styler.ts` & `tenant-branding-resolver.ts`)
1. **Observation 1.2**: Transactional emails currently leak `"Sophia AI Factory"` in `brandHeader()` and `support@mekongmind.com` in `footer()` from `src/tree/email/templates/shared-layout.ts`.
2. **Fact**: Enterprise MASTER tier requires 100% agency white-labeling:
   - Header: Custom agency logo (`<img>`) or agency name typography. When unconfigured, fallback to a clean neutral unbranded layout with ZERO vendor mention.
   - Styling: Buttons and links styled with the tenant's brand primary color (with WCAG compliant contrast text).
   - Footer: Custom agency legal disclaimer, custom support email, and unbranded unsubscribe link.
3. **Layer Architecture Placement**:
   - `src/tree/branding/email-styler.ts` belongs to the `tree` layer (pure domain rendering & styling logic). It imports only from `seed` and fellow `tree` modules.
   - `src/land/billing/email/tenant-branding-resolver.ts` belongs to `land` (queries D1 via `getD1()` and `getOrDefault`). It calls `formatWhiteLabelEmail` from `@/tree/branding/email-styler.ts`.
   - `src/tree/email/sender.ts` belongs to `tree`. It imports `formatWhiteLabelEmail` from `@/tree/branding/email-styler.ts` (allowed `tree → tree`).
   - This prevents circular dependencies and guarantees 0 layer violations (`scripts/check-layer-boundaries.sh`).

---

## 3. Caveats
1. **Cloudflare Custom Hostname SSL Status**: Custom domains may be created in D1 with `ssl_status = 'pending_validation'` while DNS CNAME or TXT records propagate. During this phase, `whitelabelActive` evaluates to `false` until Cloudflare for SaaS confirms certificate issuance (`active`), preventing broken SSL/untrusted certificate warnings.
2. **Negative Caching at the Edge**: In-memory caching in Cloudflare Workers isolates is per-isolate. When an unknown domain is probed, we apply a 10-second negative cache TTL. Cache entries will naturally evict when worker isolates recycle.
3. **Email Client CSS Stripping**: Email clients like Gmail Web and mobile strip `<style>` blocks or pseudo-classes. `email-styler.ts` therefore applies both inline CSS replacements on `style="..."` attributes and document `<style>` declarations for maximum fidelity across clients.
4. **Resend Sender Domain Verification**: Sending from a custom domain (e.g. `noreply@creatoragency.com`) via Resend requires the domain to be verified in Resend. If unverified, `sender.ts` falls back to `EMAIL_FROM` with dynamic display name formatting (e.g. `Agency Name via Sophia <noreply@mekongmind.com>`) and `Reply-To: support@creatoragency.com` to guarantee 100% deliverability.

---

## 4. Conclusion & Complete Code Blueprint

### 4.1 Component 1: Hostname-to-Tenant Edge Router
**Target File**: `apps/sophia-ai-factory/src/tree/custom-domains/hostname-resolver.ts`

```typescript
/**
 * Hostname-to-Tenant Edge Router
 * 
 * Maps incoming HTTP Host / X-Forwarded-Host headers to tenant organization context.
 * Filters internal/canonical hostnames early to bypass database queries.
 * Queries Cloudflare D1 custom_domains table with in-memory edge caching.
 *
 * Layer: tree (pure domain logic)
 * Allowed imports: @/seed/*
 *
 * @module tree/custom-domains/hostname-resolver
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface TenantHostnameContext {
  /** True if the domain is a platform canonical or development domain */
  isInternal: boolean;
  /** True if the domain is recognized as a tenant custom domain */
  isCustomDomain: boolean;
  /** Tenant organization ID if mapped, otherwise null */
  tenantOrgId: string | null;
  /** Normalized custom domain string, or null */
  customDomain: string | null;
  /** True only if active=1 AND ssl_status='active' */
  whitelabelActive: boolean;
  /** Current SSL certificate status */
  sslStatus: 'pending_validation' | 'pending_deployment' | 'active' | 'error' | null;
}

interface CacheEntry {
  context: TenantHostnameContext;
  expiresAt: number;
}

/** In-memory isolate cache for custom domain resolution (60s TTL) */
const DOMAIN_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const MAX_CACHE_SIZE = 500;

/** Platform canonical domains and patterns that must never query D1 */
const CANONICAL_DOMAINS = new Set([
  'sophia.agencyos.network',
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

/**
 * Normalizes raw incoming host header by lowercasing, trimming,
 * and stripping port numbers and trailing dots.
 */
export function normalizeHostname(rawHost: string | null | undefined): string {
  if (!rawHost) return '';
  let host = rawHost.trim().toLowerCase();

  // Strip protocol if erroneously passed
  if (host.startsWith('http://')) host = host.slice(7);
  if (host.startsWith('https://')) host = host.slice(8);

  // Strip path if present
  const slashIdx = host.indexOf('/');
  if (slashIdx !== -1) host = host.slice(0, slashIdx);

  // Strip IPv6 brackets or port
  if (host.startsWith('[')) {
    const endBracket = host.indexOf(']');
    if (endBracket !== -1) {
      host = host.slice(1, endBracket);
    }
  } else {
    // Strip standard port
    const colonIdx = host.indexOf(':');
    if (colonIdx !== -1) {
      host = host.slice(0, colonIdx);
    }
  }

  // Strip trailing dot (DNS FQDN)
  if (host.endsWith('.')) {
    host = host.slice(0, -1);
  }

  return host;
}

/**
 * Checks if a hostname belongs to platform infrastructure or local development.
 * Ignores:
 * - localhost, 127.0.0.1, ::1
 * - sophia.agencyos.network and *.agencyos.network
 * - *.pages.dev (Cloudflare Pages preview deployments)
 * - *.workers.dev (Cloudflare Workers preview deployments)
 * - Hostnames matching NEXT_PUBLIC_APP_URL or APP_URL env vars
 */
export function isInternalOrCanonicalHostname(hostname: string): boolean {
  if (!hostname) return true;

  if (CANONICAL_DOMAINS.has(hostname)) return true;

  // Localhost or IPv4 loopback
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.startsWith('127.') || hostname === '0.0.0.0') return true;

  // Cloudflare edge platform domains
  if (hostname.endsWith('.pages.dev') || hostname === 'pages.dev') return true;
  if (hostname.endsWith('.workers.dev') || hostname === 'workers.dev') return true;

  // AgencyOS canonical network
  if (hostname.endsWith('.agencyos.network') || hostname === 'agencyos.network') return true;

  // Check against runtime environment app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl).hostname.toLowerCase();
      if (hostname === parsed) return true;
    } catch {
      // ignore URL parse errors
    }
  }

  return false;
}

/**
 * Extracts normalized hostname from incoming Request or Headers.
 * Prioritizes x-forwarded-host (reverse proxy / Cloudflare) over host header.
 */
export function extractHostname(source: Request | Headers | string | null | undefined): string {
  if (!source) return '';
  if (typeof source === 'string') return normalizeHostname(source);

  const headers = source instanceof Request ? source.headers : source;
  const forwardedHost = headers.get('x-forwarded-host');
  if (forwardedHost) {
    // x-forwarded-host may be comma-separated: take client-first entry
    const first = forwardedHost.split(',')[0];
    return normalizeHostname(first);
  }

  const host = headers.get('host');
  if (host) return normalizeHostname(host);

  if (source instanceof Request) {
    try {
      return normalizeHostname(new URL(source.url).hostname);
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * Resolves custom hostname against active custom_domains table in D1.
 * Applies in-memory edge caching to prevent D1 contention.
 */
export async function resolveTenantFromHostname(
  db: D1Database | null,
  rawHost: string | null | undefined,
): Promise<TenantHostnameContext> {
  const hostname = normalizeHostname(rawHost);

  // 1. Check canonical / internal domains
  if (!hostname || isInternalOrCanonicalHostname(hostname)) {
    return {
      isInternal: true,
      isCustomDomain: false,
      tenantOrgId: null,
      customDomain: null,
      whitelabelActive: false,
      sslStatus: null,
    };
  }

  // 2. Check isolate in-memory cache
  const cached = DOMAIN_CACHE.get(hostname);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.context;
  }

  // 3. Fallback when D1 database is unavailable (e.g. build step or early init)
  if (!db) {
    const unverifiedContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
    return unverifiedContext;
  }

  // 4. Query D1 database
  try {
    const row = await db
      .prepare(
        `SELECT org_id, hostname, active, ssl_status
         FROM custom_domains
         WHERE hostname = ?1 AND active = 1
         LIMIT 1`
      )
      .bind(hostname)
      .first<{
        org_id: string;
        hostname: string;
        active: number;
        ssl_status: string;
      }>();

    if (row && row.org_id) {
      const isSslActive = row.ssl_status === 'active';
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: row.org_id,
        customDomain: row.hostname,
        whitelabelActive: row.active === 1 && isSslActive,
        sslStatus: (row.ssl_status as TenantHostnameContext['sslStatus']) ?? 'pending_validation',
      };

      setInCache(hostname, context, CACHE_TTL_MS);
      return context;
    }

    // 5. Hostname not found in custom_domains table (negative cache)
    const notFoundContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };

    setInCache(hostname, notFoundContext, NEGATIVE_CACHE_TTL_MS);
    return notFoundContext;
  } catch (err) {
    logger.warn('[hostname-resolver] Error resolving hostname in D1', {
      hostname,
      error: String(err),
    });

    return {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
  }
}

function setInCache(key: string, context: TenantHostnameContext, ttlMs: number): void {
  if (DOMAIN_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = DOMAIN_CACHE.keys().next().value;
    if (oldestKey) DOMAIN_CACHE.delete(oldestKey);
  }
  DOMAIN_CACHE.set(key, {
    context,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clears the edge hostname resolution cache (useful for testing or domain updates).
 */
export function clearHostnameCache(): void {
  DOMAIN_CACHE.clear();
}

/**
 * Injects resolved tenant headers into requestHeaders for downstream Next.js handlers.
 */
export function injectTenantRoutingHeaders(
  requestHeaders: Headers,
  context: TenantHostnameContext,
): void {
  if (context.whitelabelActive && context.tenantOrgId) {
    requestHeaders.set('x-tenant-org-id', context.tenantOrgId);
    requestHeaders.set('x-custom-domain', context.customDomain ?? '');
    requestHeaders.set('x-whitelabel-active', 'true');
  } else if (context.isCustomDomain && context.customDomain) {
    if (context.tenantOrgId) {
      requestHeaders.set('x-tenant-org-id', context.tenantOrgId);
    }
    requestHeaders.set('x-custom-domain', context.customDomain);
    requestHeaders.set('x-whitelabel-active', 'false');
  } else {
    requestHeaders.set('x-whitelabel-active', 'false');
  }
}

/**
 * Downstream accessor helpers for Server Components, Route Handlers, and Actions.
 */
export function getTenantOrgId(headers: Headers): string | null {
  return headers.get('x-tenant-org-id');
}

export function getCustomDomain(headers: Headers): string | null {
  return headers.get('x-custom-domain');
}

export function isWhitelabelActive(headers: Headers): boolean {
  return headers.get('x-whitelabel-active') === 'true';
}
```

---

### 4.2 Middleware Integration
**Target File**: `apps/sophia-ai-factory/src/middleware.ts`  
**Integration Point**: Lines 141–148 in `proxyImpl`.

```typescript
// --- INGESTION IN src/middleware.ts ---
import {
  resolveTenantFromHostname,
  injectTenantRoutingHeaders,
  extractHostname,
} from '@/tree/custom-domains/hostname-resolver';
import { getD1 } from '@/seed/db/client';

// Inside proxyImpl(request: NextRequest):
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  // Hostname-to-Tenant Edge Router Integration
  const host = extractHostname(request);
  const db = await getD1();
  const tenantContext = await resolveTenantFromHostname(db, host);
  injectTenantRoutingHeaders(requestHeaders, tenantContext);

  if (requiresCsrfCheck(pathname, request.method) && !verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }
// Continued pipeline execution ...
```

---

### 4.3 Component 2: White-Label Email Formatter
**Target File**: `apps/sophia-ai-factory/src/tree/branding/email-styler.ts`

```typescript
/**
 * White-Label Email Formatter
 *
 * Provides transactional agency-branded email formatting for MASTER tier tenants.
 * Injects agency logo / typography, brand primary color accents, legal disclaimer,
 * custom support email, and unbranded unsubscribe links.
 * Provides fallback to a clean neutral unbranded layout with ZERO vendor mention.
 *
 * Layer: tree (pure domain logic)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module tree/branding/email-styler
 */

export interface WhiteLabelEmailBranding {
  /** Custom agency display name */
  agencyName?: string | null;
  /** Custom agency logo image URL */
  logoUrl?: string | null;
  /** Primary brand color (hex, e.g. '#6366f1') */
  primaryColor?: string | null;
  /** Secondary/accent brand color */
  accentColor?: string | null;
  /** Custom agency customer support email */
  supportEmail?: string | null;
  /** Agency custom domain */
  customDomain?: string | null;
  /** Legal entity disclaimer or registered address */
  legalDisclaimer?: string | null;
  /** Unbranded unsubscribe link */
  unsubscribeUrl?: string | null;
  /** Markdown/text footer notes */
  emailFooter?: string | null;
  /** Sender display name (e.g. 'Apex Media') */
  emailFromName?: string | null;
  /** Explicit opt-in for platform watermark (default: false in MASTER tier) */
  poweredBySophia?: boolean;
}

export interface EmailFormatOptions {
  /** Document locale: 'vi' or 'en' */
  locale?: 'vi' | 'en';
  /** Inbox preview preheader snippet */
  preheaderText?: string;
  /** Max container width in pixels (default 580) */
  containerWidth?: number;
}

const DEFAULT_PRIMARY_COLOR = '#7c3aed';
const DEFAULT_BG_COLOR = '#09090b';
const DEFAULT_CONTAINER_BG = '#18181b';
const DEFAULT_TEXT_COLOR = '#e4e4e7';
const DEFAULT_MUTED_COLOR = '#a1a1aa';

/**
 * Basic HTML entity escaper to prevent XSS in email clients.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes high-contrast text color (black or white) for buttons.
 */
export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // YIQ luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#09090b' : '#ffffff';
}

/**
 * Formats transactional email body with agency white-label styling.
 * 
 * Injects:
 * 1. Header: Agency logo image or agency name typography; fallback to clean neutral bar.
 * 2. Styling: Brand primary color injected into button backgrounds and link colors.
 * 3. Footer: Agency legal disclaimer, custom support email, and unbranded unsubscribe link.
 */
export function formatWhiteLabelEmail(
  htmlBody: string,
  branding?: WhiteLabelEmailBranding | null,
  options: EmailFormatOptions = {},
): string {
  const primaryColor = branding?.primaryColor && /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)
    ? branding.primaryColor
    : DEFAULT_PRIMARY_COLOR;
  const contrastText = getContrastTextColor(primaryColor);
  const width = options.containerWidth ?? 580;
  const locale = options.locale ?? 'en';

  // 1. Render Header
  const headerHtml = renderEmailHeader(branding, primaryColor);

  // 2. Render Footer
  const footerHtml = renderEmailFooter(branding, primaryColor, locale);

  // 3. Process Content & Apply Brand Color Styling
  const styledBody = applyBrandStyling(htmlBody, primaryColor, contrastText);

  // 4. If htmlBody is already a complete HTML document, inject header & footer
  if (styledBody.includes('<body') && styledBody.includes('</body>')) {
    let doc = styledBody;
    // Inject header after <body> opening
    doc = doc.replace(/(<body[^>]*>)/i, `$1\n${headerHtml}`);
    // Inject footer before </body> closing
    doc = doc.replace(/<\/body>/i, `\n${footerHtml}\n</body>`);
    return doc;
  }

  // 5. Wrap inside a bulletproof responsive email container
  const preheaderHtml = options.preheaderText
    ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${escapeHtml(options.preheaderText)}
       </div>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(branding?.agencyName ?? '')}</title>
  <style type="text/css">
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:${DEFAULT_BG_COLOR}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:${primaryColor}; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .brand-btn { background-color:${primaryColor} !important; color:${contrastText} !important; border-radius:8px; text-decoration:none; display:inline-block; font-weight:600; padding:14px 28px; }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:${DEFAULT_BG_COLOR};color:${DEFAULT_TEXT_COLOR};">
  ${preheaderHtml}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:${width}px;background-color:${DEFAULT_CONTAINER_BG};border:1px solid #27272a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px 32px;" align="center">
              ${headerHtml}
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:16px 32px 32px 32px;font-size:15px;line-height:24px;color:${DEFAULT_TEXT_COLOR};">
              ${styledBody}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderEmailHeader(
  branding: WhiteLabelEmailBranding | null | undefined,
  primaryColor: string,
): string {
  // Case 1: Logo image present
  if (branding?.logoUrl) {
    const altText = escapeHtml(branding.agencyName ?? 'Company Logo');
    return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <img src="${escapeHtml(branding.logoUrl)}" alt="${altText}" style="max-height:48px;max-width:220px;display:block;margin:0 auto;object-fit:contain;" />
        </td>
      </tr>
    </table>`;
  }

  // Case 2: Agency name present
  if (branding?.agencyName) {
    return `<h1 style="font-size:22px;font-weight:700;margin:0 0 8px 0;color:${primaryColor};text-align:center;letter-spacing:-0.3px;">
      ${escapeHtml(branding.agencyName)}
    </h1>`;
  }

  // Case 3: Clean unbranded fallback layout (no Sophia branding, minimalist accent bar)
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding-bottom:8px;">
        <div style="height:3px;width:40px;background-color:${primaryColor};border-radius:2px;margin:0 auto;"></div>
      </td>
    </tr>
  </table>`;
}

function renderEmailFooter(
  branding: WhiteLabelEmailBranding | null | undefined,
  primaryColor: string,
  locale: 'vi' | 'en',
): string {
  const disclaimer = branding?.legalDisclaimer ?? branding?.emailFooter;
  const supportEmail = branding?.supportEmail;
  const unsubscribeUrl = branding?.unsubscribeUrl;

  const supportLabel = locale === 'vi' ? 'Hỗ trợ' : 'Support';
  const unsubscribeLabel = locale === 'vi' ? 'Hủy đăng ký nhận tin' : 'Unsubscribe';

  const rows: string[] = [];

  // Divider
  rows.push(`<hr style="border:none;border-top:1px solid #27272a;margin:24px 0 20px 0;" />`);

  // Support link
  if (supportEmail) {
    rows.push(
      `<p style="font-size:12px;color:${DEFAULT_MUTED_COLOR};margin:0 0 8px 0;text-align:center;">
        ${supportLabel}: <a href="mailto:${escapeHtml(supportEmail)}" style="color:${primaryColor};text-decoration:none;font-weight:500;">${escapeHtml(supportEmail)}</a>
      </p>`
    );
  }

  // Legal disclaimer
  if (disclaimer) {
    rows.push(
      `<p style="font-size:11px;line-height:16px;color:#71717a;margin:8px 0;text-align:center;white-space:pre-wrap;">
        ${escapeHtml(disclaimer)}
      </p>`
    );
  }

  // Unbranded unsubscribe link
  if (unsubscribeUrl) {
    rows.push(
      `<p style="font-size:11px;color:#71717a;margin:12px 0 0 0;text-align:center;">
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">${unsubscribeLabel}</a>
      </p>`
    );
  }

  // Optional platform credit (omitted in pure white-label mode)
  if (branding?.poweredBySophia === true) {
    rows.push(
      `<p style="font-size:10px;color:#52525b;margin:16px 0 0 0;text-align:center;">
        Powered by Sophia AI Factory
      </p>`
    );
  }

  return rows.join('\n');
}

/**
 * Rewrites button and link styling in the provided HTML body.
 * Replaces hardcoded Sophia gradient colors with tenant primary color.
 */
function applyBrandStyling(html: string, primaryColor: string, contrastText: string): string {
  let output = html;

  // Replace button background gradients with tenant primary color
  output = output.replace(
    /background:\s*linear-gradient\([^)]+\)/gi,
    `background-color:${primaryColor}`
  );

  // Replace default purple brand hex (#7c3aed or #a78bfa) with primary color
  output = output.replace(/#7c3aed/gi, primaryColor);

  // Ensure button links have high contrast text
  output = output.replace(
    /(<a[^>]*class=["'][^"']*btn[^"']*["'][^>]*)style=["']([^"']*)["']/gi,
    (match, tagPrefix, styleContent) => {
      const updatedStyle = `background-color:${primaryColor};color:${contrastText};${styleContent}`;
      return `${tagPrefix}style="${updatedStyle}"`;
    }
  );

  return output;
}

/**
 * Converts formatted white-label email to plain text with agency footer.
 */
export function formatWhiteLabelPlainText(
  textBody: string,
  branding?: WhiteLabelEmailBranding | null,
): string {
  let result = textBody.trim();

  if (branding?.agencyName) {
    result = `${branding.agencyName.toUpperCase()}\n\n${result}`;
  }

  const footerParts: string[] = [];
  if (branding?.supportEmail) {
    footerParts.push(`Support: ${branding.supportEmail}`);
  }
  if (branding?.legalDisclaimer ?? branding?.emailFooter) {
    footerParts.push(branding.legalDisclaimer ?? branding.emailFooter!);
  }
  if (branding?.unsubscribeUrl) {
    footerParts.push(`Unsubscribe: ${branding.unsubscribeUrl}`);
  }

  if (footerParts.length > 0) {
    result += `\n\n---\n${footerParts.join('\n')}`;
  }

  return result;
}
```

---

### 4.4 Component 3: Integration with Resend Email Sender
**Target File**: `apps/sophia-ai-factory/src/tree/email/sender.ts`

```typescript
/**
 * Email Sender — Resend integration with White-Label Brand Formatting
 *
 * Sends transactional emails via Resend API (https://resend.com).
 * Injects white-label headers, styling, and footers when branding is provided.
 * Falls back to dry-run logging when RESEND_API_KEY is not configured.
 *
 * Layer: tree
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module tree/email/sender
 */

import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { htmlToText } from '@/tree/email/templates/shared-layout';
import {
  formatWhiteLabelEmail,
  formatWhiteLabelPlainText,
} from '@/tree/branding/email-styler';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  /** Optional agency white-label branding options (MASTER tier) */
  branding?: WhiteLabelEmailBranding | null;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'resend' | 'dry-run';
}

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  if (!shouldAllowRequest('email')) {
    throw new Error('[email-sender] Circuit breaker open for email');
  }

  const apiKey = process.env.RESEND_API_KEY;

  // 1. Resolve 'from' address:
  // If branding specifies custom from name & custom domain, format dynamically
  let from = params.from;
  if (!from) {
    if (params.branding?.emailFromName && params.branding?.customDomain) {
      from = `${params.branding.emailFromName} <noreply@${params.branding.customDomain}>`;
    } else if (params.branding?.emailFromName) {
      from = `${params.branding.emailFromName} <noreply@sophia.agencyos.network>`;
    } else {
      from = process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';
    }
  }

  // 2. Resolve 'replyTo' address:
  const replyTo = params.replyTo ?? params.branding?.supportEmail ?? undefined;

  // 3. Apply White-Label Formatting to HTML:
  let finalHtml = params.html;
  if (finalHtml && params.branding) {
    finalHtml = formatWhiteLabelEmail(finalHtml, params.branding);
  }

  // 4. Generate Plain Text Fallback:
  let finalText = params.text;
  if (!finalText && finalHtml) {
    finalText = htmlToText(finalHtml);
  } else if (finalText && params.branding) {
    finalText = formatWhiteLabelPlainText(finalText, params.branding);
  }

  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured', provider: 'dry-run' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: finalHtml ?? `<pre>${finalText ?? params.subject}</pre>`,
        text: finalText,
        reply_to: replyTo,
        tags: params.tags,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch((err) => {
        logger.warn('Failed to read Resend error response body', {
          error: String(err),
          context: 'sendEmail',
        });
        return '';
      });
      return {
        success: false,
        error: `Resend ${res.status}: ${errBody.slice(0, 200)}`,
        provider: 'resend',
      };
    }

    const data = (await res.json()) as { id?: string };
    return { success: true, messageId: data.id, provider: 'resend' };
  } catch (err) {
    return { success: false, error: toError(err).message, provider: 'resend' };
  }
}
```

---

### 4.5 Component 4: Tenant Branding Resolver Refactoring
**Target File**: `apps/sophia-ai-factory/src/land/billing/email/tenant-branding-resolver.ts`

```typescript
/**
 * Tenant Branding Resolver for Email Send-Time Customization
 *
 * Resolves tenant branding configurations from D1 org_branding & tenant_settings.
 * Delegates white-label HTML formatting to tree/branding/email-styler.
 * Preserves 100% backward compatibility with existing callers.
 *
 * Layer: land (business orchestration)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module billing/email/tenant-branding-resolver
 */

import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import {
  formatWhiteLabelEmail,
  escapeHtml,
} from '@/tree/branding/email-styler';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';

export interface ResolvedEmailBranding {
  fromName: string | null;
  footerMarkdown: string | null;
  logoUrl: string | null;
  agencyName: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  customDomain: string | null;
  supportEmail: string | null;
  legalDisclaimer: string | null;
  unsubscribeUrl: string | null;
  isWhiteLabel: boolean;
}

/** Get D1 database binding from Cloudflare Workers context */
function getD1(): D1Database | null {
  try {
    const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
    if (envDouble?.DB) return envDouble.DB as D1Database;
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve email branding fields for a tenant or organization.
 * Queries org_branding table first, falling back to tenant_settings.
 */
export async function resolveEmailBranding(tenantOrOrgId: string): Promise<ResolvedEmailBranding> {
  const db = getD1();
  const emptyDefaults: ResolvedEmailBranding = {
    fromName: null,
    footerMarkdown: null,
    logoUrl: null,
    agencyName: null,
    primaryColor: null,
    accentColor: null,
    customDomain: null,
    supportEmail: null,
    legalDisclaimer: null,
    unsubscribeUrl: null,
    isWhiteLabel: false,
  };

  if (!db || !tenantOrOrgId) return emptyDefaults;

  try {
    // 1. Try org_branding table
    const orgBranding = await db
      .prepare(
        `SELECT agency_name, logo_url, primary_color
         FROM org_branding
         WHERE org_id = ?1
         LIMIT 1`
      )
      .bind(tenantOrOrgId)
      .first<{ agency_name: string | null; logo_url: string | null; primary_color: string | null }>();

    // 2. Try tenant_settings namespace 'branding'
    const settings = await getOrDefault<BrandingSettings>(
      db,
      tenantOrOrgId,
      'branding',
      DEFAULT_BRANDING
    ).catch(() => DEFAULT_BRANDING);

    const agencyName = orgBranding?.agency_name ?? settings.agencyName ?? null;
    const logoUrl = orgBranding?.logo_url ?? settings.logoUrl ?? null;
    const primaryColor = orgBranding?.primary_color ?? settings.primaryColor ?? null;
    const isWhiteLabel = Boolean(agencyName || logoUrl || settings.customDomain);

    return {
      fromName: settings.emailFromName ?? agencyName ?? null,
      footerMarkdown: settings.emailFooter ?? null,
      logoUrl,
      agencyName,
      primaryColor,
      accentColor: settings.accentColor ?? null,
      customDomain: settings.customDomain ?? null,
      supportEmail: null, // Populated via org settings if present
      legalDisclaimer: settings.emailFooter ?? null,
      unsubscribeUrl: null,
      isWhiteLabel,
    };
  } catch (err) {
    logger.warn('[tenant-branding-resolver] Failed to load branding', {
      tenantOrOrgId,
      error: String(err),
    });
    return emptyDefaults;
  }
}

/**
 * Converts ResolvedEmailBranding to WhiteLabelEmailBranding for email-styler.
 */
export function toWhiteLabelBranding(branding: ResolvedEmailBranding): WhiteLabelEmailBranding {
  return {
    agencyName: branding.agencyName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    customDomain: branding.customDomain,
    supportEmail: branding.supportEmail,
    legalDisclaimer: branding.legalDisclaimer,
    unsubscribeUrl: branding.unsubscribeUrl,
    emailFooter: branding.footerMarkdown,
    emailFromName: branding.fromName,
    poweredBySophia: !branding.isWhiteLabel,
  };
}

/**
 * Format email with white-label layout using resolved tenant branding.
 */
export function formatTenantEmail(html: string, branding: ResolvedEmailBranding): string {
  return formatWhiteLabelEmail(html, toWhiteLabelBranding(branding));
}

/**
 * Backward compatibility: appends tenant footer to HTML body.
 */
export function appendEmailFooter(html: string, footerMarkdown: string | null): string {
  if (!footerMarkdown) return html;
  const escaped = escapeHtml(footerMarkdown);
  const footerHtml = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #374151;font-size:12px;color:#6b7280;white-space:pre-wrap;">${escaped}</div>`;
  return html.includes('</body>')
    ? html.replace('</body>', `${footerHtml}</body>`)
    : html + footerHtml;
}

/**
 * Backward compatibility: builds logo img tag for email header.
 */
export function buildLogoImgTag(logoUrl: string | null): string {
  if (!logoUrl) return '';
  return `<img src="${escapeHtml(logoUrl)}" alt="logo" style="max-height:40px;max-width:160px;display:block;margin-bottom:16px;" />`;
}
```

---

### 4.6 Layer Architecture Verification Proof
We evaluate each module against the rules in `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` and `scripts/check-layer-boundaries.sh`:

| File | Layer | Imports From | Compliant? | Proof |
|---|---|---|---|---|
| `src/tree/custom-domains/hostname-resolver.ts` | `tree` | `@/seed/db/client`, `@/seed/utils/logger-utility` |  YES | Only imports from `seed`. 0 imports from `forest` or `land`. |
| `src/tree/branding/email-styler.ts` | `tree` | Pure standalone; no external imports |  YES | 0 imports from `forest` or `land`. |
| `src/tree/email/sender.ts` | `tree` | `@/seed/*`, `@/tree/email/templates/shared-layout`, `@/tree/branding/email-styler` |  YES | All imports are within `seed` and `tree`. 0 imports from `forest` or `land`. |
| `src/land/billing/email/tenant-branding-resolver.ts` | `land` | `@/seed/*`, `@/tree/branding/email-styler` |  YES | Land importing from `tree` and `seed` is canonical. 0 imports from `forest`. |
| `src/middleware.ts` | Application Root | `@/tree/custom-domains/hostname-resolver`, `@/seed/db/client` |  YES | Outside layer dirs; consumes exported `tree` and `seed` contracts. |

**Result**: Exactly **0 layer boundary violations**.

---

## 5. Verification Method

### 5.1 Independent Test Commands
Execute the following verification commands to validate type correctness, layer compliance, and unit test suites:

```bash
# 1. Verify 4-layer architecture compliance (must output "✅ All layer boundaries clean" with exit 0)
cd apps/sophia-ai-factory
bash scripts/check-layer-boundaries.sh

# 2. Verify TypeScript type checking (must output 0 errors with exit 0)
npm run type-check

# 3. Execute unit tests for Hostname Resolver
npx vitest run src/tree/custom-domains/

# 4. Execute unit tests for White-Label Email Styler and Sender
npx vitest run src/tree/branding/ src/tree/email/

# 5. Execute existing branding upload integration tests (backward compatibility)
npx vitest run src/app/api/v1/branding/__tests__/upload.test.ts
```

### 5.2 Unit Test Blueprint: `src/tree/custom-domains/__tests__/hostname-resolver.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeHostname,
  isInternalOrCanonicalHostname,
  extractHostname,
  resolveTenantFromHostname,
  injectTenantRoutingHeaders,
  clearHostnameCache,
} from '../hostname-resolver';

describe('Hostname Resolver', () => {
  beforeEach(() => {
    clearHostnameCache();
  });

  describe('normalizeHostname', () => {
    it('strips port and converts to lowercase', () => {
      expect(normalizeHostname('Agency.Domain.COM:8080')).toBe('agency.domain.com');
      expect(normalizeHostname('https://portal.creator.com/path')).toBe('portal.creator.com');
    });

    it('handles IPv6 brackets', () => {
      expect(normalizeHostname('[::1]:3000')).toBe('::1');
    });
  });

  describe('isInternalOrCanonicalHostname', () => {
    it('identifies internal canonical domains', () => {
      expect(isInternalOrCanonicalHostname('sophia.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('sub.agencyos.network')).toBe(true);
      expect(isInternalOrCanonicalHostname('localhost')).toBe(true);
      expect(isInternalOrCanonicalHostname('127.0.0.1')).toBe(true);
      expect(isInternalOrCanonicalHostname('my-branch.pages.dev')).toBe(true);
      expect(isInternalOrCanonicalHostname('worker-sub.workers.dev')).toBe(true);
    });

    it('flags customer custom domains as non-internal', () => {
      expect(isInternalOrCanonicalHostname('portal.apexagency.io')).toBe(false);
      expect(isInternalOrCanonicalHostname('ai.creatorvideo.vn')).toBe(false);
    });
  });

  describe('resolveTenantFromHostname', () => {
    it('bypasses D1 for internal domains', async () => {
      const mockDb = { prepare: () => { throw new Error('DB should not be called'); } } as any;
      const res = await resolveTenantFromHostname(mockDb, 'sophia.agencyos.network');
      expect(res.isInternal).toBe(true);
      expect(res.whitelabelActive).toBe(false);
    });

    it('resolves active custom domain from D1', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              org_id: 'org_12345',
              hostname: 'portal.apex.com',
              active: 1,
              ssl_status: 'active',
            }),
          }),
        }),
      } as any;

      const res = await resolveTenantFromHostname(mockDb, 'portal.apex.com');
      expect(res.isCustomDomain).toBe(true);
      expect(res.tenantOrgId).toBe('org_12345');
      expect(res.whitelabelActive).toBe(true);
      expect(res.sslStatus).toBe('active');
    });

    it('handles pending SSL status', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              org_id: 'org_12345',
              hostname: 'pending.apex.com',
              active: 1,
              ssl_status: 'pending_validation',
            }),
          }),
        }),
      } as any;

      const res = await resolveTenantFromHostname(mockDb, 'pending.apex.com');
      expect(res.whitelabelActive).toBe(false);
      expect(res.sslStatus).toBe('pending_validation');
    });
  });

  describe('injectTenantRoutingHeaders', () => {
    it('sets routing headers when active', () => {
      const headers = new Headers();
      injectTenantRoutingHeaders(headers, {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: 'org_999',
        customDomain: 'portal.apex.com',
        whitelabelActive: true,
        sslStatus: 'active',
      });

      expect(headers.get('x-tenant-org-id')).toBe('org_999');
      expect(headers.get('x-custom-domain')).toBe('portal.apex.com');
      expect(headers.get('x-whitelabel-active')).toBe('true');
    });
  });
});
```

### 5.3 Unit Test Blueprint: `src/tree/branding/__tests__/email-styler.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { formatWhiteLabelEmail, formatWhiteLabelPlainText } from '../email-styler';

describe('White-Label Email Styler', () => {
  it('renders agency logo and brand primary color', () => {
    const html = '<p>Your export is ready.</p><a href="https://example.com" class="brand-btn">Download Video</a>';
    const result = formatWhiteLabelEmail(html, {
      agencyName: 'Apex Studio',
      logoUrl: 'https://apex.com/logo.png',
      primaryColor: '#10b981',
      supportEmail: 'help@apex.com',
      legalDisclaimer: '© 2026 Apex Studio LLC',
      unsubscribeUrl: 'https://apex.com/unsub',
    });

    expect(result).toContain('https://apex.com/logo.png');
    expect(result).toContain('#10b981');
    expect(result).toContain('help@apex.com');
    expect(result).toContain('© 2026 Apex Studio LLC');
    expect(result).toContain('https://apex.com/unsub');
    expect(result).not.toContain('Sophia AI Factory');
  });

  it('provides clean unbranded fallback when branding is null', () => {
    const html = '<p>Welcome to your account.</p>';
    const result = formatWhiteLabelEmail(html, null);

    expect(result).toContain('Welcome to your account.');
    // Zero Sophia branding leak
    expect(result).not.toContain('Sophia AI Factory');
    expect(result).not.toContain('support@mekongmind.com');
  });

  it('escapes user strings against XSS', () => {
    const html = '<p>Hello</p>';
    const result = formatWhiteLabelEmail(html, {
      agencyName: '<script>alert("xss")</script>',
      legalDisclaimer: '<img src=x onerror=alert(1)>',
    });

    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<img src=x');
  });

  it('formats plain text fallback', () => {
    const text = 'Your export is ready.';
    const result = formatWhiteLabelPlainText(text, {
      agencyName: 'Apex Studio',
      supportEmail: 'help@apex.com',
    });

    expect(result).toContain('APEX STUDIO');
    expect(result).toContain('Support: help@apex.com');
  });
});
```

### 5.4 Invalidation Conditions
- Any occurrence of `from '@/land'` or `from '@/forest'` inside `src/tree/custom-domains/` or `src/tree/branding/` invalidates the layer architecture gate.
- Hardcoding vendor strings (`"Sophia AI Factory"`, `"support@mekongmind.com"`) in `email-styler.ts` output invalidates white-label requirements.
- Any D1 query execution triggered for canonical hostnames (`sophia.agencyos.network`, `localhost`, `*.pages.dev`, `*.workers.dev`) invalidates edge routing performance standards.
