/**
 * Creator Licensing Contract Row Mapper & Queries.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/contract-row-mapper
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ContractStatus,
  ContractType,
  ContractorTaxRegime,
  CreatorLicensingContract,
  SettlementPayoutRail,
  SplitTier,
} from '@/seed/types/creator-dao-c2pa';
import type { ContractDbRow } from './types';

export function mapContractRow(row: ContractDbRow): CreatorLicensingContract {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    creatorId: row.creator_id,
    daoId: row.dao_id,
    contractTitle: row.contract_title,
    contractType: row.contract_type as ContractType,
    splitTier: row.split_tier as SplitTier,
    creatorSharePct: row.creator_share_pct,
    platformSharePct: row.platform_share_pct,
    daoTreasurySharePct: row.dao_treasury_share_pct,
    revenueSharePercentage: row.creator_share_pct,
    platformSharePercentage: row.platform_share_pct,
    commercialRights:
      row.commercial_rights as CreatorLicensingContract['commercialRights'],
    aiTrainingPermission:
      row.ai_training_permission as CreatorLicensingContract['aiTrainingPermission'],
    minimumPayoutCents: row.minimum_payout_cents,
    preferredPayoutRail: row.preferred_payout_rail as SettlementPayoutRail,
    contractorTaxRegime: row.contractor_tax_regime as ContractorTaxRegime,
    taxWithholdingRatePct: row.tax_withholding_rate_pct,
    taxIdNumber: row.tax_id_number,
    status: row.status as ContractStatus,
    termsCanonicalJson: row.terms_canonical_json,
    contractHash: row.contract_hash,
    creatorSignature: row.creator_signature,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCreatorContracts(
  db: D1Database,
  creatorId: string,
): Promise<CreatorLicensingContract[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM creator_licensing_contracts WHERE creator_id = ? ORDER BY created_at DESC',
    )
    .bind(creatorId)
    .all<ContractDbRow>();

  return (results ?? []).map(mapContractRow);
}

export async function getContractById(
  db: D1Database,
  contractId: string,
): Promise<CreatorLicensingContract | null> {
  const row = await db
    .prepare(
      'SELECT * FROM creator_licensing_contracts WHERE id = ? LIMIT 1',
    )
    .bind(contractId)
    .first<ContractDbRow>();

  if (!row) return null;
  return mapContractRow(row);
}
