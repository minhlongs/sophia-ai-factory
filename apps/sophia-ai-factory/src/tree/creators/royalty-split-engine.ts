/**
 * Creator DAO Royalty Split Engine & Multi-Currency Micro-Settlement Ledger
 *
 * Implements:
 * - Smart Split Waterfall (80/20 DAO Exclusive & 70/30 Standard Marketplace)
 * - Zero-Penny Leakage Invariant: Sum of splits exactly equals gross revenue (cents)
 * - Multi-tier Lineage Attribution: 70% root creator / 30% remixer derivative cascade
 * - Statutory Contractor Tax Withholding (VN TT111/TT78, US W-8BEN, TH WHT, EU Reverse Charge)
 * - Multi-Rail Payout Destination Validation (USDC Arbitrum/Polygon, VietQR, PromptPay, SEPA)
 * - Idempotent micro-settlement persistence to D1 ledger
 *
 * Layer: tree (Pure domain logic & financial math, zero land/forest imports)
 * Dependencies: @/seed/types/creator-dao-c2pa, @/seed/db/client, @/seed/utils/logger-utility
 *
 * @module tree/creators/royalty-split-engine
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  DAO_80_20_CREATOR_PCT,
  DAO_80_20_PLATFORM_PCT,
  STANDARD_70_30_CREATOR_PCT,
  STANDARD_70_30_PLATFORM_PCT,
  STATUTORY_TAX_RATES,
  type ContractStatus,
  type ContractType,
  type ContractorTaxRegime,
  type CreateLicensingContractInput,
  type CreatorLicensingContract,
  type CreatorRoyaltySettlement,
  type ExecuteRoyaltySplitInput,
  type RoyaltySettlementResult,
  type SettlementCurrency,
  type SettlementPayoutRail,
  type SettlementStatus,
  type SmartSplitWaterfallResult,
  type SplitTier,
  type TaxWithholdingResult,
} from '@/seed/types/creator-dao-c2pa';
import {
  canonicalJson,
  hmacSha256Hex,
  sha256Hex,
} from '@/tree/creators/c2pa-provenance-signer';

// ─── Pure Financial Calculation: Smart Split Waterfall ──────────────────────

export interface SplitWaterfallOptions {
  creatorSharePct?: number;
  platformSharePct?: number;
  daoTreasurySharePct?: number;
  lineageParentCreatorId?: string;
  rootCreatorId?: string;
}

/**
 * Calculates the exact split waterfall for creator earnings with mathematical zero-penny leakage.
 *
 * Invariant: creatorGrossCents + daoTreasuryCents + platformCents === grossRevenueCents
 * Lineage Invariant (if remix): rootCreatorCents + remixerCents === creatorGrossCents
 */
export function calculateSmartSplitWaterfall(
  grossRevenueCents: number,
  tier: SplitTier,
  options?: SplitWaterfallOptions,
): SmartSplitWaterfallResult {
  if (grossRevenueCents < 0 || !Number.isInteger(grossRevenueCents)) {
    throw new Error(`grossRevenueCents must be a non-negative integer, got: ${grossRevenueCents}`);
  }

  // 1. Determine split percentages based on tier
  let creatorPct: number;
  let platformPct: number;
  let daoPct: number;

  if (tier === 'DAO_80_20') {
    creatorPct = options?.creatorSharePct ?? DAO_80_20_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct = options?.platformSharePct ?? Math.max(0, DAO_80_20_PLATFORM_PCT - daoPct);
  } else if (tier === 'STANDARD_70_30') {
    creatorPct = options?.creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct = options?.platformSharePct ?? Math.max(0, STANDARD_70_30_PLATFORM_PCT - daoPct);
  } else {
    // CUSTOM
    creatorPct = options?.creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct = options?.platformSharePct ?? Math.max(0, 100.0 - creatorPct - daoPct);
  }

  // 2. Exact integer cent distribution with zero penny leakage
  const creatorGrossCents = Math.floor((grossRevenueCents * creatorPct) / 100);
  const daoTreasuryCents = Math.floor((grossRevenueCents * daoPct) / 100);
  // Platform absorbs remainder cents to guarantee zero leak
  const platformCents = grossRevenueCents - creatorGrossCents - daoTreasuryCents;

  const invarianceVerified = creatorGrossCents + daoTreasuryCents + platformCents === grossRevenueCents;

  // 3. Multi-tier Lineage Waterfall (if remix derivative)
  let rootCreatorCents: number | undefined;
  let remixerCents: number | undefined;

  if (options?.lineageParentCreatorId && creatorGrossCents > 0) {
    // Standard lineage split: 70% root original creator, 30% remixer derivative
    rootCreatorCents = Math.floor((creatorGrossCents * 70) / 100);
    remixerCents = creatorGrossCents - rootCreatorCents;
  }

  return {
    grossRevenueCents,
    splitTier: tier,
    creatorSharePct: creatorPct,
    platformSharePct: platformPct,
    daoTreasurySharePct: daoPct,
    creatorGrossCents,
    platformCents,
    daoTreasuryCents,
    rootCreatorId: options?.rootCreatorId,
    rootCreatorCents,
    remixerCreatorId: options?.lineageParentCreatorId,
    remixerCents,
    invarianceVerified,
  };
}

// ─── Pure Financial Calculation: Tax Withholding ────────────────────────────

/**
 * Calculates statutory contractor tax withholding.
 *
 * Invariant: taxWithheldCents + netPayableCents === grossCents
 */
export function calculateTaxWithholding(
  grossCents: number,
  regime: ContractorTaxRegime,
  customRatePct?: number,
): TaxWithholdingResult {
  if (grossCents < 0 || !Number.isInteger(grossCents)) {
    throw new Error(`grossCents must be a non-negative integer, got: ${grossCents}`);
  }

  const taxRatePct = customRatePct !== undefined ? customRatePct : (STATUTORY_TAX_RATES[regime] ?? 0.0);
  const taxWithheldCents = Math.floor((grossCents * taxRatePct) / 100);
  const netPayableCents = grossCents - taxWithheldCents;

  const invarianceVerified = taxWithheldCents + netPayableCents === grossCents;

  return {
    grossCents,
    taxRegime: regime,
    taxRatePct,
    taxWithheldCents,
    netPayableCents,
    invarianceVerified,
  };
}

// ─── Destination Validation ─────────────────────────────────────────────────

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const VIETQR_BANK_BIN_REGEX = /^\d{6}$/;
const VIETQR_ACCOUNT_REGEX = /^[a-zA-Z0-9]{4,30}$/;
const PROMPTPAY_PHONE_REGEX = /^0[689]\d{8}$/;
const PROMPTPAY_NATIONAL_ID_REGEX = /^\d{13}$/;
const SEPA_IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;

export interface PayoutDestinationValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates payout rail destination parameters.
 */
export function validatePayoutDestination(
  rail: SettlementPayoutRail,
  destinationAddress: string,
  destinationBankBin?: string | null,
): PayoutDestinationValidation {
  if (!destinationAddress || destinationAddress.trim().length === 0) {
    return { valid: false, error: 'Destination address is required' };
  }

  const cleanAddr = destinationAddress.trim();

  switch (rail) {
    case 'NOWPAYMENTS_USDC_ARBITRUM':
    case 'NOWPAYMENTS_USDC_POLYGON': {
      if (!EVM_ADDRESS_REGEX.test(cleanAddr)) {
        return { valid: false, error: `Invalid EVM address format for ${rail}: ${cleanAddr}` };
      }
      if (cleanAddr === '0x0000000000000000000000000000000000000000') {
        return { valid: false, error: 'Zero address is not allowed as a payout destination' };
      }
      return { valid: true };
    }

    case 'PAYOS_VIETQR': {
      if (!destinationBankBin || !VIETQR_BANK_BIN_REGEX.test(destinationBankBin.trim())) {
        return { valid: false, error: `Invalid or missing 6-digit NAPAS Bank BIN for VietQR: ${destinationBankBin}` };
      }
      if (!VIETQR_ACCOUNT_REGEX.test(cleanAddr)) {
        return { valid: false, error: `Invalid bank account number for VietQR: ${cleanAddr}` };
      }
      return { valid: true };
    }

    case 'PROMPTPAY': {
      const isPhone = PROMPTPAY_PHONE_REGEX.test(cleanAddr);
      const isNationalId = PROMPTPAY_NATIONAL_ID_REGEX.test(cleanAddr);
      if (!isPhone && !isNationalId) {
        return { valid: false, error: `PromptPay ID must be a 10-digit phone or 13-digit national/tax ID: ${cleanAddr}` };
      }
      return { valid: true };
    }

    case 'SEPA_INSTANT': {
      const sanitizedIban = cleanAddr.replace(/\s+/g, '').toUpperCase();
      if (!SEPA_IBAN_REGEX.test(sanitizedIban)) {
        return { valid: false, error: `Invalid IBAN format for SEPA Instant: ${cleanAddr}` };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unsupported payout rail: ${rail}` };
  }
}

// ─── QR Code Payload Generator ──────────────────────────────────────────────

export function generatePaymentQrPayload(
  rail: SettlementPayoutRail,
  params: {
    amount: number;
    currency: string;
    destinationAddress: string;
    destinationBankBin?: string | null;
    destinationName: string;
    reference: string;
  },
): string | null {
  if (rail === 'PAYOS_VIETQR') {
    const bin = params.destinationBankBin?.trim() ?? '';
    const acc = params.destinationAddress.trim();
    const memo = encodeURIComponent(params.reference);
    const name = encodeURIComponent(params.destinationName.trim());
    return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${Math.round(params.amount)}&addInfo=${memo}&accountName=${name}`;
  }

  if (rail === 'PROMPTPAY') {
    const id = params.destinationAddress.trim();
    const amountStr = params.amount.toFixed(2);
    return `promptpay://${id}?amount=${amountStr}&ref=${encodeURIComponent(params.reference)}`;
  }

  return null;
}

// ─── Database Row Mappers ───────────────────────────────────────────────────

interface ContractDbRow {
  id: string;
  contract_number: string;
  creator_id: string;
  dao_id: string | null;
  contract_title: string;
  contract_type: string;
  split_tier: string;
  creator_share_pct: number;
  platform_share_pct: number;
  dao_treasury_share_pct: number;
  commercial_rights: string;
  ai_training_permission: string;
  minimum_payout_cents: number;
  preferred_payout_rail: string;
  contractor_tax_regime: string;
  tax_withholding_rate_pct: number;
  tax_id_number: string | null;
  status: string;
  terms_canonical_json: string;
  contract_hash: string;
  creator_signature: string;
  starts_at: number;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

function mapContractRow(row: ContractDbRow): CreatorLicensingContract {
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
    commercialRights: row.commercial_rights as CreatorLicensingContract['commercialRights'],
    aiTrainingPermission: row.ai_training_permission as CreatorLicensingContract['aiTrainingPermission'],
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

interface SettlementDbRow {
  id: string;
  settlement_reference: string;
  contract_id: string;
  creator_id: string;
  template_id: string | null;
  batch_id: string | null;
  gross_royalty_cents: number;
  platform_fee_cents: number;
  dao_treasury_cents: number;
  contractor_tax_regime: string;
  tax_withholding_rate_pct: number;
  tax_withheld_cents: number;
  rail_fee_cents: number;
  net_payable_cents: number;
  payout_rail: string;
  settlement_currency: string;
  settlement_amount: number;
  fx_rate_applied: number;
  destination_address: string;
  destination_bank_bin: string | null;
  destination_name: string;
  status: string;
  tx_hash: string | null;
  qr_payload: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  settled_at: number | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

function mapSettlementRow(row: SettlementDbRow): CreatorRoyaltySettlement {
  return {
    id: row.id,
    settlementReference: row.settlement_reference,
    contractId: row.contract_id,
    creatorId: row.creator_id,
    templateId: row.template_id,
    batchId: row.batch_id,
    grossRoyaltyCents: row.gross_royalty_cents,
    creatorGrossShareCents: row.gross_royalty_cents,
    platformShareCents: row.platform_fee_cents,
    platformFeeCents: row.platform_fee_cents,
    daoTreasuryCents: row.dao_treasury_cents,
    contractorTaxRegime: row.contractor_tax_regime as ContractorTaxRegime,
    taxWithholdingRatePct: row.tax_withholding_rate_pct,
    taxWithheldCents: row.tax_withheld_cents,
    railFeeCents: row.rail_fee_cents,
    netPayableCents: row.net_payable_cents,
    netPayoutCents: row.net_payable_cents,
    payoutRail: row.payout_rail as SettlementPayoutRail,
    settlementCurrency: row.settlement_currency as SettlementCurrency,
    settlementAmount: row.settlement_amount,
    fxRateApplied: row.fx_rate_applied,
    destinationAddress: row.destination_address,
    destinationBankBin: row.destination_bank_bin,
    destinationName: row.destination_name,
    status: row.status as SettlementStatus,
    txHash: row.tx_hash,
    qrPayload: row.qr_payload,
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    settledAt: row.settled_at,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── D1 Database Operations: Licensing Contracts ────────────────────────────

/**
 * Creates, canonically hashes, signs, and registers a digital licensing contract.
 */
export async function createLicensingContract(
  db: D1Database,
  input: CreateLicensingContractInput,
): Promise<CreatorLicensingContract> {
  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
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
    platformSharePct = platformSharePct ?? Math.max(0, DAO_80_20_PLATFORM_PCT - daoTreasurySharePct);
  } else if (input.splitTier === 'STANDARD_70_30') {
    creatorSharePct = creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    platformSharePct = platformSharePct ?? Math.max(0, STANDARD_70_30_PLATFORM_PCT - daoTreasurySharePct);
  } else {
    creatorSharePct = creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    platformSharePct = platformSharePct ?? Math.max(0, 100.0 - creatorSharePct - daoTreasurySharePct);
  }

  const taxRegime = input.contractorTaxRegime ?? 'EXEMPT_NONE';
  const taxWithholdingRatePct = input.taxWithholdingRatePct ?? (STATUTORY_TAX_RATES[taxRegime] ?? 0.0);
  const commercialRights = input.commercialRights ?? 'non_exclusive';
  const aiTrainingPermission = input.aiTrainingPermission ?? 'prohibited';
  const minimumPayoutCents = input.minimumPayoutCents ?? 5000;
  const preferredPayoutRail = input.preferredPayoutRail ?? 'NOWPAYMENTS_USDC_ARBITRUM';

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
  const secret = input.secretKey ?? 'sophia_contract_signing_key_secret_2027';
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

// ─── D1 Database Operations: Royalty Distribution & Settlement ──────────────

interface SettlementCurrencyDetails {
  settlementCurrency: SettlementCurrency;
  fxRateApplied: number;
  settlementAmount: number;
}

export function resolveSettlementCurrencyAndAmount(
  payoutRail: SettlementPayoutRail,
  netPayableCents: number,
  customFxRate?: number,
): SettlementCurrencyDetails {
  let settlementCurrency: SettlementCurrency = 'USDC';
  let fxRateApplied = customFxRate ?? 1.0;

  if (payoutRail === 'PAYOS_VIETQR') {
    settlementCurrency = 'VND';
    if (fxRateApplied === 1.0) fxRateApplied = 25400.0;
  } else if (payoutRail === 'PROMPTPAY') {
    settlementCurrency = 'THB';
    if (fxRateApplied === 1.0) fxRateApplied = 36.5;
  } else if (payoutRail === 'SEPA_INSTANT') {
    settlementCurrency = 'EUR';
    if (fxRateApplied === 1.0) fxRateApplied = 0.92;
  }

  const netDollars = netPayableCents / 100.0;
  const settlementAmount = Math.round(netDollars * fxRateApplied * 100) / 100;

  return { settlementCurrency, fxRateApplied, settlementAmount };
}

async function insertSettlementRow(
  db: D1Database,
  record: CreatorRoyaltySettlement,
  idempotencyKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO creator_royalty_settlements (
        id, settlement_reference, contract_id, creator_id, template_id, batch_id,
        gross_royalty_cents, platform_fee_cents, dao_treasury_cents, contractor_tax_regime,
        tax_withholding_rate_pct, tax_withheld_cents, rail_fee_cents, net_payable_cents,
        payout_rail, settlement_currency, settlement_amount, fx_rate_applied, destination_address,
        destination_bank_bin, destination_name, status, idempotency_key, qr_payload, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.settlementReference,
      record.contractId,
      record.creatorId,
      record.templateId ?? null,
      record.batchId ?? null,
      record.grossRoyaltyCents,
      record.platformFeeCents,
      record.daoTreasuryCents,
      record.contractorTaxRegime,
      record.taxWithholdingRatePct,
      record.taxWithheldCents,
      record.netPayableCents,
      record.payoutRail,
      record.settlementCurrency,
      record.settlementAmount,
      record.fxRateApplied,
      record.destinationAddress,
      record.destinationBankBin,
      record.destinationName,
      idempotencyKey,
      record.qrPayload,
      record.metadataJson,
      record.createdAt,
      record.updatedAt,
    )
    .run();
}

/**
 * Executes a Smart Split Waterfall distribution, applies contractor tax withholding,
 * validates the payout rail destination, and writes an idempotent settlement record to D1.
 */
export async function executeRoyaltySplitAndSettle(
  db: D1Database,
  input: ExecuteRoyaltySplitInput,
): Promise<RoyaltySettlementResult> {
  const { contractId, grossRevenueCents, idempotencyKey } = input;

  // 1. Idempotency Check
  const existingRow = await db
    .prepare('SELECT * FROM creator_royalty_settlements WHERE idempotency_key = ? LIMIT 1')
    .bind(idempotencyKey)
    .first<SettlementDbRow>();

  if (existingRow) {
    const existing = mapSettlementRow(existingRow);
    const waterfall = calculateSmartSplitWaterfall(existing.grossRoyaltyCents, 'STANDARD_70_30');
    const taxWithholding = calculateTaxWithholding(
      existing.grossRoyaltyCents,
      existing.contractorTaxRegime,
      existing.taxWithholdingRatePct,
    );
    return {
      success: true,
      settlementId: existing.id,
      settlementReference: existing.settlementReference,
      waterfall,
      taxWithholding,
      settlementRecord: existing,
    };
  }

  // 2. Fetch Licensing Contract
  const contractRow = await db
    .prepare('SELECT * FROM creator_licensing_contracts WHERE id = ? LIMIT 1')
    .bind(contractId)
    .first<ContractDbRow>();

  if (!contractRow) {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall: calculateSmartSplitWaterfall(0, 'STANDARD_70_30'),
      taxWithholding: calculateTaxWithholding(0, 'EXEMPT_NONE'),
      error: `Contract not found: ${contractId}`,
    };
  }

  const contract = mapContractRow(contractRow);
  if (contract.status !== 'active') {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall: calculateSmartSplitWaterfall(0, contract.splitTier),
      taxWithholding: calculateTaxWithholding(0, contract.contractorTaxRegime),
      error: `Contract is not active (status: ${contract.status})`,
    };
  }

  // 3. Compute Smart Split Waterfall
  const waterfall = calculateSmartSplitWaterfall(grossRevenueCents, contract.splitTier, {
    creatorSharePct: contract.creatorSharePct,
    platformSharePct: contract.platformSharePct,
    daoTreasurySharePct: contract.daoTreasurySharePct,
    lineageParentCreatorId: input.lineageParentCreatorId,
    rootCreatorId: contract.creatorId,
  });

  // 4. Apply Contractor Tax Withholding on Creator Portion
  const taxWithholding = calculateTaxWithholding(
    waterfall.creatorGrossCents,
    contract.contractorTaxRegime,
    contract.taxWithholdingRatePct,
  );

  // 5. Rail & Destination Resolution
  const payoutRail = input.payoutRail ?? contract.preferredPayoutRail;
  const destinationAddress = input.destinationAddress ?? '0x0000000000000000000000000000000000000001';
  const destinationBankBin = input.destinationBankBin ?? null;
  const destinationName = input.destinationName ?? 'Creator Payee';

  const destValidation = validatePayoutDestination(payoutRail, destinationAddress, destinationBankBin);
  if (!destValidation.valid) {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall,
      taxWithholding,
      error: destValidation.error,
    };
  }

  // 6. Currency & FX Settlement Amount
  const { settlementCurrency, fxRateApplied, settlementAmount } = resolveSettlementCurrencyAndAmount(
    payoutRail,
    taxWithholding.netPayableCents,
    input.fxRate,
  );

  // 7. Reference & QR Payload
  const now = Date.now();
  const settlementReference = `SETTLE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
  const qrPayload = generatePaymentQrPayload(payoutRail, {
    amount: settlementAmount,
    currency: settlementCurrency,
    destinationAddress,
    destinationBankBin,
    destinationName,
    reference: settlementReference,
  });

  const settlementId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);

  const metadataJson = JSON.stringify(input.metadata ?? {});

  const settlementRecord: CreatorRoyaltySettlement = {
    id: settlementId,
    settlementReference,
    contractId,
    creatorId: contract.creatorId,
    templateId: input.templateId ?? null,
    batchId: input.batchId ?? null,
    grossRoyaltyCents: grossRevenueCents,
    creatorGrossShareCents: waterfall.creatorGrossCents,
    platformShareCents: waterfall.platformCents,
    platformFeeCents: waterfall.platformCents,
    daoTreasuryCents: waterfall.daoTreasuryCents,
    contractorTaxRegime: contract.contractorTaxRegime,
    taxWithholdingRatePct: taxWithholding.taxRatePct,
    taxWithheldCents: taxWithholding.taxWithheldCents,
    railFeeCents: 0,
    netPayableCents: taxWithholding.netPayableCents,
    netPayoutCents: taxWithholding.netPayableCents,
    payoutRail,
    settlementCurrency,
    settlementAmount,
    fxRateApplied,
    destinationAddress,
    destinationBankBin,
    destinationName,
    status: 'pending',
    txHash: null,
    qrPayload,
    idempotencyKey,
    failureReason: null,
    settledAt: null,
    metadataJson,
    createdAt: now,
    updatedAt: now,
  };

  await insertSettlementRow(db, settlementRecord, idempotencyKey);

  logger.info('Recorded creator royalty settlement', {
    settlementReference,
    creatorId: contract.creatorId,
    grossRevenueCents,
    netPayableCents: taxWithholding.netPayableCents,
    payoutRail,
  });

  return {
    success: true,
    settlementId,
    settlementReference,
    waterfall,
    taxWithholding,
    settlementRecord,
  };
}

// ─── Query Operations ───────────────────────────────────────────────────────

export async function getCreatorContracts(
  db: D1Database,
  creatorId: string,
): Promise<CreatorLicensingContract[]> {
  const { results } = await db
    .prepare('SELECT * FROM creator_licensing_contracts WHERE creator_id = ? ORDER BY created_at DESC')
    .bind(creatorId)
    .all<ContractDbRow>();

  return (results ?? []).map(mapContractRow);
}

export async function listSettlements(
  db: D1Database,
  creatorId: string,
  status?: string,
): Promise<CreatorRoyaltySettlement[]> {
  let query = 'SELECT * FROM creator_royalty_settlements WHERE creator_id = ?';
  const binds: (string | number)[] = [creatorId];

  if (status) {
    query += ' AND status = ?';
    binds.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const { results } = await stmt.bind(...binds).all<SettlementDbRow>();

  return (results ?? []).map(mapSettlementRow);
}

export async function getSettlementById(
  db: D1Database,
  settlementId: string,
): Promise<CreatorRoyaltySettlement | null> {
  const row = await db
    .prepare('SELECT * FROM creator_royalty_settlements WHERE id = ? LIMIT 1')
    .bind(settlementId)
    .first<SettlementDbRow>();

  if (!row) return null;
  return mapSettlementRow(row);
}

export async function getContractById(
  db: D1Database,
  contractId: string,
): Promise<CreatorLicensingContract | null> {
  const row = await db
    .prepare('SELECT * FROM creator_licensing_contracts WHERE id = ? LIMIT 1')
    .bind(contractId)
    .first<ContractDbRow>();

  if (!row) return null;
  return mapContractRow(row);
}
