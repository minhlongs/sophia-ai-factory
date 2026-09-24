/**
 * Cryptographic Hash-Chain Audit Vault Types & Contracts
 *
 * Implements immutable audit event structures conforming to SOC 2 CC7.2 standards.
 * Every event is linked via SHA-256 hash chaining:
 * content_hash = sha256(prev_hash + timestamp + action + actor + payload)
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 *
 * @module seed/types/enterprise-audit
 */

export interface EnterpriseAuditEvent {
  id: string;
  orgId: string | null;
  actorId: string;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload: Record<string, unknown>;
  prevHash: string | null;
  contentHash: string;
  timestamp: number; // Unix epoch in seconds
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: number;
}

export interface EnterpriseAuditRow {
  id: string;
  org_id: string | null;
  actor_id: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  payload: string; // JSON string
  prev_hash: string | null;
  content_hash: string;
  timestamp: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  tamperedIndex?: number;
  tamperedEventId?: string;
  reason?: string;
  verifiedAt: string; // ISO 8601 timestamp
  genesisHash?: string | null;
  latestHash?: string | null;
}

export interface AuditFilterOptions {
  orgId?: string;
  action?: string;
  actorId?: string;
  actorEmail?: string;
  resourceType?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export interface RecordEnterpriseAuditInput {
  orgId?: string | null;
  actorId: string;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: number;
}

/**
 * Standard enterprise audit actions for canonical categorization
 */
export const AUDIT_ACTIONS = {
  VIDEO_PUBLISHED: 'video.published',
  VIDEO_APPROVED: 'video.approved',
  VIDEO_REJECTED: 'video.rejected',
  MCU_ALLOCATED: 'mcu.allocated',
  APIKEY_CREATED: 'apikey.created',
  APIKEY_REVOKED: 'apikey.revoked',
  PAYOUT_APPROVED: 'payout.approved',
  RBAC_ROLE_CHANGED: 'rbac.role_changed',
  SSO_CONFIGURED: 'sso.configured',
  SSO_DELETED: 'sso.deleted',
  CUSTOM_DOMAIN_REGISTERED: 'custom_domain.registered',
  CUSTOM_DOMAIN_VERIFIED: 'custom_domain.verified',
  BRANDING_UPDATED: 'branding.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | (string & {});
