/**
 * Cryptographic Audit Vault Explorer Types
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/types
 */

import type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditFilterOptions,
} from '@/seed/types/enterprise-audit';
import type { Result } from '@/seed/types/result';

export interface AuditVaultExplorerActions {
  queryEvents?: (
    filters: AuditFilterOptions
  ) => Promise<
    Result<
      { events: EnterpriseAuditEvent[]; total: number },
      { code: string; message: string }
    >
  >;
  verifyChain?: (
    orgId?: string
  ) => Promise<
    Result<ChainVerificationResult, { code: string; message: string }>
  >;
}

export interface AuditVaultExplorerProps {
  orgId?: string;
  initialEvents: EnterpriseAuditEvent[];
  initialTotal: number;
  initialVerification?: ChainVerificationResult | null;
  actions?: AuditVaultExplorerActions;
}

export type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditFilterOptions,
};
