/**
 * Creator Licensing Contract Generation Service.
 *
 * Creates, canonically hashes, signs, and registers a digital licensing contract.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/contract-service
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreateLicensingContractInput,
  CreatorLicensingContract,
} from '@/seed/types/creator-dao-c2pa';
import { buildSignedContractTerms } from './contract-terms-builder';

export * from './contract-row-mapper';

/**
 * Creates, canonically hashes, signs, and registers a digital licensing contract.
 */
export async function createLicensingContract(
  db: D1Database,
  input: CreateLicensingContractInput,
): Promise<CreatorLicensingContract> {
  const {
    id,
    now,
    startsAt,
    contractNumber,
    creatorSharePct,
    platformSharePct,
    daoTreasurySharePct,
    taxRegime,
    taxWithholdingRatePct,
    commercialRights,
    aiTrainingPermission,
    minimumPayoutCents,
    preferredPayoutRail,
    termsCanonicalJson,
    contractHash,
    creatorSignature,
  } = await buildSignedContractTerms(input);

  await db
    .prepare(
      `INSERT INTO creator_licensing_contracts (
        id, contract_number, creator_id, dao_id, contract_title, contract_type, split_tier,
        creator_share_pct, platform_share_pct, dao_treasury_share_pct, commercial_rights,
        ai_training_permission, minimum_payout_cents, preferred_payout_rail, contractor_tax_regime,
        tax_withholding_rate_pct, tax_id_number, status, terms_canonical_json, contract_hash,
        creator_signature, starts_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      contractNumber,
      input.creatorId,
      input.daoId ?? null,
      input.contractTitle,
      input.contractType,
      input.splitTier,
      creatorSharePct,
      platformSharePct,
      daoTreasurySharePct,
      commercialRights,
      aiTrainingPermission,
      minimumPayoutCents,
      preferredPayoutRail,
      taxRegime,
      taxWithholdingRatePct,
      input.taxIdNumber ?? null,
      termsCanonicalJson,
      contractHash,
      creatorSignature,
      startsAt,
      input.expiresAt ?? null,
      now,
      now,
    )
    .run();

  logger.info('Created digital licensing contract', {
    contractNumber,
    creatorId: input.creatorId,
    splitTier: input.splitTier,
    creatorSharePct,
  });

  return {
    id,
    contractNumber,
    creatorId: input.creatorId,
    daoId: input.daoId ?? null,
    contractTitle: input.contractTitle,
    contractType: input.contractType,
    splitTier: input.splitTier,
    creatorSharePct,
    platformSharePct,
    daoTreasurySharePct,
    revenueSharePercentage: creatorSharePct,
    platformSharePercentage: platformSharePct,
    commercialRights,
    aiTrainingPermission,
    minimumPayoutCents,
    preferredPayoutRail,
    contractorTaxRegime: taxRegime,
    taxWithholdingRatePct,
    taxIdNumber: input.taxIdNumber ?? null,
    status: 'active',
    termsCanonicalJson,
    contractHash,
    creatorSignature,
    startsAt,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
