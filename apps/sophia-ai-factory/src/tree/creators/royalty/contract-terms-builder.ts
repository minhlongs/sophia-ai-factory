/**
 * Creator Licensing Contract Terms Resolution & Canonical Signing Helper.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/contract-terms-builder
 */

import {
  DAO_80_20_CREATOR_PCT,
  DAO_80_20_PLATFORM_PCT,
  STANDARD_70_30_CREATOR_PCT,
  STANDARD_70_30_PLATFORM_PCT,
  STATUTORY_TAX_RATES,
  type CreateLicensingContractInput,
} from '@/seed/types/creator-dao-c2pa';
import {
  canonicalJson,
  hmacSha256Hex,
  sha256Hex,
} from '@/tree/creators/c2pa-provenance-signer';
import { DEFAULT_CONTRACT_SECRET } from './constants';

export async function buildSignedContractTerms(input: CreateLicensingContractInput) {
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

  return {
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
  };
}
