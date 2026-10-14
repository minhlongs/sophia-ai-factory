/**
 * @file sox-prospectus-types.ts
 * @description SOX 404 evaluation, attestation certificate, and S-1 prospectus document interfaces.
 * @layer seed
 */

import type {
  ConsolidationEntityCode,
  ControlEvaluationStatus,
  FilingStatus,
  FilingType,
  Sox404Status,
  SoxControlCategory,
} from './constants-enums';
import type {
  EntityFinancialInput,
  GaapFinancialsInput,
  MultiEntityConsolidationResult,
  NonGaapReconciliationResult,
} from './service-types';

export interface JournalAdjustmentInput {
  id?: string;
  periodKey: string;
  accountCode: string;
  entityCode: ConsolidationEntityCode;
  debitCents: number;
  creditCents: number;
  requestedBy: string;
  approvedBy?: string;
  reason: string;
  isAuthorized: boolean;
  authorizationToken?: string;
}

export interface SoxValidationResult {
  isAllowed: boolean;
  quarantined: boolean;
  violatedControlIds: string[];
  reason: string;
  auditEvidenceHash: string;
}

export interface SoxControlEvaluation {
  controlId: string;
  controlName: string;
  category: SoxControlCategory;
  status: ControlEvaluationStatus;
  isEffective: boolean;
  testedAt: number;
  testedBy: string;
  evidenceHash: string;
  findings: string[];
  unauthorizedAttemptsDetected: number;
  quarantinedEntriesCount: number;
}

export interface SoxEvaluationSummary {
  overallStatus: Sox404Status;
  totalControlsTested: number;
  effectiveControlsCount: number;
  deficienciesCount: number;
  evaluations: SoxControlEvaluation[];
  merkleRootHash: string;
  certifiedAt: number;
}

export interface SoxAttestationCertificate {
  certificateId: string;
  periodKey: string;
  soxStatus: Sox404Status;
  certifierId: string;
  certifierRole: string;
  signedAt: number;
  merkleRootHash: string;
  digitalSignature: string;
  statementEn: string;
  statementVi: string;
}

export interface S1ProspectusDocument {
  filingId: string;
  periodKey: string;
  filingType: FilingType;
  targetExchanges: string[];
  status: FilingStatus;
  scaleMetrics: {
    totalCustomers: number;
    mrrCents: number;
    arrCents: number;
    arpuCents: number;
    nrrPct: number;
    grossMarginPct: number;
  };
  gaapFinancials: GaapFinancialsInput;
  nonGaapFinancials: NonGaapReconciliationResult;
  consolidationSummary: MultiEntityConsolidationResult;
  sox404Evaluation: SoxEvaluationSummary;
  merkleRootHash: string;
  secFilingSignature: string;
  generatedAt: number;
}

export interface CreateIpoPeriodInput {
  periodKey: string;
  filingType: FilingType;
  targetExchanges?: string[];
  totalCustomers: number;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  nrrPct: number;
  gaapFinancials: GaapFinancialsInput;
  prospectusMetadata?: Record<string, unknown>;
}

export interface ConsolidateCtaInput {
  periodKey: string;
  entities: EntityFinancialInput[];
  notes?: string;
}
