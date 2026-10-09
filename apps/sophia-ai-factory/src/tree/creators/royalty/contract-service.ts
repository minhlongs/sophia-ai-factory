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
import {
  DAO_80_20_CREATOR_PCT,
  DAO_80_20_PLATFORM_PCT,
  STANDARD_70_30_CREATOR_PCT,
  STANDARD_70_30_PLATFORM_PCT,
  STATUTORY_TAX_RATES,
  type CreateLicensingContractInput,
  type CreatorLicensingContract,
} from '@/seed/types/creator-dao-c2pa';
import {
  canonicalJson,
  hmacSha256Hex,
  sha256Hex,
} from '@/tree/creators/c2pa-provenance-signer';
import { DEFAULT_CONTRACT_SECRET } from './constants';

export * from './contract-row-mapper';

/**
 * Creates, canonically hashes, signs, and registers a digital licensing contract.
 */
export async function createLicensingContract(
  db: D1Database,
  input: CreateLicensingContractInput,
): Promise<CreatorLicensingContract> {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);

  const now = Date.now();
  const startsAt = input.startsAt ?? now;
  const contractNumber = `CLC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  let creatorSharePct = input.creatorSharePct;
  let platformSharePct = input.platformSharePct;
  const daoTreasurySharePct = input.daoTreasurySharePct ?? 0.0;

  if (input.splitTier === 'DAO_80_20') {
    creatorSharePct = creatorSharePct ?? DAO_80_20_CREATOR_PCT;
    platformSharePct =
      platformSharePct ??
      Math.max(0, DAO_80_20_PLATFORM_PCT - daoTreasurySharePct);
  } else if (input.splitTier === 'STANDARD_70_30') {
    creatorSharePct = creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    platformSharePct =
      platformSharePct ??
      Math.max(0, STANDARD_70_30_PLATFORM_PCT - daoTreasurySharePct);
  } else {
    creatorSharePct = creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    platformSharePct =
      platformSharePct ??
      Math.max(0, 100.0 - creatorSharePct - daoTreasurySharePct);
  }

  const taxRegime = input.contractorTaxRegime ?? 'EXEMPT_NONE';
  const taxWithholdingRatePct =
    input.taxWithholdingRatePct ?? (STATUTORY_TAX_RATES[taxRegime] ?? 0.0);
  const commercialRights = input.commercialRights ?? 'non_exclusive';
  const aiTrainingPermission = input.aiTrainingPermission ?? 'prohibited';
  const minimumPayoutCents = input.minimumPayoutCents ?? 5000;
  const preferredPayoutRail =
    input.preferredPayoutRail ?? 'NOWPAYMENTS_USDC_ARBITRUM';

  const termsObj = {
    contractNumber,
    creatorId: input.creatorId,
    daoId: input.daoId ?? null,
    contractTitle: input.contractTitle,
    contractType: input.contractType,
    splitTier: input.splitTier,
    creatorSharePct,
    platformSharePct,
    daoTreasurySharePct,
    commercialRights,
    aiTrainingPermission,
    minimumPayoutCents,
    preferredPayoutRail,
    contractorTaxRegime: taxRegime,
    taxWithholdingRatePct,
    startsAt,
    expiresAt: input.expiresAt ?? null,
  };

  const termsCanonicalJson = canonicalJson(termsObj);
  const contractHash = await sha256Hex(termsCanonicalJson);
  const secret = input.secretKey ?? DEFAULT_CONTRACT_SECRET;
  const creatorSignature = await hmacSha256Hex(contractHash, secret);

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
