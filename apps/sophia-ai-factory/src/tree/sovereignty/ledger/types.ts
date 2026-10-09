/**
 * @file types.ts
 * @description Type definitions for sovereign compliance ledger and hash-chain audit vault.
 * @layer tree
 */

import type {
  ComplianceAuditLog,
  RegulatoryFramework,
  PolicyVerdict,
  ActorType,
  ChainVerificationResult,
} from '@/seed/types/sovereign-vault';

export type {
  ComplianceAuditLog,
  RegulatoryFramework,
  PolicyVerdict,
  ActorType,
  ChainVerificationResult,
};

export interface AppendAuditInput {
  orgId?: string | null;
  zoneId: string;
  actorId: string;
  actorType: ActorType;
  actorIpHash: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  jurisdictionCompliance: RegulatoryFramework | 'GLOBAL';
  policyVerdict: PolicyVerdict;
  payload?: Record<string, unknown>;
  timestamp?: number;
  signingKeySecret?: string;
}

export interface AuditQueryFilters {
  orgId?: string | null;
  zoneId?: string;
  actorId?: string;
  action?: string;
  policyVerdict?: PolicyVerdict;
  jurisdictionCompliance?: RegulatoryFramework | 'GLOBAL';
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

export interface RowVerificationResult {
  isValid: boolean;
  error?: string;
  recomputedHash?: string;
}
