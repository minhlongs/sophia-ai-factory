import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  CreateEnterpriseDealInput,
  UpdateEnterpriseDealInput,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  CreateEnterpriseDealInput,
  UpdateEnterpriseDealInput,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
};
