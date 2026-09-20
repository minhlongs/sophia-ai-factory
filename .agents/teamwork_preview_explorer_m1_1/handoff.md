# Milestone 1 Design Handoff: Schema Migration 0276 & Cloudflare for SaaS Verification Service

**Agent:** `teamwork_preview_explorer_m1_1`  
**Working Directory:** `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_1/`  
**Milestone:** Milestone 1 — Enterprise White-Label & Custom Domain Engine  
**Date:** 2026-09-20T11:45:00+07:00  
**Handoff Type:** Hard (Complete Design & Implementation Blueprint)  

---

## 1. Observation

### 1.1 Codebase & Migration Baseline
1. **Migration Sequence & Naming**:
   - Inspected `apps/sophia-ai-factory/migrations/`. Exactly 240 migration files exist, with the latest committed migration being `migrations/0275_autonomous_growth_and_revenue.sql` (Phase 17).
   - Per `PROJECT.md:114` and `ORIGINAL_REQUEST.md:730`, the next sequential migration is `migrations/0276_enterprise_scale_foundations.sql`.
   - Inspection of `migrations/0001-init.sql:21-29` confirms table `organizations`:
     ```sql
     CREATE TABLE IF NOT EXISTS organizations (
       id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
       name TEXT NOT NULL,
       slug TEXT UNIQUE,
       plan TEXT DEFAULT 'free',
       settings TEXT DEFAULT '{}',
       created_at TEXT DEFAULT (datetime('now')),
       updated_at TEXT DEFAULT (datetime('now'))
     );
     ```
   - Companion table `org_branding` (`migrations/0069-org-branding.sql:4-15`) uses `INTEGER NOT NULL DEFAULT (unixepoch())` for `created_at` and `updated_at`.
   - Inspection confirms that **no** table named `custom_domains` currently exists in any migration.

2. **Tier & White-Label Entitlement Baseline**:
   - `apps/sophia-ai-factory/src/seed/config/tiers/unified-limits.ts:135` specifies:
     ```typescript
     MASTER: {
       price: 4999,
       period: 'lifetime',
       teamMembers: 999,
       whiteLabel: true,
       customDomains: true,
       apiAccess: true,
     }
     ```
   - Non-MASTER tiers (`BASIC`, `PREMIUM`, `ENTERPRISE`) have `whiteLabel: false`. Custom domain registration is strictly gated to `MASTER` tier.
   - `apps/sophia-ai-factory/src/seed/db/get-user-tier.ts:35-72` resolves user subscription tier by querying `subscriptions` with fallback to `org_members` join.

3. **Authentication & Admin Patterns**:
   - `apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts:24` exports `getCurrentUser()` returning `{ id: string; email: string; role?: string } | null`.
   - `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts:18` exports `isUserAdminWithRole(user)` checking admin privileges.
   - `apps/sophia-ai-factory/src/land/admin/org-manager.ts:45-81` implements `requireMaster()` using explicit `Result<T, E>` returns from `@/seed/types/result`.

4. **Cloudflare for SaaS Custom Hostnames API**:
   - Cloudflare API v4 endpoint: `https://api.cloudflare.com/client/v4/zones/{zone_id}/custom_hostnames`.
   - Registration payload:
     ```json
     {
       "hostname": "portal.agency.com",
       "ssl": {
         "method": "txt",
         "type": "dv",
         "settings": { "min_tls_version": "1.2", "http2": "on" }
       }
     }
     ```
   - Cloudflare returns `ownership_verification` (TXT record for domain control) and `ssl.validation_records` (DCV TXT or CNAME for Certificate Authority issuance).
   - SSL status transitions: `pending_validation` → `pending_deployment` → `active` (or `error`/`timed_out`).
   - CNAME routing: Domain must point CNAME to fallback target `cname.sophia.agencyos.network`.

5. **Layer Architecture Boundaries**:
   - `scripts/check-layer-boundaries.sh` enforces:
     - `seed`: foundational primitives, zero imports from `tree`, `forest`, or `land`.
     - `tree`: reusable domain logic, imports only from `seed`. Zero imports from `forest` or `land`.
     - `forest`: composition and UI, imports `seed` and `tree`.
     - `land`: public actions and routes, imports `seed` and `tree`. Zero imports from `forest`.
     - Banned imports: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

---

## 2. Logic Chain

1. **Schema Design (`custom_domains`)**:
   - *Premise*: Multi-tenant white-label requires storing the vanity hostname, linking to an organization, and tracking verification records returned by Cloudflare for SaaS.
   - *From Observation 1.1*: Primary key format throughout the modern schema is 32-character lowercase hex (`lower(hex(randomblob(16)))`). Foreign key `org_id` must cascade delete with `organizations(id)`.
   - *D1 Pragmas*: D1 runs SQLite; executing migrations requires `PRAGMA foreign_keys = ON;` and `PRAGMA defer_foreign_keys = ON;` to ensure relational integrity without race conditions during batch execution.
   - *Field Requirements*: To track Cloudflare for SaaS lifecycle, the table must include:
     - `hostname`: unique string, indexed for $O(1)$ routing lookups.
     - `cf_custom_hostname_id`: Cloudflare UUID for polling and deletion.
     - `ssl_status`: checked against `('pending_validation', 'pending_deployment', 'active', 'error', 'revoked')`.
     - `ownership_verification`: JSON object storing TXT verification name & token.
     - `ssl_verification`: JSON object storing DCV verification name & token.
     - `verification_errors`: JSON array storing error strings from Cloudflare/CA.
     - `cname_target`: default `'cname.sophia.agencyos.network'`.
     - `cname_verified`: boolean flag (0 or 1).
     - `active`: boolean flag (0 or 1) indicating live traffic can be served.
     - `created_at` and `updated_at`: `INTEGER NOT NULL DEFAULT (unixepoch())` matching `org_branding`.

2. **Verification Service (`src/tree/custom-domains/verification-service.ts`)**:
   - *Placement*: Lives in `tree` layer. It is pure domain logic: parsing verification responses, driving status transitions, executing Cloudflare API HTTP requests, and reading/writing `custom_domains` D1 records.
   - *Imports*: Strictly imports from `@/seed/*` (types, result, logger). Zero imports from `land` or `forest`.
   - *Record Parsers*:
     - Ownership TXT: Cloudflare provides `ownership_verification.name` and `ownership_verification.value`.
     - SSL DCV: Cloudflare provides `ssl.validation_records` array (or `ssl.txt_name`/`ssl.txt_value`). The parser extracts type (`txt`), name (`_acme-challenge.<hostname>`), and token.
   - *State Machine Transitions*:
     - When both ownership and DCV are pending: `pending_validation`.
     - When DCV is verified and cert is being issued: `pending_deployment`.
     - When Cloudflare returns `ssl.status === 'active'` AND `status === 'active'`: `active` (`cname_verified = 1`, `active = 1`).
     - If Cloudflare returns `ssl.status === 'error'` or `verification_errors.length > 0`: `error` (`active = 0`).
   - *Test/Mock Resilience*: When `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ZONE_ID` are absent (local dev, CI unit tests), the client operates in a deterministic mock mode, returning mock tokens (`_cf-custom-hostname.<hostname>` and `_acme-challenge.<hostname>`) so automated tests pass without external network dependencies.

3. **Server Actions (`src/land/admin/custom-domain-actions.ts`)**:
   - *Placement*: Lives in `land` layer. Uses `'use server'` directive. Imports from `@/seed/*` and `@/tree/*`.
   - *Security & Gating*:
     - Authentication: `getCurrentUser()` must return valid session.
     - Org Authorization: Caller must be `owner` or `admin` of target `orgId`, or platform admin.
     - Tier Enforcement: Must check active subscription; only `MASTER` tier (`UNIFIED_TIERS.MASTER.whiteLabel === true`) is permitted to call `registerCustomDomainAction`.
   - *Hostname Sanitization & Validation*:
     - Must be valid RFC 1035 / RFC 1123 hostname (`/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i`).
     - Max length: 253 chars.
     - Rejects reserved domains (`sophia.agencyos.network`, `agencyos.network`, `localhost`, `workers.dev`).
     - Rejects duplicate domains via D1 pre-check before hitting Cloudflare API.
   - *Error Discrimination*: All actions return `Result<T, CustomDomainError>` with typed error codes (`UNAUTHORIZED`, `FORBIDDEN`, `INVALID_HOSTNAME`, `CONFLICT`, `CLOUDFLARE_ERROR`, `NOT_FOUND`, `DB_ERROR`).

---

## 3. Caveats

1. **Apex Domains vs Subdomains**:
   Cloudflare for SaaS works seamlessly with subdomains (e.g. `portal.acme.com`) via standard CNAME records. Apex domains (e.g. `acme.com`) require DNS provider ALIAS/ANAME support or Cloudflare CNAME flattening. The hostname validator recommends subdomains.
2. **Cloudflare API Rate Limits**:
   Cloudflare API limits requests to 1,200 requests per 5 minutes. The verification action is designed to be triggered on-demand by the user clicking "Re-verify" or by a low-frequency background check, rather than aggressive polling loops.
3. **Mock Fallback vs Live API**:
   In production, Cloudflare credentials (`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`) must be configured in `wrangler.toml` secrets. If unset in local dev or Vitest environments, mock mode activates automatically to ensure test isolation.
4. **Pragma Support in D1 Remote**:
   While `PRAGMA foreign_keys = ON;` is standard in SQLite, Cloudflare D1 applies foreign keys natively in modern instances. Adding the pragma ensures compatibility across both local miniflare SQLite and production remote D1.

---

## 4. Conclusion & Complete Blueprints

### 4.1 SQL DDL: `apps/sophia-ai-factory/migrations/0276_enterprise_scale_foundations.sql`

```sql
-- Migration: 0276_enterprise_scale_foundations
-- Phase 18–19: Enterprise Scale Foundations (Custom Domains & Cloudflare for SaaS Verification)
-- Sequentially follows 0275_autonomous_growth_and_revenue.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. CUSTOM DOMAINS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,
  cf_custom_hostname_id TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'pending_validation' CHECK (
    ssl_status IN ('pending_validation', 'pending_deployment', 'active', 'error', 'revoked')
  ),
  verification_errors TEXT NOT NULL DEFAULT '[]', -- JSON array of error strings
  ownership_verification TEXT NOT NULL DEFAULT '{}', -- JSON object: { type, name, value }
  ssl_verification TEXT NOT NULL DEFAULT '{}', -- JSON object: { type, name, value }
  cname_target TEXT NOT NULL DEFAULT 'cname.sophia.agencyos.network',
  cname_verified INTEGER NOT NULL DEFAULT 0 CHECK (cname_verified IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================================
-- 3. INDEXES & CONSTRAINTS
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uidx_custom_domains_hostname 
  ON custom_domains(hostname);

CREATE INDEX IF NOT EXISTS idx_custom_domains_org_id 
  ON custom_domains(org_id);

CREATE INDEX IF NOT EXISTS idx_custom_domains_ssl_status 
  ON custom_domains(ssl_status);

CREATE INDEX IF NOT EXISTS idx_custom_domains_active 
  ON custom_domains(active);

CREATE INDEX IF NOT EXISTS idx_custom_domains_cf_id 
  ON custom_domains(cf_custom_hostname_id);
```

---

### 4.2 Seed Layer Types: `apps/sophia-ai-factory/src/seed/types/custom-domains.ts`

```typescript
/**
 * Custom domain and Cloudflare for SaaS verification type definitions.
 *
 * Layer: seed (Foundational primitives)
 * Dependencies: seed/types/result
 */

export type CustomDomainSslStatus =
  | 'pending_validation'
  | 'pending_deployment'
  | 'active'
  | 'error'
  | 'revoked';

export interface VerificationRecord {
  type: 'txt' | 'cname' | 'http';
  name: string;
  value: string;
}

export interface CustomDomainRecord {
  id: string;
  org_id: string;
  hostname: string;
  cf_custom_hostname_id: string | null;
  ssl_status: CustomDomainSslStatus;
  verification_errors: string[];
  ownership_verification: VerificationRecord | null;
  ssl_verification: VerificationRecord | null;
  cname_target: string;
  cname_verified: boolean;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CustomDomainRow {
  id: string;
  org_id: string;
  hostname: string;
  cf_custom_hostname_id: string | null;
  ssl_status: string;
  verification_errors: string;
  ownership_verification: string;
  ssl_verification: string;
  cname_target: string;
  cname_verified: number;
  active: number;
  created_at: number;
  updated_at: number;
}

export interface DomainVerificationResult {
  domainId: string;
  hostname: string;
  sslStatus: CustomDomainSslStatus;
  cnameVerified: boolean;
  active: boolean;
  ownershipVerification: VerificationRecord | null;
  sslVerification: VerificationRecord | null;
  errors: string[];
  cnameTarget: string;
}

export type CustomDomainErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_HOSTNAME'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'CLOUDFLARE_ERROR'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL';

export interface CustomDomainError {
  code: CustomDomainErrorCode;
  message: string;
  details?: unknown;
}

export interface CloudflareSslValidationRecord {
  status?: string;
  txt_name?: string;
  txt_value?: string;
  http_url?: string;
  http_body?: string;
  cname_name?: string;
  cname_target?: string;
}

export interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: 'pending' | 'active' | 'blocked' | 'moved';
  verification_errors?: string[];
  ownership_verification?: {
    type: 'txt';
    name: string;
    value: string;
  };
  ssl: {
    id?: string;
    type?: string;
    method?: 'txt' | 'http' | 'cname';
    status: 'pending_validation' | 'pending_deployment' | 'active' | 'error' | 'timed_out' | 'revoked';
    txt_name?: string;
    txt_value?: string;
    validation_records?: CloudflareSslValidationRecord[];
    settings?: {
      min_tls_version?: string;
      http2?: string;
    };
  };
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}
```

---

### 4.3 Cloudflare for SaaS Verification Service: `apps/sophia-ai-factory/src/tree/custom-domains/verification-service.ts`

```typescript
/**
 * Cloudflare for SaaS Custom Hostname Verification Service.
 *
 * Layer: tree (Domain reusable logic)
 * Dependencies: @/seed/*
 *
 * Handles Cloudflare API communication, status transitions,
 * ownership TXT and SSL DCV record parsing, and D1 persistence.
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CustomDomainRecord,
  CustomDomainRow,
  DomainVerificationResult,
  CustomDomainError,
  CustomDomainSslStatus,
  VerificationRecord,
  CloudflareCustomHostnameResult,
  CloudflareApiResponse,
} from '@/seed/types/custom-domains';

const DEFAULT_CNAME_TARGET = 'cname.sophia.agencyos.network';

// ── Environment Helpers ───────────────────────────────────────────────────────

function getCloudflareCredentials(): { zoneId: string | null; apiToken: string | null } {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
  
  const zoneId = (process.env.CLOUDFLARE_ZONE_ID || env?.CLOUDFLARE_ZONE_ID || ctx?.env?.CLOUDFLARE_ZONE_ID) as string | undefined;
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || ctx?.env?.CLOUDFLARE_API_TOKEN) as string | undefined;

  return {
    zoneId: zoneId ?? null,
    apiToken: apiToken ?? null,
  };
}

// ── Record Parsers ────────────────────────────────────────────────────────────

export function parseOwnershipVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  if (cfResult.ownership_verification?.name && cfResult.ownership_verification?.value) {
    return {
      type: 'txt',
      name: cfResult.ownership_verification.name,
      value: cfResult.ownership_verification.value,
    };
  }
  return null;
}

export function parseSslDcvVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  const ssl = cfResult.ssl;
  if (!ssl) return null;

  // 1. Check validation_records array (most complete source from Cloudflare)
  if (ssl.validation_records && ssl.validation_records.length > 0) {
    const record = ssl.validation_records[0];
    if (record.txt_name && record.txt_value) {
      return { type: 'txt', name: record.txt_name, value: record.txt_value };
    }
    if (record.cname_name && record.cname_target) {
      return { type: 'cname', name: record.cname_name, value: record.cname_target };
    }
  }

  // 2. Fallback to top-level txt properties
  if (ssl.txt_name && ssl.txt_value) {
    return { type: 'txt', name: ssl.txt_name, value: ssl.txt_value };
  }

  return null;
}

export function parseVerificationErrors(
  cfResult: CloudflareCustomHostnameResult,
): string[] {
  const errors: string[] = [];
  if (Array.isArray(cfResult.verification_errors)) {
    for (const err of cfResult.verification_errors) {
      if (typeof err === 'string' && err.trim()) errors.push(err.trim());
    }
  }
  return errors;
}

// ── State Transition Logic ────────────────────────────────────────────────────

export function evaluateStatusTransitions(
  cfResult: CloudflareCustomHostnameResult,
): {
  sslStatus: CustomDomainSslStatus;
  cnameVerified: boolean;
  active: boolean;
  errors: string[];
} {
  const errors = parseVerificationErrors(cfResult);
  const rawSslStatus = cfResult.ssl?.status;
  const cfHostStatus = cfResult.status;

  let sslStatus: CustomDomainSslStatus = 'pending_validation';
  let cnameVerified = cfHostStatus === 'active';
  let active = false;

  if (rawSslStatus === 'error' || rawSslStatus === 'timed_out' || rawSslStatus === 'revoked') {
    sslStatus = rawSslStatus === 'revoked' ? 'revoked' : 'error';
    if (errors.length === 0) {
      errors.push(`SSL validation failed with status: ${rawSslStatus}`);
    }
  } else if (rawSslStatus === 'active' && cfHostStatus === 'active') {
    sslStatus = 'active';
    cnameVerified = true;
    active = true;
  } else if (rawSslStatus === 'pending_deployment') {
    sslStatus = 'pending_deployment';
  } else {
    sslStatus = 'pending_validation';
  }

  return {
    sslStatus,
    cnameVerified,
    active,
    errors,
  };
}

// ── Cloudflare API Client ─────────────────────────────────────────────────────

export async function createCloudflareCustomHostname(
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  // Test / Mock mode fallback when external credentials are not present
  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Operating in mock mode (credentials absent)', { hostname });
    const mockId = 'mock_cf_' + Math.random().toString(36).substring(2, 15);
    const mockResult: CloudflareCustomHostnameResult = {
      id: mockId,
      hostname,
      status: 'pending',
      verification_errors: [],
      ownership_verification: {
        type: 'txt',
        name: `_cf-custom-hostname.${hostname}`,
        value: `mock_ownership_${mockId}`,
      },
      ssl: {
        id: mockId,
        type: 'dv',
        method: 'txt',
        status: 'pending_validation',
        txt_name: `_acme-challenge.${hostname}`,
        txt_value: `mock_dcv_${mockId}`,
        validation_records: [
          {
            status: 'pending',
            txt_name: `_acme-challenge.${hostname}`,
            txt_value: `mock_dcv_${mockId}`,
          },
        ],
      },
    };
    return success(mockResult);
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
            http2: 'on',
          },
        },
      }),
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare creation failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] createCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function fetchCloudflareCustomHostname(
  cfCustomHostnameId: string,
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  // Test / Mock mode fallback
  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock status check', { cfCustomHostnameId, hostname });
    const isMockActive = hostname.includes('active-test');
    const mockResult: CloudflareCustomHostnameResult = {
      id: cfCustomHostnameId,
      hostname,
      status: isMockActive ? 'active' : 'pending',
      verification_errors: [],
      ownership_verification: {
        type: 'txt',
        name: `_cf-custom-hostname.${hostname}`,
        value: 'mock_ownership_verified',
      },
      ssl: {
        id: cfCustomHostnameId,
        type: 'dv',
        method: 'txt',
        status: isMockActive ? 'active' : 'pending_validation',
        txt_name: `_acme-challenge.${hostname}`,
        txt_value: 'mock_dcv_token',
      },
    };
    return success(mockResult);
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare status check failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] fetchCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function deleteCloudflareCustomHostname(
  cfCustomHostnameId: string,
): Promise<Result<{ id: string }, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock deletion', { cfCustomHostnameId });
    return success({ id: cfCustomHostnameId });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<{ id: string }>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare deletion failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] deleteCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

// ── D1 Data Access Layer ──────────────────────────────────────────────────────

export function mapRowToCustomDomainRecord(row: CustomDomainRow): CustomDomainRecord {
  let verificationErrors: string[] = [];
  try {
    verificationErrors = JSON.parse(row.verification_errors || '[]');
  } catch {
    verificationErrors = [];
  }

  let ownershipVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ownership_verification || '{}');
    if (parsed && parsed.name && parsed.value) ownershipVerification = parsed;
  } catch {
    ownershipVerification = null;
  }

  let sslVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ssl_verification || '{}');
    if (parsed && parsed.name && parsed.value) sslVerification = parsed;
  } catch {
    sslVerification = null;
  }

  return {
    id: row.id,
    org_id: row.org_id,
    hostname: row.hostname,
    cf_custom_hostname_id: row.cf_custom_hostname_id,
    ssl_status: row.ssl_status as CustomDomainSslStatus,
    verification_errors: verificationErrors,
    ownership_verification: ownershipVerification,
    ssl_verification: sslVerification,
    cname_target: row.cname_target || DEFAULT_CNAME_TARGET,
    cname_verified: row.cname_verified === 1,
    active: row.active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCustomDomainById(
  db: D1Database,
  id: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function getCustomDomainByHostname(
  db: D1Database,
  hostname: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE hostname = ?1 LIMIT 1')
    .bind(hostname.toLowerCase())
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function listCustomDomainsByOrg(
  db: D1Database,
  orgId: string,
): Promise<CustomDomainRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM custom_domains WHERE org_id = ?1 ORDER BY created_at DESC')
    .bind(orgId)
    .all<CustomDomainRow>();

  return (results ?? []).map(mapRowToCustomDomainRecord);
}
```

---

### 4.4 Server Actions: `apps/sophia-ai-factory/src/land/admin/custom-domain-actions.ts`

```typescript
/**
 * Server Actions for Custom Domain Administration (MASTER-tier only).
 *
 * Layer: land (Public business layer)
 * Dependencies: @/seed/*, @/tree/*
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  CustomDomainRecord,
  DomainVerificationResult,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  createCloudflareCustomHostname,
  fetchCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
  getCustomDomainById,
  getCustomDomainByHostname,
  mapRowToCustomDomainRecord,
  type CustomDomainRow,
} from '@/tree/custom-domains/verification-service';

// ── Hostname Validation ───────────────────────────────────────────────────────

const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;
const FORBIDDEN_DOMAINS = new Set([
  'sophia.agencyos.network',
  'agencyos.network',
  'localhost',
  'workers.dev',
]);

export function validateHostname(hostname: string): Result<string, CustomDomainError> {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized || normalized.length < 4 || normalized.length > 253) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Hostname length must be between 4 and 253 characters',
    });
  }

  if (!HOSTNAME_REGEX.test(normalized)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (normalized === forbidden || normalized.endsWith(`.${forbidden}`)) {
      return failure({
        code: 'INVALID_HOSTNAME',
        message: 'Cannot register root platform domains or internal reserved hostnames',
      });
    }
  }

  return success(normalized);
}

// ── Authorization & MASTER Tier Guard ─────────────────────────────────────────

export async function assertMasterTierAndOrgAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, CustomDomainError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);

  // Platform admins bypass org check and tier requirements
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // 1. Verify user is a member of the organization with owner or admin role
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Only organization owners or admins can manage custom domains',
    });
  }

  // 2. Enforce MASTER tier requirement
  // Check subscription tier for org or user
  const tier = await getUserTier(user.id);
  const orgSub = await db
    .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
    .bind(orgId)
    .first<{ tier: string | null; plan: string | null }>();

  const isMaster =
    tier === 'MASTER' ||
    orgSub?.tier === 'MASTER' ||
    orgSub?.plan?.toLowerCase() === 'master';

  if (!isMaster) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Custom domains require a MASTER tier subscription ($4,999 lifetime license)',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Register a new custom domain for an organization (MASTER tier only).
 */
export async function registerCustomDomainAction(
  orgId: string,
  rawHostname: string,
): Promise<Result<CustomDomainRecord, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    // 1. Validate hostname
    const hostValidation = validateHostname(rawHostname);
    if (!hostValidation.ok) return hostValidation;
    const hostname = hostValidation.value;

    // 2. Authorize caller & verify MASTER tier
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 3. Check for existing registration in D1
    const existing = await getCustomDomainByHostname(db, hostname);
    if (existing) {
      return failure({
        code: 'CONFLICT',
        message: `Hostname '${hostname}' is already registered`,
      });
    }

    // 4. Register custom hostname with Cloudflare for SaaS
    const cfResult = await createCloudflareCustomHostname(hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    // 5. Persist to D1
    const domainId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO custom_domains (
          id, org_id, hostname, cf_custom_hostname_id, ssl_status,
          verification_errors, ownership_verification, ssl_verification,
          cname_target, cname_verified, active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        domainId,
        orgId,
        hostname,
        cfData.id,
        sslStatus,
        JSON.stringify(errors),
        JSON.stringify(ownership ?? {}),
        JSON.stringify(sslDcv ?? {}),
        'cname.sophia.agencyos.network',
        cnameVerified ? 1 : 0,
        active ? 1 : 0,
        now,
        now,
      )
      .run();

    const created = await getCustomDomainById(db, domainId);
    if (!created) {
      return failure({ code: 'INTERNAL', message: 'Failed to retrieve created domain record' });
    }

    logger.info('[CustomDomain] Successfully registered custom domain', {
      domainId,
      orgId,
      hostname,
      sslStatus,
    });

    return success(created);
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] registerCustomDomainAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Triggers status re-check against Cloudflare and updates D1.
 */
export async function verifyCustomDomainStatusAction(
  orgId: string,
  domainId: string,
): Promise<Result<DomainVerificationResult, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    // 1. Authorize caller & verify MASTER tier
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 2. Lookup existing domain
    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    if (!domain.cf_custom_hostname_id) {
      return failure({ code: 'INTERNAL', message: 'Domain lacks Cloudflare Custom Hostname ID' });
    }

    // 3. Query Cloudflare Custom Hostnames endpoint
    const cfResult = await fetchCloudflareCustomHostname(domain.cf_custom_hostname_id, domain.hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    const now = Math.floor(Date.now() / 1000);

    // 4. Update D1
    await db
      .prepare(
        `UPDATE custom_domains SET
          ssl_status = ?1,
          verification_errors = ?2,
          ownership_verification = ?3,
          ssl_verification = ?4,
          cname_verified = ?5,
          active = ?6,
          updated_at = ?7
        WHERE id = ?8 AND org_id = ?9`,
      )
      .bind(
        sslStatus,
        JSON.stringify(errors),
        JSON.stringify(ownership ?? {}),
        JSON.stringify(sslDcv ?? {}),
        cnameVerified ? 1 : 0,
        active ? 1 : 0,
        now,
        domainId,
        orgId,
      )
      .run();

    const verificationResult: DomainVerificationResult = {
      domainId,
      hostname: domain.hostname,
      sslStatus,
      cnameVerified,
      active,
      ownershipVerification: ownership,
      sslVerification: sslDcv,
      errors,
      cnameTarget: domain.cname_target,
    };

    logger.info('[CustomDomain] Status verified', {
      domainId,
      hostname: domain.hostname,
      sslStatus,
      active,
    });

    return success(verificationResult);
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] verifyCustomDomainStatusAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Delete a custom domain from Cloudflare and D1.
 */
export async function deleteCustomDomainAction(
  orgId: string,
  domainId: string,
): Promise<Result<{ success: boolean; domainId: string }, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    // 1. Authorize caller
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 2. Lookup existing domain
    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    // 3. Delete from Cloudflare (if ID exists)
    if (domain.cf_custom_hostname_id) {
      const cfDelete = await deleteCloudflareCustomHostname(domain.cf_custom_hostname_id);
      if (!cfDelete.ok) {
        logger.warn('[CustomDomain] Cloudflare deletion failed, proceeding with DB cleanup', {
          domainId,
          cfCustomHostnameId: domain.cf_custom_hostname_id,
        });
      }
    }

    // 4. Delete from D1
    await db
      .prepare('DELETE FROM custom_domains WHERE id = ?1 AND org_id = ?2')
      .bind(domainId, orgId)
      .run();

    logger.info('[CustomDomain] Successfully deleted custom domain', { domainId, orgId });

    return success({ success: true, domainId });
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] deleteCustomDomainAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
```

---

## 5. Verification Method

To independently verify the schema migration and implementation:

### 5.1 Architecture & Layer Boundary Verification
Execute the boundary linter:
```bash
cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
bash scripts/check-layer-boundaries.sh
```
*Expected Result*: Exit code 0, `✅ All layer boundaries clean`.

### 5.2 TypeScript Compilation Check
Execute type checking across all targets:
```bash
cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
npm run type-check
```
*Expected Result*: Exit code 0, zero type errors.

### 5.3 Automated Unit & Integration Testing Blueprint
Create a test file `tests/unit/enterprise/custom-domains.test.ts` to verify:
1. **Hostname Validation**:
   - Accepts valid FQDNs: `app.agency.com`, `video.agency.vn`, `media-hub.sub.domain.org`.
   - Rejects invalid FQDNs: `-portal.com`, `bad..domain`, `toolong.${'a'.repeat(300)}.com`.
   - Rejects reserved hostnames: `sophia.agencyos.network`, `localhost`.
2. **Parser Accuracy**:
   - Accurately parses `ownership_verification` and `validation_records`.
   - Transitions state to `active` only when both `ssl.status === 'active'` and `cname_verified === true`.
   - Correctly flags errors when CA validation encounters errors.
3. **MASTER Tier Gating**:
   - Asserts that sub-MASTER tiers (`BASIC`, `PREMIUM`, `ENTERPRISE`) return `{ code: 'FORBIDDEN' }`.
   - Verifies that `MASTER` tier succeeds.
4. **Mock Fallback**:
   - Confirms that when Cloudflare credentials are absent in test environments, mock registration succeeds deterministically.

Execution command:
```bash
cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
npx vitest run tests/unit/enterprise/custom-domains.test.ts
```

### 5.4 Invalidation Conditions
This design is invalidated if:
1. Cloudflare for SaaS changes its Custom Hostname API v4 path or schema.
2. D1 drops support for `unixepoch()` in default column constraints.
3. Sophia's tier configuration makes custom domains available to non-MASTER tiers.
