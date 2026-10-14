/**
 * Creator DAO Licensing Contracts
 * Layer: seed
 */

import type {
  AiTrainingPermission,
  CommercialRights,
  ContractorTaxRegime,
  ContractStatus,
  ContractType,
  SettlementPayoutRail,
  SplitTier,
} from './constants';

export interface CreatorLicensingContract {
  id: string;
  contractNumber: string;
  creatorId: string;
  daoId: string | null;
  contractTitle: string;
  contractType: ContractType;
  splitTier: SplitTier;
  creatorSharePct: number;
  platformSharePct: number;
  daoTreasurySharePct: number;
  revenueSharePercentage?: number;
  platformSharePercentage?: number;
  commercialRights: CommercialRights;
  aiTrainingPermission: AiTrainingPermission;
  minimumPayoutCents: number;
  preferredPayoutRail: SettlementPayoutRail;
  contractorTaxRegime: ContractorTaxRegime;
  taxWithholdingRatePct: number;
  taxIdNumber: string | null;
  status: ContractStatus;
  termsCanonicalJson: string;
  contractHash: string;
  creatorSignature: string;
  startsAt: number;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateLicensingContractInput {
  creatorId: string;
  daoId?: string | null;
  contractTitle: string;
  contractType: ContractType;
  splitTier: SplitTier;
  creatorSharePct?: number;
  platformSharePct?: number;
  daoTreasurySharePct?: number;
  commercialRights?: CommercialRights;
  aiTrainingPermission?: AiTrainingPermission;
  minimumPayoutCents?: number;
  preferredPayoutRail?: SettlementPayoutRail;
  contractorTaxRegime?: ContractorTaxRegime;
  taxWithholdingRatePct?: number;
  taxIdNumber?: string | null;
  startsAt?: number;
  expiresAt?: number | null;
  secretKey?: string;
}
