/**
 * Opaque-Box E2E Test Harness — Enterprise Scale Engine (Phase 18–19 Scale Ready)
 *
 * Implements the contract specifications from PROJECT.md, TEST_INFRA.md, and ORIGINAL_REQUEST.md:
 * 1. Custom Domains & White-Label (R1 / M1)
 * 2. Multi-User Organizations & 5-Tier RBAC (R2 / M2)
 * 3. Executive BI & Reporting Engine (R3 / M3)
 * 4. Resilient Outbound Webhooks & Event Bus (R4 / M4)
 *
 * Zero external network calls. Built on deterministic in-memory SQLite (node:sqlite)
 * and Web Crypto API.
 *
 * @module __tests__/e2e/enterprise/enterprise-test-harness
 */

import { createRequire } from 'node:module';
import { subtle } from 'node:crypto';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

// ─── D1 Compatible In-Memory SQLite Wrapper ───────────────────────────────────

export interface MockD1Database {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | undefined>;
      run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
    };
    first<T = Record<string, unknown>>(): Promise<T | undefined>;
    run(): Promise<{ success: boolean; meta: { changes: number; duration: number } }>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; duration: number } }>;
  };
  exec(sql: string): void;
  batch(stmts: unknown[]): Promise<unknown[]>;
  rawDb: InstanceType<typeof DatabaseSync>;
}

export const ENTERPRISE_SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  max_seats INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  accepted_at INTEGER
);

CREATE TABLE IF NOT EXISTS custom_domains (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  hostname TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_validation',
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  cname_target TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS org_branding (
  org_id TEXT PRIMARY KEY,
  agency_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  portal_title TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  secondary_color TEXT DEFAULT '#3b82f6',
  custom_css TEXT,
  watermark_position TEXT DEFAULT 'bottom-right',
  watermark_opacity REAL DEFAULT 0.85,
  watermark_policy TEXT DEFAULT 'master_plus',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS executive_bi_metrics (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  throughput_count INTEGER NOT NULL DEFAULT 0,
  viral_score REAL NOT NULL DEFAULT 0,
  affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
  marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  description TEXT DEFAULT '',
  events TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at INTEGER NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export function createEnterpriseD1(): MockD1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(ENTERPRISE_SCHEMA);

  return {
    rawDb: db,
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => db.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

// ─── 1. Custom Domains & White-Label Contracts ────────────────────────────────

export type DomainStatus = 'pending_validation' | 'active' | 'error';
export type SslStatus = 'pending' | 'active' | 'error';

export interface CustomDomainRecord {
  id: string;
  org_id: string;
  hostname: string;
  status: DomainStatus;
  ssl_status: SslStatus;
  cname_target: string;
  verification_token: string;
  error_message?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DomainVerificationResult {
  domainId: string;
  hostname: string;
  status: DomainStatus;
  sslStatus: SslStatus;
  isVerified: boolean;
  errorMessage?: string;
}

export interface BrandingSettings {
  agencyName?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  portalTitle?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customCss?: string | null;
  watermarkPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  watermarkOpacity?: number;
  watermarkPolicy?: 'always' | 'master_plus' | 'never';
}

export interface TenantBrandingContext {
  orgId: string;
  hostname: string;
  branding: BrandingSettings;
}

export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  // Disallow localhost or internal cloudflare edge names
  if (hostname.endsWith('.localhost') || hostname === 'localhost') return false;
  // RFC 1123 hostname validation
  const hostnameRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
  return hostnameRegex.test(hostname);
}

export async function registerCustomDomain(
  db: MockD1Database,
  orgId: string,
  hostname: string,
): Promise<CustomDomainRecord> {
  const normalized = hostname.trim().toLowerCase();
  if (!isValidHostname(normalized)) {
    throw new Error(`INVALID_HOSTNAME: '${hostname}' does not conform to RFC 1123 hostname rules`);
  }

  // Check uniqueness
  const existing = await db
    .prepare('SELECT id FROM custom_domains WHERE hostname = ?1')
    .bind(normalized)
    .first<{ id: string }>();

  if (existing) {
    throw new Error(`DOMAIN_ALREADY_EXISTS: Hostname '${normalized}' is already registered`);
  }

  const now = Date.now();
  const id = `dom_${Math.random().toString(36).substring(2, 11)}`;
  const verificationToken = `cf-custom-domain-${Math.random().toString(36).substring(2, 14)}`;
  const cnameTarget = 'cname.sophia.agencyos.network';

  await db
    .prepare(
      `INSERT INTO custom_domains
       (id, org_id, hostname, status, ssl_status, cname_target, verification_token, error_message, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'pending_validation', 'pending', ?4, ?5, NULL, ?6, ?7)`
    )
    .bind(id, orgId, normalized, cnameTarget, verificationToken, now, now)
    .run();

  return {
    id,
    org_id: orgId,
    hostname: normalized,
    status: 'pending_validation',
    ssl_status: 'pending',
    cname_target: cnameTarget,
    verification_token: verificationToken,
    error_message: null,
    created_at: now,
    updated_at: now,
  };
}

export async function verifyCustomDomainStatus(
  db: MockD1Database,
  domainId: string,
  mockCloudflareResponse?: { cnameValid: boolean; sslActive: boolean; errorMessage?: string }
): Promise<DomainVerificationResult> {
  const domain = await db
    .prepare('SELECT * FROM custom_domains WHERE id = ?1')
    .bind(domainId)
    .first<CustomDomainRecord>();

  if (!domain) {
    throw new Error(`DOMAIN_NOT_FOUND: Domain '${domainId}' does not exist`);
  }

  const now = Date.now();
  const response = mockCloudflareResponse ?? { cnameValid: true, sslActive: true };

  let newStatus: DomainStatus = 'pending_validation';
  let newSslStatus: SslStatus = 'pending';
  let errorMsg: string | null = null;

  if (response.errorMessage) {
    newStatus = 'error';
    newSslStatus = 'error';
    errorMsg = response.errorMessage;
  } else if (response.cnameValid && response.sslActive) {
    newStatus = 'active';
    newSslStatus = 'active';
  } else if (!response.cnameValid) {
    newStatus = 'pending_validation';
    newSslStatus = 'pending';
  }

  await db
    .prepare(
      `UPDATE custom_domains
       SET status = ?1, ssl_status = ?2, error_message = ?3, updated_at = ?4
       WHERE id = ?5`
    )
    .bind(newStatus, newSslStatus, errorMsg, now, domainId)
    .run();

  return {
    domainId,
    hostname: domain.hostname,
    status: newStatus,
    sslStatus: newSslStatus,
    isVerified: newStatus === 'active',
    errorMessage: errorMsg ?? undefined,
  };
}

export async function resolveTenantFromHostname(
  db: MockD1Database,
  hostname: string
): Promise<TenantBrandingContext | null> {
  const normalized = hostname.trim().toLowerCase();
  const domain = await db
    .prepare(`SELECT org_id, status FROM custom_domains WHERE hostname = ?1`)
    .bind(normalized)
    .first<{ org_id: string; status: DomainStatus }>();

  if (!domain || domain.status !== 'active') {
    return null;
  }

  const brandingRow = await db
    .prepare(`SELECT * FROM org_branding WHERE org_id = ?1`)
    .bind(domain.org_id)
    .first<Record<string, unknown>>();

  const branding: BrandingSettings = brandingRow
    ? {
        agencyName: (brandingRow.agency_name as string) ?? null,
        logoUrl: (brandingRow.logo_url as string) ?? null,
        faviconUrl: (brandingRow.favicon_url as string) ?? null,
        portalTitle: (brandingRow.portal_title as string) ?? null,
        primaryColor: (brandingRow.primary_color as string) ?? '#0f172a',
        secondaryColor: (brandingRow.secondary_color as string) ?? '#3b82f6',
        customCss: (brandingRow.custom_css as string) ?? null,
      }
    : {
        primaryColor: '#0f172a',
        secondaryColor: '#3b82f6',
      };

  return {
    orgId: domain.org_id,
    hostname: normalized,
    branding,
  };
}

export function resolveThemeCssVariables(branding: BrandingSettings): Record<string, string> {
  const sanitizeColor = (color: string | null | undefined, fallback: string) => {
    if (!color) return fallback;
    // Disallow injection payloads (semicolons, braces, expression)
    if (/^[#a-zA-Z0-9(),. -]+$/.test(color) && !/[;{}]/.test(color)) {
      return color;
    }
    return fallback;
  };

  return {
    '--theme-primary': sanitizeColor(branding.primaryColor, '#0f172a'),
    '--theme-secondary': sanitizeColor(branding.secondaryColor, '#3b82f6'),
    '--theme-logo': branding.logoUrl ? `url("${branding.logoUrl.replace(/[\\"']/g, '')}")` : 'none',
    '--theme-portal-title': JSON.stringify(branding.portalTitle ?? 'Sophia AI Factory'),
    '--theme-custom-css': branding.customCss ?? '',
  };
}

export function wrapWithAgencyBranding(htmlContent: string, branding: BrandingSettings): string {
  const agency = branding.agencyName
    ? branding.agencyName
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    : 'Sophia AI Factory';
  const logo = branding.logoUrl
    ? `<img src="${branding.logoUrl.replace(/"/g, '&quot;')}" alt="${agency}" style="max-height: 48px; display: block; margin-bottom: 16px;" />`
    : '';
  const primaryColor = branding.primaryColor || '#0f172a';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${agency}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 2px solid ${primaryColor};">
              ${logo}
              <div style="font-size: 18px; font-weight: 700; color: ${primaryColor};">${agency}</div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              ${htmlContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              Sent by ${agency} • Powered by Sophia Enterprise Scale Engine
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── 2. Multi-User Organizations & 5-Tier RBAC Contracts ───────────────────────

export type OrgTier = 'free' | 'starter' | 'pro' | 'master';
export type OrgRole = 'owner' | 'admin' | 'creator' | 'billing_manager' | 'viewer';

export type OrgPermission =
  | 'canCreateMissions'
  | 'canManageBilling'
  | 'canInviteMembers'
  | 'canPublishVideos'
  | 'canConfigureWebhooks';

export const TIER_SEAT_LIMITS: Record<OrgTier, number> = {
  free: 1,
  starter: 1,
  pro: 5,
  master: 999,
};

export const RBAC_PERMISSIONS_MATRIX: Record<OrgRole, readonly OrgPermission[]> = {
  owner: [
    'canCreateMissions',
    'canManageBilling',
    'canInviteMembers',
    'canPublishVideos',
    'canConfigureWebhooks',
  ],
  admin: [
    'canCreateMissions',
    'canInviteMembers',
    'canPublishVideos',
    'canConfigureWebhooks',
  ],
  creator: [
    'canCreateMissions',
    'canPublishVideos',
  ],
  billing_manager: [
    'canManageBilling',
  ],
  viewer: [],
};

export function hasOrgPermission(role: OrgRole, permission: OrgPermission): boolean {
  const perms = RBAC_PERMISSIONS_MATRIX[role];
  return perms ? perms.includes(permission) : false;
}

export function assertTenantScope(currentOrgId: string, targetResourceOrgId: string): void {
  if (!currentOrgId || !targetResourceOrgId || currentOrgId !== targetResourceOrgId) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Current org context '${currentOrgId}' is not authorized to access resource in org '${targetResourceOrgId}'`
    );
  }
}

export async function createOrganization(
  db: MockD1Database,
  input: { name: string; slug: string; tier: OrgTier; ownerUserId: string }
): Promise<{ orgId: string; name: string; slug: string; tier: OrgTier; maxSeats: number }> {
  const now = Date.now();
  const orgId = `org_${Math.random().toString(36).substring(2, 11)}`;
  const maxSeats = TIER_SEAT_LIMITS[input.tier] ?? 1;

  await db
    .prepare(
      `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7)`
    )
    .bind(orgId, input.name, input.slug, input.tier, maxSeats, now, now)
    .run();

  // Add owner to members
  const memberId = `mem_${Math.random().toString(36).substring(2, 11)}`;
  await db
    .prepare(
      `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'owner', ?4, ?5)`
    )
    .bind(memberId, orgId, input.ownerUserId, now, now)
    .run();

  return {
    orgId,
    name: input.name,
    slug: input.slug,
    tier: input.tier,
    maxSeats,
  };
}

export async function checkSeatQuota(
  db: MockD1Database,
  orgId: string
): Promise<{ allocated: number; maxSeats: number; isAllowed: boolean }> {
  const org = await db
    .prepare(`SELECT max_seats FROM organizations WHERE id = ?1`)
    .bind(orgId)
    .first<{ max_seats: number }>();

  if (!org) {
    throw new Error(`ORGANIZATION_NOT_FOUND: Org '${orgId}' does not exist`);
  }

  const membersCountRow = await db
    .prepare(`SELECT COUNT(*) as count FROM organization_members WHERE org_id = ?1`)
    .bind(orgId)
    .first<{ count: number }>();

  const allocated = Number(membersCountRow?.count ?? 0);
  const maxSeats = org.max_seats;

  return {
    allocated,
    maxSeats,
    isAllowed: allocated < maxSeats,
  };
}

export async function sha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createOrgInvitation(
  db: MockD1Database,
  orgId: string,
  email: string,
  role: OrgRole,
  invitedByUserId: string
): Promise<{ invitationId: string; inviteUrl: string; token: string; expiresAt: number }> {
  const quota = await checkSeatQuota(db, orgId);
  if (!quota.isAllowed) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${quota.allocated}/${quota.maxSeats})`);
  }

  // Generate 256-bit crypto token
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const token = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7-day TTL
  const expiresAt = now + ttlMs;
  const invitationId = `inv_${Math.random().toString(36).substring(2, 11)}`;

  await db
    .prepare(
      `INSERT INTO organization_invitations
       (id, org_id, email, role, token_hash, invited_by, expires_at, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)`
    )
    .bind(invitationId, orgId, email.toLowerCase().trim(), role, tokenHash, invitedByUserId, expiresAt, now)
    .run();

  const inviteUrl = `https://sophia.agencyos.network/invitations/accept?token=${token}`;
  return {
    invitationId,
    inviteUrl,
    token,
    expiresAt,
  };
}

export async function acceptOrgInvitation(
  db: MockD1Database,
  token: string,
  userId: string
): Promise<{ success: boolean; orgId: string; role: OrgRole }> {
  const tokenHash = await sha256Hex(token);
  const now = Date.now();

  const invitation = await db
    .prepare(`SELECT * FROM organization_invitations WHERE token_hash = ?1`)
    .bind(tokenHash)
    .first<{
      id: string;
      org_id: string;
      role: OrgRole;
      status: string;
      expires_at: number;
    }>();

  if (!invitation) {
    throw new Error(`INVALID_INVITATION_TOKEN: Invitation token not found`);
  }

  if (invitation.status !== 'pending') {
    throw new Error(`INVITATION_ALREADY_USED: Invitation has status '${invitation.status}'`);
  }

  if (now > invitation.expires_at) {
    await db
      .prepare(`UPDATE organization_invitations SET status = 'expired' WHERE id = ?1`)
      .bind(invitation.id)
      .run();
    throw new Error(`INVITATION_EXPIRED: Token expired at ${invitation.expires_at}`);
  }

  // Re-check seat quota at acceptance time
  const quota = await checkSeatQuota(db, invitation.org_id);
  if (!quota.isAllowed) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Organization is full (${quota.allocated}/${quota.maxSeats})`);
  }

  // Add member
  const memberId = `mem_${Math.random().toString(36).substring(2, 11)}`;
  await db
    .prepare(
      `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(memberId, invitation.org_id, userId, invitation.role, now, now)
    .run();

  // Mark consumed
  await db
    .prepare(
      `UPDATE organization_invitations
       SET status = 'accepted', accepted_at = ?1
       WHERE id = ?2`
    )
    .bind(now, invitation.id)
    .run();

  return {
    success: true,
    orgId: invitation.org_id,
    role: invitation.role,
  };
}

// ─── 3. Executive Business Intelligence (BI) Contracts ────────────────────────

export interface DateRange {
  start: number;
  end: number;
}

export interface ExecutiveBIMetricsSummary {
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  roiRatio: number;
}

export async function aggregateExecutiveBIMetrics(
  db: MockD1Database,
  orgId: string,
  dateRange: DateRange
): Promise<ExecutiveBIMetricsSummary> {
  const rows = await db
    .prepare(
      `SELECT * FROM executive_bi_metrics
       WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3`
    )
    .bind(orgId, dateRange.start, dateRange.end)
    .all<{
      mrr_cents: number;
      throughput_count: number;
      viral_score: number;
      affiliate_revenue_cents: number;
      marketing_spend_cents: number;
    }>();

  const results = rows.results ?? [];
  if (results.length === 0) {
    return {
      orgId,
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
      mrrCents: 0,
      throughputCount: 0,
      viralScore: 0,
      affiliateRevenueCents: 0,
      marketingSpendCents: 0,
      roiRatio: 0,
    };
  }

  let totalMrr = 0;
  let totalThroughput = 0;
  let sumViral = 0;
  let totalAffiliate = 0;
  let totalSpend = 0;

  for (const r of results) {
    totalMrr = Math.max(totalMrr, r.mrr_cents); // peak MRR
    totalThroughput += r.throughput_count;
    sumViral += r.viral_score;
    totalAffiliate += r.affiliate_revenue_cents;
    totalSpend += r.marketing_spend_cents;
  }

  const avgViral = results.length > 0 ? Number((sumViral / results.length).toFixed(2)) : 0;
  const roiRatio = totalSpend > 0 ? Number((totalAffiliate / totalSpend).toFixed(2)) : totalAffiliate > 0 ? 99.0 : 0;

  return {
    orgId,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    mrrCents: totalMrr,
    throughputCount: totalThroughput,
    viralScore: avgViral,
    affiliateRevenueCents: totalAffiliate,
    marketingSpendCents: totalSpend,
    roiRatio,
  };
}

export function escapeTelegramMarkdownV2(text: string): string {
  // Escapes characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function formatTelegramDigest(metrics: ExecutiveBIMetricsSummary, branding?: BrandingSettings): string {
  const agency = branding?.agencyName ?? 'Sophia AI Factory';
  const mrrUsd = (metrics.mrrCents / 100).toFixed(2);
  const affiliateUsd = (metrics.affiliateRevenueCents / 100).toFixed(2);
  const spendUsd = (metrics.marketingSpendCents / 100).toFixed(2);

  const raw = `📊 *Executive BI Digest — ${agency}*
• *MRR*: $${mrrUsd}
• *Video Throughput*: ${metrics.throughputCount} videos
• *Viral Score*: ${metrics.viralScore}/100
• *Affiliate Revenue*: $${affiliateUsd}
• *Marketing Spend*: $${spendUsd}
• *ROI*: ${metrics.roiRatio}x

_Automated report generated by Sophia Enterprise Engine_`;

  return escapeTelegramMarkdownV2(raw);
}

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatStreamingCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const rowLines = rows.map((row) => headers.map((h) => escapeCsvField(row[h])).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

// ─── 4. Resilient Outbound Webhooks Contracts ─────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  description: string;
  events: string[];
  status: 'active' | 'disabled';
  created_at: number;
  updated_at: number;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  org_id: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed' | 'dead_letter';
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: number;
  response_code?: number | null;
  error_message?: string | null;
  created_at: number;
  updated_at: number;
}

export const BACKOFF_SCHEDULE_SECONDS = [30, 120, 600, 3600, 21600]; // 30s, 2m, 10m, 1h, 6h

export function calculateBackoffDelay(attempt: number, withJitter = false): number {
  const idx = Math.min(attempt - 1, BACKOFF_SCHEDULE_SECONDS.length - 1);
  const baseSeconds = BACKOFF_SCHEDULE_SECONDS[Math.max(0, idx)];
  if (!withJitter) return baseSeconds * 1000;
  // Apply +/- 10% deterministic jitter simulation
  const jitterFactor = 0.9 + (attempt * 0.05) % 0.2;
  return Math.floor(baseSeconds * jitterFactor * 1000);
}

export async function generateWebhookSignature(
  secret: string,
  payload: string,
  timestamp: number
): Promise<string> {
  const encoder = new TextEncoder();
  const signaturePayload = `${timestamp}.${payload}`;
  const keyData = encoder.encode(secret);

  const cryptoKey = await subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await subtle.sign('HMAC', cryptoKey, encoder.encode(signaturePayload));
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `t=${timestamp},v1=${hex}`;
}

export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  header: string,
  toleranceSeconds = 300
): Promise<boolean> {
  if (!header || !secret || payload === undefined || payload === null) return false;

  // Header format: t=1600000000,v1=abcdef...
  const parts = header.split(',');
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const p of parts) {
    const [k, v] = p.trim().split('=');
    if (k === 't') timestamp = Number(v);
    if (k === 'v1') signature = v;
  }

  if (!timestamp || !signature || Number.isNaN(timestamp)) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSeconds) {
    return false; // Replay attack protection
  }

  const expectedHeader = await generateWebhookSignature(secret, payload, timestamp);
  const expectedSig = expectedHeader.split(',v1=')[1];

  // Timing safe comparison
  if (signature.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }

  return mismatch === 0;
}

export async function createWebhookEndpoint(
  db: MockD1Database,
  orgId: string,
  input: { url: string; secret: string; description?: string; events: string[] }
): Promise<WebhookEndpoint> {
  if (!input.url.startsWith('https://')) {
    throw new Error(`INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol`);
  }

  const now = Date.now();
  const id = `wep_${Math.random().toString(36).substring(2, 11)}`;

  await db
    .prepare(
      `INSERT INTO webhook_endpoints (id, org_id, url, secret, description, events, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)`
    )
    .bind(
      id,
      orgId,
      input.url,
      input.secret,
      input.description ?? '',
      JSON.stringify(input.events),
      now,
      now
    )
    .run();

  return {
    id,
    org_id: orgId,
    url: input.url,
    secret: input.secret,
    description: input.description ?? '',
    events: input.events,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

export async function dispatchWebhookDelivery(
  db: MockD1Database,
  endpoint: WebhookEndpoint,
  event: string,
  payload: unknown,
  mockFetch?: (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; ok: boolean }>
): Promise<WebhookDelivery> {
  // Check if endpoint is subscribed to this event
  if (!endpoint.events.includes(event) && !endpoint.events.includes('*')) {
    throw new Error(`EVENT_NOT_SUBSCRIBED: Endpoint '${endpoint.id}' is not subscribed to event '${event}'`);
  }

  const payloadString = JSON.stringify(payload);
  const now = Date.now();
  const deliveryId = `del_${Math.random().toString(36).substring(2, 11)}`;
  const signature = await generateWebhookSignature(endpoint.secret, payloadString, Math.floor(now / 1000));

  const headers = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': event,
    'X-Sophia-Delivery': deliveryId,
  };

  const fetcher = mockFetch ?? (async () => ({ status: 200, ok: true }));
  let deliveryStatus: 'success' | 'failed' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;
  let nextAttemptAt = now;

  try {
    const res = await fetcher(endpoint.url, headers, payloadString);
    responseCode = res.status;
    if (!res.ok) {
      deliveryStatus = 'failed';
      errorMsg = `HTTP_${res.status}`;
      nextAttemptAt = now + calculateBackoffDelay(1);
    }
  } catch (err) {
    deliveryStatus = 'failed';
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
    nextAttemptAt = now + calculateBackoffDelay(1);
  }

  await db
    .prepare(
      `INSERT INTO webhook_deliveries
       (id, endpoint_id, org_id, event, payload, status, attempt_count, max_attempts, next_attempt_at, response_code, error_message, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 5, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      deliveryId,
      endpoint.id,
      endpoint.org_id,
      event,
      payloadString,
      deliveryStatus,
      nextAttemptAt,
      responseCode,
      errorMsg,
      now,
      now
    )
    .run();

  return {
    id: deliveryId,
    endpoint_id: endpoint.id,
    org_id: endpoint.org_id,
    event,
    payload: payloadString,
    status: deliveryStatus,
    attempt_count: 1,
    max_attempts: 5,
    next_attempt_at: nextAttemptAt,
    response_code: responseCode,
    error_message: errorMsg,
    created_at: now,
    updated_at: now,
  };
}

export async function processWebhookRetry(
  db: MockD1Database,
  deliveryId: string,
  mockFetch?: (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; ok: boolean }>
): Promise<WebhookDelivery> {
  const row = await db
    .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
    .bind(deliveryId)
    .first<WebhookDelivery>();

  if (!row) {
    throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);
  }

  const endpoint = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpoint>();

  if (!endpoint) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);
  }

  const now = Date.now();
  const nextAttempt = row.attempt_count + 1;
  const signature = await generateWebhookSignature(endpoint.secret, row.payload, Math.floor(now / 1000));

  const headers = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': row.event,
    'X-Sophia-Delivery': deliveryId,
  };

  const fetcher = mockFetch ?? (async () => ({ status: 200, ok: true }));
  let newStatus: 'success' | 'failed' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;
  let nextAttemptAt = now;

  try {
    const res = await fetcher(endpoint.url, headers, row.payload);
    responseCode = res.status;
    if (!res.ok) {
      if (nextAttempt >= row.max_attempts) {
        newStatus = 'dead_letter';
      } else {
        newStatus = 'failed';
        nextAttemptAt = now + calculateBackoffDelay(nextAttempt);
      }
      errorMsg = `HTTP_${res.status}`;
    }
  } catch (err) {
    if (nextAttempt >= row.max_attempts) {
      newStatus = 'dead_letter';
    } else {
      newStatus = 'failed';
      nextAttemptAt = now + calculateBackoffDelay(nextAttempt);
    }
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  await db
    .prepare(
      `UPDATE webhook_deliveries
       SET status = ?1, attempt_count = ?2, next_attempt_at = ?3, response_code = ?4, error_message = ?5, updated_at = ?6
       WHERE id = ?7`
    )
    .bind(newStatus, nextAttempt, nextAttemptAt, responseCode, errorMsg, now, deliveryId)
    .run();

  return {
    ...row,
    status: newStatus,
    attempt_count: nextAttempt,
    next_attempt_at: nextAttemptAt,
    response_code: responseCode,
    error_message: errorMsg,
    updated_at: now,
  };
}

export async function replayWebhookAttempt(
  db: MockD1Database,
  orgId: string,
  deliveryId: string,
  mockFetch?: (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; ok: boolean }>
): Promise<WebhookDelivery> {
  const row = await db
    .prepare(`SELECT * FROM webhook_deliveries WHERE id = ?1`)
    .bind(deliveryId)
    .first<WebhookDelivery>();

  if (!row) {
    throw new Error(`DELIVERY_NOT_FOUND: Delivery '${deliveryId}' not found`);
  }

  assertTenantScope(orgId, row.org_id);

  const endpoint = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1`)
    .bind(row.endpoint_id)
    .first<WebhookEndpoint>();

  if (!endpoint) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${row.endpoint_id}' not found`);
  }

  const now = Date.now();
  const signature = await generateWebhookSignature(endpoint.secret, row.payload, Math.floor(now / 1000));

  const headers = {
    'Content-Type': 'application/json',
    'X-Sophia-Signature': signature,
    'X-Sophia-Event': row.event,
    'X-Sophia-Delivery': deliveryId,
    'X-Sophia-Replay': 'true',
  };

  const fetcher = mockFetch ?? (async () => ({ status: 200, ok: true }));
  let status: 'success' | 'failed' | 'dead_letter' = 'success';
  let responseCode = 200;
  let errorMsg: string | null = null;

  try {
    const res = await fetcher(endpoint.url, headers, row.payload);
    responseCode = res.status;
    if (!res.ok) {
      status = 'dead_letter';
      errorMsg = `REPLAY_FAILED_HTTP_${res.status}`;
    }
  } catch (err) {
    status = 'dead_letter';
    responseCode = 0;
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  await db
    .prepare(
      `UPDATE webhook_deliveries
       SET status = ?1, response_code = ?2, error_message = ?3, updated_at = ?4
       WHERE id = ?5`
    )
    .bind(status, responseCode, errorMsg, now, deliveryId)
    .run();

  return {
    ...row,
    status,
    response_code: responseCode,
    error_message: errorMsg,
    updated_at: now,
  };
}
