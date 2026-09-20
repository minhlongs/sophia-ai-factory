# Milestone 1 Adversarial Security & Robustness Review Report

**Reviewer:** `teamwork_preview_reviewer_m1_2`  
**Roles:** reviewer, critic  
**Target:** Milestone 1 — Enterprise White-Label & Custom Domain Engine (MASTER Tier)  
**Parent Agent:** `78b5382f-0b81-4402-ad59-b06284d61c09` (`parent`)  
**Timestamp:** 2026-09-20T05:03:00Z  
**Verdict:** `REQUEST_CHANGES`

---

## Executive Summary

An independent, objective, and adversarial review was conducted across all Milestone 1 deliverables. The implementation demonstrates high architectural discipline (0 layer violations, clean 4-layer separation), 0 TypeScript compilation errors, robust parameter binding preventing SQL injection, and strict authorization & MASTER tier licensing gating on all Server Actions.

However, an adversarial probe identified **two critical/major security vulnerabilities**:
1. **CRITICAL (Security / Stored XSS)**: `theme-resolver.ts` lines 248–257 only strips `[";{}\\]` from `agencyName`, `logoUrl`, and `faviconUrl`. It fails to strip or escape angle brackets `<` and `>`, allowing an attacker to inject `</style><script>alert(1)</script>`. When rendered via `WhiteLabelThemeStyle` using `dangerouslySetInnerHTML` inside an SSR `<style>` element, this causes raw HTML breakout and executes arbitrary JavaScript in visitors' browsers on custom domain portals.
2. **MAJOR (Security / URI XSS)**: `email-styler.ts` line 249 inserts `unsubscribeUrl` into `<a href="${escapeHtml(unsubscribeUrl)}">`. Because `escapeHtml` only escapes HTML character entities (`&`, `<`, `>`, `"`, `'`), a `javascript:...` URI scheme passes through untouched, enabling DOM XSS / clickjacking when clicked in webmail or dashboard previews.

Additional minor edge cases were discovered in hostname RFC regex validation and platform reserved domain alignment.

Due to the **Critical Stored XSS** vulnerability in the theme resolver and SSR style injection, the verdict is **`REQUEST_CHANGES`**.

---

## 1. Observation

### 1.1 Verbatim Automated Gate Checks

1. **TypeScript Compilation Check**:
   - Command: `npm run type-check` (executed via `node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit`)
   - Exit code: `0`
   - Output:
     ```
     > sophia-ai-factory@0.1.5 type-check
     > node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --noEmit
     ```
   - Status: **PASS (0 compilation errors)**.

2. **Layer Boundary Verification**:
   - Command: `bash scripts/check-layer-boundaries.sh`
   - Exit code: `0`
   - Output:
     ```
     🔍 Checking layer boundaries...
     ✅ All layer boundaries clean
     ```
   - Status: **PASS (0 architectural violations)**.

### 1.2 Inspection of Source Artifacts

1. **`apps/sophia-ai-factory/src/tree/branding/theme-resolver.ts` (lines 248–272)**:
   ```typescript
   if (branding?.agencyName) {
     // Sanitize string to prevent CSS escape breakout
     vars['--brand-agency-name'] = `"${branding.agencyName.replace(/[";{}\\]/g, '')}"`;
   }
   if (branding?.logoUrl) {
     vars['--brand-logo-url'] = `url("${branding.logoUrl.replace(/[";{}\\]/g, '')}")`;
   }
   if (branding?.faviconUrl) {
     vars['--brand-favicon-url'] = `url("${branding.faviconUrl.replace(/[";{}\\]/g, '')}")`;
   }

   return vars;
   ```
   *Direct observation*: The regex `replace(/[";{}\\]/g, '')` leaves `<`, `>`, `/`, `'`, and newline characters untouched.

2. **`apps/sophia-ai-factory/src/forest/theme/white-label-theme-style.tsx` (lines 22–27)**:
   ```tsx
   export function WhiteLabelThemeStyle({ themeCss, nonce }: WhiteLabelThemeStyleProps) {
     if (!themeCss) return null;

     return (
       <style
         id="whitelabel-brand-theme"
         nonce={nonce}
         dangerouslySetInnerHTML={{ __html: themeCss }}
       />
     );
   }
   ```
   *Direct observation*: `themeCss` is passed directly to `dangerouslySetInnerHTML` without escaping or stripping closing `</style>` tags.

3. **`apps/sophia-ai-factory/src/tree/branding/email-styler.ts` (lines 60–68 & 246–252)**:
   ```typescript
   export function escapeHtml(str: string | null | undefined): string {
     if (!str) return '';
     return str
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
   }
   ...
   if (unsubscribeUrl) {
     rows.push(
       `<p style="font-size:11px;color:#71717a;margin:12px 0 0 0;text-align:center;">
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">${unsubscribeLabel}</a>
       </p>`
     );
   }
   ```
   *Direct observation*: `escapeHtml` only escapes HTML entity characters. A string such as `javascript:alert(document.cookie)` contains no entity characters and is returned unmodified, then rendered directly into the `href` attribute.

4. **`apps/sophia-ai-factory/src/land/admin/custom-domain-actions.ts` (lines 38–44 & 77–126)**:
   ```typescript
   const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;
   const FORBIDDEN_DOMAINS = new Set([
     'sophia.agencyos.network',
     'agencyos.network',
     'localhost',
     'workers.dev',
   ]);
   ...
   export async function assertMasterTierAndOrgAccess(db: D1Database, orgId: string) {
     const user = await getCurrentUser();
     if (!user) return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
     const { isAdmin } = await isUserAdminWithRole(user);
     if (isAdmin || user.role === 'admin') return success({ userId: user.id, isAdmin: true });

     const member = await db
       .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
       .bind(orgId, user.id)
       .first<{ role: string }>();

     if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
       return failure({ code: 'FORBIDDEN', message: 'Only organization owners or admins can manage custom domains' });
     }

     const tier = await getUserTier(user.id);
     const orgSub = await db
       .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
       .bind(orgId)
       .first<{ tier: string | null; plan: string | null }>();

     const isMaster = tier === 'MASTER' || orgSub?.tier === 'MASTER' || orgSub?.plan?.toLowerCase() === 'master';
     if (!isMaster) {
       return failure({ code: 'FORBIDDEN', message: 'Custom domains require a MASTER tier subscription ($4,999 lifetime license)' });
     }
     return success({ userId: user.id, isAdmin: false });
   }
   ```
   *Direct observation*:
   - Parameter binding (`?1`, `?2`) is strictly used on both queries.
   - Authentication, organization role check (`owner` or `admin`), and tier gating (`tier === 'MASTER'` or subscription plan `'master'`) are enforced before any domain operation is allowed.
   - `FORBIDDEN_DOMAINS` does not include `'pages.dev'`, although `hostname-resolver.ts:110` treats `*.pages.dev` as internal infrastructure.
   - `HOSTNAME_REGEX` only guards the first label against leading/trailing hyphens; intermediate labels (`portal.-test-.com`) and TLDs (`.com-`) pass through.

5. **`apps/sophia-ai-factory/migrations/0276_enterprise_scale_foundations.sql`**:
   - Uses `CREATE TABLE IF NOT EXISTS custom_domains` with `ON DELETE CASCADE` foreign key referencing `organizations(id)`.
   - Explicit `CHECK` constraints on `ssl_status` (`pending_validation`, `pending_deployment`, `active`, `error`, `revoked`), `verification_status` (`pending`, `verified`, `active`, `failed`, `revoked`), `cname_verified` (`0, 1`), and `active` (`0, 1`).
   - Indexes created on `hostname`, `org_id`, `ssl_status`, `active`, and `cf_custom_hostname_id`.

6. **`apps/sophia-ai-factory/src/tree/branding/org-branding-repo.ts` & `verification-service.ts`**:
   - `getOrgBranding`: `WHERE org_id = ?1` (`.bind(orgId)`).
   - `upsertOrgBranding`: `VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)` (`.bind(...)`).
   - `getTenantBrandingByHostname`: `WHERE cd.hostname = ?1` (`.bind(hostname)`).
   - `registerCustomDomain`: `VALUES (?1, ?2, ... ?14)` (`.bind(...)`).
   - `verifyCustomDomainStatus`: `UPDATE custom_domains SET ... WHERE id = ?9` (`.bind(...)`).
   - `deleteCustomDomainAction`: `DELETE FROM custom_domains WHERE id = ?1 AND org_id = ?2` (`.bind(domainId, orgId)`).
   *Direct observation*: Parameter binding is 100% consistent across all D1 queries. Zero raw string concatenations in SQL clauses.

7. **Test Discrepancy Note**:
   - `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/custom-domains-whitelabel.e2e.test.ts` imports from `./enterprise-test-harness`, which is an in-memory mock harness created by the E2E track orchestrator. It does not import the actual files in `src/tree/` or `src/land/`.
   - The actual implementation files are verified by unit and integration tests in `src/__tests__/unit/enterprise/` and `src/__tests__/integration/enterprise/`.

---

## 2. Logic Chain

1. **CSS Breakout & Stored XSS Chain**:
   - *Observation 1.2.1*: In `theme-resolver.ts:250`, `agencyName.replace(/[";{}\\]/g, '')` allows `<` and `>`.
   - *Observation 1.2.2*: In `white-label-theme-style.tsx:25`, `dangerouslySetInnerHTML={{ __html: themeCss }}` injects the CSS text directly into a `<style>` element.
   - *Logic*: An input of `branding.agencyName = '</style><script>alert("XSS")</script>'` results in CSS:
     ```css
     :root, .dark {
       --brand-agency-name: "</style><script>alert(XSS)</script>";
     }
     ```
     Under HTML5 parsing rules, browsers parse `<style>` in RAWTEXT mode. The sequence `</style>` immediately terminates the style block, causing the subsequent `<script>alert(XSS)</script>` to execute as executable JavaScript in the context of the portal origin.
   - *Conclusion*: Stored XSS vulnerability exists on vanity tenant domains.

2. **URI-Scheme XSS in Email Styler Chain**:
   - *Observation 1.2.3*: In `email-styler.ts:60–68`, `escapeHtml` only escapes `&`, `<`, `>`, `"`, `'`.
   - *Observation 1.2.3*: In `email-styler.ts:249`, `<a href="${escapeHtml(unsubscribeUrl)}">` renders the unvalidated URL.
   - *Logic*: When a tenant sets `unsubscribeUrl` to `javascript:alert(document.cookie)`, `escapeHtml` produces no changes because no HTML entity characters are present. The resulting email HTML contains `<a href="javascript:alert(document.cookie)">`.
   - *Conclusion*: Clicking "Unsubscribe" in any web-based email client or in-app preview triggers JavaScript execution.

3. **SQL Injection Defense Chain**:
   - *Observation 1.2.5 & 1.2.6*: Every SQL query in migration 0276, `org-branding-repo.ts`, `verification-service.ts`, `hostname-resolver.ts`, `tenant-branding-resolver.ts`, and `custom-domain-actions.ts` utilizes positional placeholders (`?1`, `?2`, etc.) and `.bind(...)`.
   - *Logic*: Dynamic values are sent out-of-band to the SQLite engine as bound parameters.
   - *Conclusion*: SQL injection is completely prevented.

4. **Licensing & Authorization Gating Chain**:
   - *Observation 1.2.4*: `assertMasterTierAndOrgAccess` requires `getCurrentUser()`, verifies `role === 'owner' || role === 'admin'` in `org_members`, and verifies `tier === 'MASTER'` (or subscription plan `'master'`).
   - *Observation 1.2.4*: All 4 Server Actions (`registerCustomDomainAction`, `verifyCustomDomainStatusAction`, `deleteCustomDomainAction`, `listCustomDomainsAction`) invoke this assertion before performing any logic. `deleteCustomDomainAction` and `verifyCustomDomainStatusAction` also scope queries to `org_id`.
   - *Conclusion*: MASTER tier licensing gating ($4,999 lifetime license) and organization multi-tenant isolation are strictly enforced.

5. **Layer Architecture & Type Safety Chain**:
   - *Observation 1.1.1 & 1.1.2*: `npm run type-check` compiles with 0 errors. `bash scripts/check-layer-boundaries.sh` reports all boundaries clean.
   - *Logic*: Code adheres strictly to `seed` -> `tree` -> `forest` -> `land` import direction.
   - *Conclusion*: Architectural integrity and TypeScript compiler constraints are fully satisfied.

---

## 3. Review Findings

### Finding 1 [Critical] — CSS Injection / Stored XSS via Theme Resolver SSR `<style>` Tag
- **Where**: `apps/sophia-ai-factory/src/tree/branding/theme-resolver.ts:248–257` and `apps/sophia-ai-factory/src/forest/theme/white-label-theme-style.tsx:22–27`
- **Why**: `agencyName`, `logoUrl`, and `faviconUrl` only strip `[";{}\\]`. They do not strip `<` or `>`, nor do they check for `</style`. When injected into `<style dangerouslySetInnerHTML={{ __html: themeCss }}>`, an attacker can break out of the style tag with `</style><script>...</script>` and achieve stored XSS on the tenant's portal domain.
- **Suggestion**:
  1. In `theme-resolver.ts`:
     ```typescript
     if (branding?.agencyName) {
       vars['--brand-agency-name'] = `"${branding.agencyName.replace(/[<>";{}\\]/g, '').replace(/<\/style/gi, '')}"`;
     }
     if (branding?.logoUrl) {
       const cleanUrl = branding.logoUrl.replace(/[<>";{}\\]/g, '').replace(/<\/style/gi, '');
       if (/^https?:\/\//i.test(cleanUrl) || cleanUrl.startsWith('/')) {
         vars['--brand-logo-url'] = `url("${cleanUrl}")`;
       }
     }
     if (branding?.faviconUrl) {
       const cleanUrl = branding.faviconUrl.replace(/[<>";{}\\]/g, '').replace(/<\/style/gi, '');
       if (/^https?:\/\//i.test(cleanUrl) || cleanUrl.startsWith('/')) {
         vars['--brand-favicon-url'] = `url("${cleanUrl}")`;
       }
     }
     ```
  2. In `white-label-theme-style.tsx`, defensively sanitize before injection:
     ```tsx
     const sanitizedCss = themeCss.replace(/<\/style/gi, '');
     ```

### Finding 2 [Major] — XSS via `javascript:` Pseudo-Protocol in `email-styler.ts`
- **Where**: `apps/sophia-ai-factory/src/tree/branding/email-styler.ts:246–252`
- **Why**: `escapeHtml(unsubscribeUrl)` does not validate URL schemes. An input of `javascript:alert(1)` is rendered as `<a href="javascript:alert(1)">`, resulting in client-side script execution when clicked.
- **Suggestion**:
  Validate that `unsubscribeUrl` strictly starts with `http://` or `https://`:
  ```typescript
  if (unsubscribeUrl && /^https?:\/\//i.test(unsubscribeUrl.trim())) {
    rows.push(
      `<p style="font-size:11px;color:#71717a;margin:12px 0 0 0;text-align:center;">
        <a href="${escapeHtml(unsubscribeUrl.trim())}" style="color:#71717a;text-decoration:underline;">${unsubscribeLabel}</a>
      </p>`
    );
  }
  ```

### Finding 3 [Minor] — Permissive Intermediate Label Hyphenation in `validateHostname`
- **Where**: `apps/sophia-ai-factory/src/land/admin/custom-domain-actions.ts:38`
- **Why**: `const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;` only checks hyphens on the initial label. Intermediate labels with leading or trailing hyphens (e.g. `portal.-example-.com`) or TLDs with trailing hyphens (`portal.example.com-`) pass validation and are forwarded to Cloudflare, causing preventable API errors.
- **Suggestion**:
  Update `HOSTNAME_REGEX` to enforce RFC 1123 label boundaries across all labels:
  ```typescript
  const HOSTNAME_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  ```

### Finding 4 [Minor] — Discrepancy Between `FORBIDDEN_DOMAINS` and Edge Hostname Routing (`pages.dev`)
- **Where**: `apps/sophia-ai-factory/src/land/admin/custom-domain-actions.ts:39–44` vs `apps/sophia-ai-factory/src/tree/custom-domains/hostname-resolver.ts:110`
- **Why**: `hostname-resolver.ts` unconditionally treats `*.pages.dev` as internal canonical infrastructure (`isInternal: true`), bypassing D1 lookup. However, `FORBIDDEN_DOMAINS` in `custom-domain-actions.ts` permits registration of `myagency.pages.dev`. A customer registering this domain would succeed in registering, but traffic would never reach their white-label portal.
- **Suggestion**:
  Add `'pages.dev'` to `FORBIDDEN_DOMAINS` in `custom-domain-actions.ts`.

### Finding 5 [Minor] — Cloudflare Host Status `blocked` Handled as `pending_validation`
- **Where**: `apps/sophia-ai-factory/src/tree/custom-domains/verification-service.ts:115–132`
- **Why**: In `evaluateStatusTransitions`, when `cfResult.status === 'blocked'` but `rawSslStatus === 'pending_validation'`, the function falls through to `else`, marking the domain as `pending_validation` / `pending` rather than `error` / `failed`.
- **Suggestion**:
  Explicitly check `if (cfHostStatus === 'blocked' || rawSslStatus === 'error' ...)` to transition to `error` status.

---

## 4. Verified Claims

| Item | Claim | Verified Via | Result |
|---|---|---|---|
| TypeScript Compilation | 0 type errors | `npm run type-check` (`tsc --noEmit`) | **PASS** |
| Layer Architecture | 0 boundary violations | `bash scripts/check-layer-boundaries.sh` | **PASS** |
| SQL Parameter Binding | All queries parameterized | Full static code inspection across 6 files | **PASS** |
| MASTER Tier Gating | Gated to MASTER ($4,999) | Inspection of `assertMasterTierAndOrgAccess` & 4 actions | **PASS** |
| CSS Injection Sanitization | Sanitized against breakout | Code inspection of `theme-resolver.ts` & `white-label-theme-style.tsx` | **FAIL (CRITICAL)** |
| Email XSS Prevention | Entity escaped & secure | Code inspection of `email-styler.ts` (`unsubscribeUrl`) | **FAIL (MAJOR)** |

---

## 5. Caveats

1. **Production Cloudflare Credentials**:
   In local development and automated CI tests, the Cloudflare SaaS client operates in mock mode. Live issuance and DCV validation depend on Cloudflare Workers environment secrets (`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`) being present in production.
2. **Review-Only Constraint**:
   In accordance with the review protocol, the reviewer identified and documented vulnerabilities and recommended mitigations, but did NOT edit production code files.

---

## 6. Conclusion & Verdict

**Final Verdict:** **`REQUEST_CHANGES`**

While the core architecture, D1 migrations, SQL parameter binding, and MASTER tier gating are exceptionally well implemented, the project cannot be approved for production deployment in its current state due to the **Critical Stored XSS** vulnerability in the theme resolver / SSR style injection and the **Major URI XSS** vulnerability in the email styler.

Once Findings 1 and 2 are addressed, Milestone 1 will fully meet enterprise-grade security and robustness standards.

---

## 7. Verification Method

To verify the findings:
1. **Verify CSS `<style>` Breakout**:
   Call `resolveThemeCssVariables({ agencyName: '</style><script>alert(1)</script>' })`.
   Inspect `vars['--brand-agency-name']`. Observe that `</style><script>` is present.
   Pass result to `buildThemeCssString()`. Observe that `</style>` is present inside the CSS string.
2. **Verify `unsubscribeUrl` URI XSS**:
   Call `formatWhiteLabelEmail('<p>test</p>', { unsubscribeUrl: 'javascript:alert(1)' })`.
   Observe output contains `<a href="javascript:alert(1)">`.
3. **Run TypeScript Check**:
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npm run type-check
   ```
4. **Run Layer Boundary Check**:
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   bash scripts/check-layer-boundaries.sh
   ```
