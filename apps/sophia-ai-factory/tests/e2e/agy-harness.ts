/**
 * Opaque-Box E2E Test Harness — Full-Stack AGY
 * (AgencyOS Multi-Tenancy, Agent Governance YAML, Client Onboarding & Agency Portal)
 *
 * Implements the contract specifications from PROJECT.md and ORIGINAL_REQUEST.md:
 * - R1: AGY Multi-Tenancy & Tenant Isolation (Domain router, tokens, sliding rate-limiter, quotas, D1 row scoping)
 * - R2: Agent Governance YAML Schema & Engine (Zod validation, size guards, L0-L4 gates, allow/deny, SHA-256 digests)
 * - R3: Agency Client Onboarding & Portal Experience (Slug validator, brand sanitization, seed agent deployment, attribution)
 *
 * Built on deterministic in-memory SQLite (node:sqlite) and standard Web Crypto / Node crypto. Zero flaky external calls.
 *
 * @module tests/e2e/agy-harness
 */

import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import yaml from 'js-yaml';

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
  rawDb: InstanceType<typeof DatabaseSync>;
}

export const AGY_D1_SCHEMA = `
CREATE TABLE IF NOT EXISTS agy_tenant_configs (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL,
  agency_slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  primary_color TEXT DEFAULT '#3B82F6',
  logo_url TEXT,
  quota_limit_mcu INTEGER NOT NULL DEFAULT 50000,
  quota_used_mcu INTEGER NOT NULL DEFAULT 0,
  rate_limit_rps INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_tenant_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  agency_id TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  signature TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_agency_domains (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  domain_name TEXT NOT NULL UNIQUE,
  domain_type TEXT NOT NULL, -- 'subdomain' or 'custom'
  ssl_status TEXT NOT NULL DEFAULT 'active',
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_audit_logs (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  prev_hash TEXT,
  record_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_policy_audit_ledger (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  requested_autonomy TEXT NOT NULL,
  required_autonomy TEXT NOT NULL,
  requested_compute_units INTEGER NOT NULL,
  allowed INTEGER NOT NULL,
  escalation_triggered INTEGER NOT NULL,
  reason TEXT NOT NULL,
  evaluation_sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_subaccounts (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  mcu_allocated INTEGER NOT NULL DEFAULT 0,
  mcu_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_seed_agents (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  role TEXT NOT NULL,
  template TEXT NOT NULL,
  max_autonomy TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agy_attribution_ledger (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL,
  subaccount_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  attribution_type TEXT NOT NULL,
  mcu_consumed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export function createAgyTestD1(): MockD1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(AGY_D1_SCHEMA);

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
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

// ─── Contracts & Interface Types (as specified in PROJECT.md) ─────────────────

export interface AgencyTenantContext {
  agencyId: string;
  orgId: string;
  agencySlug: string;
  customDomain?: string;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  rateLimitRps: number;
}

export interface TenantResolutionResult {
  isAgencySubdomain: boolean;
  isCustomDomain: boolean;
  agencySlug: string | null;
  tenantOrgId: string | null;
  agencyId: string | null;
}

export interface AgyTenantToken {
  token: string;
  agencyId: string;
  permissions: string[];
  expiresAt: number;
  signature: string;
}

export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface AgentGovernanceYaml {
  schemaVersion: string;
  agent: {
    id: string;
    name: string;
    role: string;
    maxAutonomyLevel: AutonomyLevel;
  };
  compute: {
    maxTokensPerRun: number;
    maxComputeUnitsMcu: number;
  };
  permissions: {
    allow: string[];
    deny: string[];
  };
  escalation: {
    onQuotaExceeded: 'halt' | 'request_approval';
    onDisallowedAction: 'halt' | 'escalate_human';
  };
}

export interface PolicyEvaluationRequest {
  agencyId: string;
  agentId: string;
  action: string;
  requestedAutonomy: AutonomyLevel;
  requestedComputeUnits: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyEvaluationVerdict {
  allowed: boolean;
  reason: string;
  requiredAutonomy: AutonomyLevel;
  escalationTriggered: boolean;
  evaluationSha256: string;
}

export interface AgencyOnboardingInput {
  agencyName: string;
  agencySlug: string;
  customDomain?: string;
  primaryColor?: string;
  logoUrl?: string;
  seedAgents: Array<{
    role: string;
    template: string;
    maxAutonomy: AutonomyLevel;
  }>;
}

export interface AgencyPortalOverview {
  agencyId: string;
  agencyName: string;
  totalClients: number;
  activeCampaigns: number;
  totalMcuConsumed: number;
  estimatedMrrUsd: number;
}

// ─── R1: Multi-Tenancy & Edge Domain Routing Engine ──────────────────────────

export const RESERVED_PLATFORM_SUBDOMAINS = new Set([
  'sophia',
  'api',
  'admin',
  'preview',
  'cname',
  'cdn',
  'workers',
  'pages',
  'app',
  'www',
  'sub',
  'portal',
]);

export function resolveTenantFromHostname(
  hostname: string,
  customDomainLookup?: (domain: string) => { agencyId: string; orgId: string; agencySlug: string } | null
): TenantResolutionResult {
  const cleanHost = hostname.trim().toLowerCase();

  // 1. Direct platform canonical domain
  if (cleanHost === 'agencyos.network' || cleanHost === 'sophia.agencyos.network') {
    return {
      isAgencySubdomain: false,
      isCustomDomain: false,
      agencySlug: null,
      tenantOrgId: null,
      agencyId: null,
    };
  }

  // 2. Subdomain of agencyos.network
  if (cleanHost.endsWith('.agencyos.network')) {
    const parts = cleanHost.split('.');
    if (parts.length === 3) {
      const subdomain = parts[0];
      if (RESERVED_PLATFORM_SUBDOMAINS.has(subdomain)) {
        return {
          isAgencySubdomain: false,
          isCustomDomain: false,
          agencySlug: null,
          tenantOrgId: null,
          agencyId: null,
        };
      }
      return {
        isAgencySubdomain: true,
        isCustomDomain: false,
        agencySlug: subdomain,
        tenantOrgId: `org_${subdomain}`,
        agencyId: `agy_${subdomain}`,
      };
    }
  }

  // 3. Custom Domain Lookup
  if (customDomainLookup) {
    const customMatch = customDomainLookup(cleanHost);
    if (customMatch) {
      return {
        isAgencySubdomain: false,
        isCustomDomain: true,
        agencySlug: customMatch.agencySlug,
        tenantOrgId: customMatch.orgId,
        agencyId: customMatch.agencyId,
      };
    }
  }

  // 4. Default: unresolvable external domain
  return {
    isAgencySubdomain: false,
    isCustomDomain: false,
    agencySlug: null,
    tenantOrgId: null,
    agencyId: null,
  };
}

// ─── Cryptographic Tenant Token Engine ───────────────────────────────────────

export function generateAgyTenantToken(
  secretKey: string,
  agencyId: string,
  permissions: string[],
  ttlSeconds = 3600,
  currentTimeMs?: number
): AgyTenantToken {
  if (!secretKey || secretKey.length < 16) {
    throw new Error('SECRET_KEY_TOO_WEAK: Secret key must be at least 16 characters');
  }
  if (!agencyId || agencyId.trim().length === 0) {
    throw new Error('INVALID_AGENCY_ID: Agency ID cannot be empty');
  }

  const now = currentTimeMs ?? Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  const tokenPayload = `${agencyId}:${permissions.sort().join(',')}:${expiresAt}`;
  const signature = createHmac('sha256', secretKey).update(tokenPayload).digest('hex');
  const token = Buffer.from(tokenPayload).toString('base64url');

  return {
    token,
    agencyId,
    permissions,
    expiresAt,
    signature,
  };
}

export function verifyAgyTenantToken(
  secretKey: string,
  tokenObj: AgyTenantToken,
  currentTimeMs?: number
): { valid: boolean; reason?: string } {
  const now = currentTimeMs ?? Date.now();

  if (now > tokenObj.expiresAt) {
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }

  const tokenPayload = `${tokenObj.agencyId}:${[...tokenObj.permissions].sort().join(',')}:${tokenObj.expiresAt}`;
  const expectedSig = createHmac('sha256', secretKey).update(tokenPayload).digest('hex');

  if (expectedSig !== tokenObj.signature) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}

// ─── Sliding-Window Rate Limiter & Quota Engine ───────────────────────────────

export class AgencyRateLimitEngine {
  private windows = new Map<string, number[]>();

  public checkRateLimit(
    agencyId: string,
    rpsLimit: number,
    nowMs?: number
  ): { allowed: boolean; currentRps: number; remaining: number; retryAfterMs: number } {
    const now = nowMs ?? Date.now();
    const windowStart = now - 1000;

    let timestamps = this.windows.get(agencyId) ?? [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= rpsLimit) {
      const oldestInWindow = timestamps[0] ?? now;
      const retryAfterMs = Math.max(1, 1000 - (now - oldestInWindow));
      this.windows.set(agencyId, timestamps);
      return {
        allowed: false,
        currentRps: timestamps.length,
        remaining: 0,
        retryAfterMs,
      };
    }

    timestamps.push(now);
    this.windows.set(agencyId, timestamps);

    return {
      allowed: true,
      currentRps: timestamps.length,
      remaining: Math.max(0, rpsLimit - timestamps.length),
      retryAfterMs: 0,
    };
  }

  public reset(agencyId?: string) {
    if (agencyId) {
      this.windows.delete(agencyId);
    } else {
      this.windows.clear();
    }
  }
}

export async function checkAndDeductComputeQuota(
  db: MockD1Database,
  agencyId: string,
  requestedMcu: number
): Promise<{ allowed: boolean; quotaLimitMcu: number; quotaUsedMcu: number; remainingMcu: number; reason?: string }> {
  if (requestedMcu <= 0 || !Number.isFinite(requestedMcu)) {
    return {
      allowed: false,
      quotaLimitMcu: 0,
      quotaUsedMcu: 0,
      remainingMcu: 0,
      reason: 'INVALID_REQUESTED_MCU',
    };
  }

  const row = await db
    .prepare('SELECT quota_limit_mcu, quota_used_mcu FROM agy_tenant_configs WHERE agency_id = ?')
    .bind(agencyId)
    .first<{ quota_limit_mcu: number; quota_used_mcu: number }>();

  if (!row) {
    return {
      allowed: false,
      quotaLimitMcu: 0,
      quotaUsedMcu: 0,
      remainingMcu: 0,
      reason: 'AGENCY_NOT_FOUND',
    };
  }

  const remaining = row.quota_limit_mcu - row.quota_used_mcu;
  if (requestedMcu > remaining) {
    return {
      allowed: false,
      quotaLimitMcu: row.quota_limit_mcu,
      quotaUsedMcu: row.quota_used_mcu,
      remainingMcu: remaining,
      reason: 'QUOTA_EXHAUSTED',
    };
  }

  await db
    .prepare('UPDATE agy_tenant_configs SET quota_used_mcu = quota_used_mcu + ?, updated_at = ? WHERE agency_id = ?')
    .bind(requestedMcu, Date.now(), agencyId)
    .run();

  return {
    allowed: true,
    quotaLimitMcu: row.quota_limit_mcu,
    quotaUsedMcu: row.quota_used_mcu + requestedMcu,
    remainingMcu: remaining - requestedMcu,
  };
}

// ─── R2: Agent Governance YAML (AGY) Schema & Policy Engine ──────────────────

export const MAX_AGY_YAML_BYTES = 512 * 1024; // 512 KB Cloudflare edge limit

const AUTONOMY_RANKS: Record<AutonomyLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

export function parseAgentGovernanceYaml(yamlString: string, maxBytes = MAX_AGY_YAML_BYTES): AgentGovernanceYaml {
  const byteLength = Buffer.byteLength(yamlString, 'utf8');
  if (byteLength > maxBytes) {
    throw new Error(`PAYLOAD_TOO_LARGE: YAML document (${byteLength} bytes) exceeds limit of ${maxBytes} bytes`);
  }

  let doc: unknown;
  try {
    doc = yaml.load(yamlString);
  } catch (err: unknown) {
    throw new Error(`YAML_SYNTAX_ERROR: ${(err as Error).message}`);
  }

  if (!doc || typeof doc !== 'object') {
    throw new Error('INVALID_SCHEMA: AGY root must be an object');
  }

  const d = doc as Record<string, unknown>;

  if (typeof d.schemaVersion !== 'string' || !d.schemaVersion.trim()) {
    throw new Error('INVALID_SCHEMA: schemaVersion is required');
  }

  const agent = d.agent as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== 'object') {
    throw new Error('INVALID_SCHEMA: agent section is required');
  }

  if (typeof agent.id !== 'string' || !agent.id.trim()) {
    throw new Error('INVALID_SCHEMA: agent.id is required');
  }
  if (typeof agent.name !== 'string' || !agent.name.trim()) {
    throw new Error('INVALID_SCHEMA: agent.name is required');
  }
  if (typeof agent.role !== 'string' || !agent.role.trim()) {
    throw new Error('INVALID_SCHEMA: agent.role is required');
  }

  const maxAutonomy = agent.maxAutonomyLevel as string;
  if (!['L0', 'L1', 'L2', 'L3', 'L4'].includes(maxAutonomy)) {
    throw new Error(`INVALID_SCHEMA: agent.maxAutonomyLevel must be one of L0, L1, L2, L3, L4 (received ${maxAutonomy})`);
  }

  const compute = d.compute as Record<string, unknown> | undefined;
  if (!compute || typeof compute !== 'object') {
    throw new Error('INVALID_SCHEMA: compute section is required');
  }
  if (typeof compute.maxTokensPerRun !== 'number' || compute.maxTokensPerRun <= 0 || !Number.isFinite(compute.maxTokensPerRun)) {
    throw new Error('INVALID_SCHEMA: compute.maxTokensPerRun must be a positive integer');
  }
  if (typeof compute.maxComputeUnitsMcu !== 'number' || compute.maxComputeUnitsMcu <= 0 || !Number.isFinite(compute.maxComputeUnitsMcu)) {
    throw new Error('INVALID_SCHEMA: compute.maxComputeUnitsMcu must be a positive integer');
  }

  const permissions = d.permissions as Record<string, unknown> | undefined;
  if (!permissions || typeof permissions !== 'object') {
    throw new Error('INVALID_SCHEMA: permissions section is required');
  }
  if (!Array.isArray(permissions.allow)) {
    throw new Error('INVALID_SCHEMA: permissions.allow must be an array');
  }
  if (!Array.isArray(permissions.deny)) {
    throw new Error('INVALID_SCHEMA: permissions.deny must be an array');
  }

  const escalation = d.escalation as Record<string, unknown> | undefined;
  if (!escalation || typeof escalation !== 'object') {
    throw new Error('INVALID_SCHEMA: escalation section is required');
  }
  if (!['halt', 'request_approval'].includes(escalation.onQuotaExceeded as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onQuotaExceeded must be halt or request_approval');
  }
  if (!['halt', 'escalate_human'].includes(escalation.onDisallowedAction as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onDisallowedAction must be halt or escalate_human');
  }

  return {
    schemaVersion: d.schemaVersion,
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      maxAutonomyLevel: maxAutonomy as AutonomyLevel,
    },
    compute: {
      maxTokensPerRun: compute.maxTokensPerRun,
      maxComputeUnitsMcu: compute.maxComputeUnitsMcu,
    },
    permissions: {
      allow: permissions.allow.map(String),
      deny: permissions.deny.map(String),
    },
    escalation: {
      onQuotaExceeded: escalation.onQuotaExceeded as 'halt' | 'request_approval',
      onDisallowedAction: escalation.onDisallowedAction as 'halt' | 'escalate_human',
    },
  };
}

export function matchPermission(pattern: string, action: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normAction = action.trim().toLowerCase();

  if (normPattern === '*' || normPattern === normAction) {
    return true;
  }

  if (normPattern.endsWith(':*')) {
    const prefix = normPattern.slice(0, -2);
    return normAction.startsWith(prefix + ':') || normAction === prefix;
  }

  return false;
}

export function evaluateAgyPolicy(
  policy: AgentGovernanceYaml,
  request: PolicyEvaluationRequest,
  requiredAutonomyForAction: AutonomyLevel = 'L1'
): PolicyEvaluationVerdict {
  const normAction = request.action.trim().toLowerCase();

  // 1. Check Explicit Deny Rules First (Deny always takes precedence over Allow)
  for (const denyPattern of policy.permissions.deny) {
    if (matchPermission(denyPattern, normAction)) {
      const evaluationSha256 = generatePolicyEvaluationDigest(request, false, 'ACTION_EXPLICITLY_DENIED');
      return {
        allowed: false,
        reason: 'ACTION_EXPLICITLY_DENIED',
        requiredAutonomy: requiredAutonomyForAction,
        escalationTriggered: policy.escalation.onDisallowedAction === 'escalate_human',
        evaluationSha256,
      };
    }
  }

  // 2. Check Allow Rules
  let isAllowed = false;
  for (const allowPattern of policy.permissions.allow) {
    if (matchPermission(allowPattern, normAction)) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    const evaluationSha256 = generatePolicyEvaluationDigest(request, false, 'ACTION_NOT_PERMITTED');
    return {
      allowed: false,
      reason: 'ACTION_NOT_PERMITTED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: policy.escalation.onDisallowedAction === 'escalate_human',
      evaluationSha256,
    };
  }

  // 3. Autonomy Gate Check (requested autonomy vs agent max autonomy)
  const agentRank = AUTONOMY_RANKS[policy.agent.maxAutonomyLevel] ?? 0;
  const requestedRank = AUTONOMY_RANKS[request.requestedAutonomy] ?? 0;
  const requiredRank = AUTONOMY_RANKS[requiredAutonomyForAction] ?? 0;

  if (requestedRank > agentRank || requiredRank > agentRank) {
    const evaluationSha256 = generatePolicyEvaluationDigest(request, false, 'AUTONOMY_LEVEL_EXCEEDED');
    return {
      allowed: false,
      reason: 'AUTONOMY_LEVEL_EXCEEDED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: true,
      evaluationSha256,
    };
  }

  // 4. Compute Limit Check (single run MCU)
  if (
    request.requestedComputeUnits > policy.compute.maxComputeUnitsMcu ||
    request.requestedComputeUnits <= 0 ||
    !Number.isFinite(request.requestedComputeUnits)
  ) {
    const evaluationSha256 = generatePolicyEvaluationDigest(request, false, 'COMPUTE_LIMIT_EXCEEDED');
    return {
      allowed: false,
      reason: 'COMPUTE_LIMIT_EXCEEDED',
      requiredAutonomy: requiredAutonomyForAction,
      escalationTriggered: policy.escalation.onQuotaExceeded === 'request_approval',
      evaluationSha256,
    };
  }

  // 5. Approved Verdict
  const evaluationSha256 = generatePolicyEvaluationDigest(request, true, 'POLICY_APPROVED');
  return {
    allowed: true,
    reason: 'POLICY_APPROVED',
    requiredAutonomy: requiredAutonomyForAction,
    escalationTriggered: false,
    evaluationSha256,
  };
}

export function generatePolicyEvaluationDigest(
  request: PolicyEvaluationRequest,
  allowed: boolean,
  reason: string
): string {
  const payload = [
    request.agencyId,
    request.agentId,
    request.action.trim().toLowerCase(),
    request.requestedAutonomy,
    request.requestedComputeUnits,
    allowed ? '1' : '0',
    reason,
  ].join(':');

  return createHash('sha256').update(payload).digest('hex');
}

export async function logPolicyEvaluationToLedger(
  db: MockD1Database,
  request: PolicyEvaluationRequest,
  verdict: PolicyEvaluationVerdict
): Promise<string> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO agy_policy_audit_ledger (
        id, agency_id, agent_id, action, requested_autonomy, required_autonomy,
        requested_compute_units, allowed, escalation_triggered, reason, evaluation_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      request.agencyId,
      request.agentId,
      request.action,
      request.requestedAutonomy,
      verdict.requiredAutonomy,
      request.requestedComputeUnits,
      verdict.allowed ? 1 : 0,
      verdict.escalationTriggered ? 1 : 0,
      verdict.reason,
      verdict.evaluationSha256,
      now
    )
    .run();

  return id;
}

// ─── R3: Agency Client Onboarding & Portal Engine ────────────────────────────

export function validateAgencySlug(slug: string): { valid: boolean; normalizedSlug?: string; error?: string } {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'SLUG_REQUIRED: Agency slug is required' };
  }

  const trimmed = slug.trim().toLowerCase();

  if (trimmed.length < 3 || trimmed.length > 63) {
    return { valid: false, error: 'SLUG_INVALID_LENGTH: Must be between 3 and 63 characters' };
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    return { valid: false, error: 'SLUG_INVALID_CHARACTERS: Only lowercase alphanumeric and hyphens allowed' };
  }

  if (RESERVED_PLATFORM_SUBDOMAINS.has(trimmed)) {
    return { valid: false, error: 'SLUG_RESERVED: Cannot use reserved platform subdomain' };
  }

  return { valid: true, normalizedSlug: trimmed };
}

export function sanitizeBrandCssColor(color: string): { valid: boolean; sanitizedColor?: string; error?: string } {
  if (!color || typeof color !== 'string') {
    return { valid: false, error: 'COLOR_REQUIRED' };
  }

  const trimmed = color.trim();

  // Hex color #RGB, #RRGGBB, #RRGGBBAA
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return { valid: true, sanitizedColor: trimmed };
  }

  // Safe rgb/rgba
  if (/^rgba?\(\s*([0-9]{1,3}\s*,\s*){2}[0-9]{1,3}(\s*,\s*(0|1|0?\.[0-9]+))?\s*\)$/.test(trimmed)) {
    return { valid: true, sanitizedColor: trimmed };
  }

  return { valid: false, error: 'INVALID_OR_POTENTIALLY_MALICIOUS_CSS_COLOR' };
}

export async function executeAgencyOnboarding(
  db: MockD1Database,
  input: AgencyOnboardingInput
): Promise<{ success: boolean; agencyId: string; orgId: string; slug: string }> {
  const slugValidation = validateAgencySlug(input.agencySlug);
  if (!slugValidation.valid || !slugValidation.normalizedSlug) {
    throw new Error(slugValidation.error ?? 'INVALID_SLUG');
  }

  const slug = slugValidation.normalizedSlug;
  const agencyId = `agy_${slug}`;
  const orgId = `org_${slug}`;
  const now = Date.now();

  const primaryColor = input.primaryColor ? sanitizeBrandCssColor(input.primaryColor).sanitizedColor ?? '#3B82F6' : '#3B82F6';

  // 1. Insert Tenant Config
  await db
    .prepare(
      `INSERT INTO agy_tenant_configs (
        id, agency_id, org_id, agency_slug, custom_domain, primary_color, logo_url,
        quota_limit_mcu, quota_used_mcu, rate_limit_rps, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `cfg_${agencyId}`,
      agencyId,
      orgId,
      slug,
      input.customDomain ?? null,
      primaryColor,
      input.logoUrl ?? null,
      100000, // 100K starter MCU
      0,
      60,
      'active',
      now,
      now
    )
    .run();

  // 2. Insert Domain Mapping
  await db
    .prepare(
      `INSERT INTO agy_agency_domains (id, agency_id, domain_name, domain_type, ssl_status, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `dom_sub_${agencyId}`,
      agencyId,
      `${slug}.agencyos.network`,
      'subdomain',
      'active',
      now,
      now
    )
    .run();

  if (input.customDomain) {
    await db
      .prepare(
        `INSERT INTO agy_agency_domains (id, agency_id, domain_name, domain_type, ssl_status, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `dom_cust_${agencyId}`,
        agencyId,
        input.customDomain.toLowerCase().trim(),
        'custom',
        'active',
        now,
        now
      )
      .run();
  }

  // 3. Deploy Seed Agents
  for (const agent of input.seedAgents) {
    await db
      .prepare(
        `INSERT INTO agy_seed_agents (id, agency_id, agent_name, role, template, max_autonomy, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `agent_${agencyId}_${agent.role}`,
        agencyId,
        agent.role.replace(/_/g, ' ').toUpperCase(),
        agent.role,
        agent.template,
        agent.maxAutonomy,
        'active',
        now
      )
      .run();
  }

  return { success: true, agencyId, orgId, slug };
}

export async function fetchAgencyPortalOverview(
  db: MockD1Database,
  agencyId: string
): Promise<AgencyPortalOverview> {
  const config = await db
    .prepare('SELECT agency_slug, quota_used_mcu FROM agy_tenant_configs WHERE agency_id = ?')
    .bind(agencyId)
    .first<{ agency_slug: string; quota_used_mcu: number }>();

  if (!config) {
    throw new Error(`AGENCY_NOT_FOUND: ${agencyId}`);
  }

  const subaccountsCount = await db
    .prepare('SELECT COUNT(*) as count FROM agy_subaccounts WHERE agency_id = ?')
    .bind(agencyId)
    .first<{ count: number }>();

  const seedAgentsCount = await db
    .prepare('SELECT COUNT(*) as count FROM agy_seed_agents WHERE agency_id = ?')
    .bind(agencyId)
    .first<{ count: number }>();

  const attributionSum = await db
    .prepare('SELECT SUM(amount_cents) as total_cents FROM agy_attribution_ledger WHERE agency_id = ?')
    .bind(agencyId)
    .first<{ total_cents: number | null }>();

  const totalCents = attributionSum?.total_cents ?? 0;
  const estimatedMrrUsd = Math.round(totalCents / 100);

  return {
    agencyId,
    agencyName: config.agency_slug.toUpperCase() + ' Agency',
    totalClients: subaccountsCount?.count ?? 0,
    activeCampaigns: seedAgentsCount?.count ?? 0,
    totalMcuConsumed: config.quota_used_mcu,
    estimatedMrrUsd,
  };
}

export async function recordAgencySubaccountRevenue(
  db: MockD1Database,
  agencyId: string,
  subaccountId: string,
  amountCents: number,
  mcuConsumed: number,
  attributionType = 'client_usage'
): Promise<string> {
  const id = `attr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO agy_attribution_ledger (id, agency_id, subaccount_id, amount_cents, attribution_type, mcu_consumed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, agencyId, subaccountId, amountCents, attributionType, mcuConsumed, now)
    .run();

  await db
    .prepare('UPDATE agy_subaccounts SET mcu_used = mcu_used + ? WHERE id = ? AND agency_id = ?')
    .bind(mcuConsumed, subaccountId, agencyId)
    .run();

  await db
    .prepare('UPDATE agy_tenant_configs SET quota_used_mcu = quota_used_mcu + ?, updated_at = ? WHERE agency_id = ?')
    .bind(mcuConsumed, now, agencyId)
    .run();

  return id;
}
