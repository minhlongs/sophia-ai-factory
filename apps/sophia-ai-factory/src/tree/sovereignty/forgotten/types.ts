import type {
  ErasureCertificate,
  ErasureRequestInput,
  ErasureExecutionResult,
  LegalHoldStatus,
  RegulatoryFramework,
  ErasureMethod,
} from '@/seed/types/sovereign-vault';

export type {
  ErasureCertificate,
  ErasureRequestInput,
  ErasureExecutionResult,
  LegalHoldStatus,
  RegulatoryFramework,
  ErasureMethod,
};

export const DEFAULT_SIGNING_KEY_ID = 'sov_compliance_sec_v1';

export interface ExecuteRtbfOptions {
  signingKeySecret?: string;
  actorId?: string;
}

export interface VerifyCertificateResult {
  isValid: boolean;
  error?: string;
}
