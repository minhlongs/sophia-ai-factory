import { describe, it, expect, vi } from 'vitest';
import {
  calculateSmartSplitWaterfall,
  calculateTaxWithholding,
  validatePayoutDestination,
  generatePaymentQrPayload,
  createLicensingContract,
  executeRoyaltySplitAndSettle,
} from '../royalty-split-engine';
import type { D1Database } from '@/seed/db/client';

describe('Royalty Split Engine - Zero Penny Leakage & Mathematical Invariants', () => {
  it('enforces zero penny leakage for DAO_80_20 split tier', () => {
    const testAmounts = [0, 1, 2, 3, 7, 10, 33, 99, 100, 101, 1999, 10000, 999999];

    for (const gross of testAmounts) {
      const result = calculateSmartSplitWaterfall(gross, 'DAO_80_20');
      expect(result.invarianceVerified).toBe(true);
      expect(result.creatorGrossCents + result.daoTreasuryCents + result.platformCents).toBe(gross);
      expect(result.creatorGrossCents).toBeGreaterThanOrEqual(0);
      expect(result.platformCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.creatorGrossCents)).toBe(true);
      expect(Number.isInteger(result.platformCents)).toBe(true);
    }
  });

  it('enforces zero penny leakage for STANDARD_70_30 split tier', () => {
    const testAmounts = [1, 5, 9, 13, 27, 49, 99, 100, 150, 4999, 100000];

    for (const gross of testAmounts) {
      const result = calculateSmartSplitWaterfall(gross, 'STANDARD_70_30');
      expect(result.invarianceVerified).toBe(true);
      expect(result.creatorGrossCents + result.daoTreasuryCents + result.platformCents).toBe(gross);
      expect(Number.isInteger(result.creatorGrossCents)).toBe(true);
      expect(Number.isInteger(result.platformCents)).toBe(true);
    }
  });

  it('allocates remainder cents to the platform rather than leaking fractions', () => {
    // 1 cent at 70/30: floor(1 * 70 / 100) = 0. Platform gets 1 - 0 = 1 cent.
    const result1 = calculateSmartSplitWaterfall(1, 'STANDARD_70_30');
    expect(result1.creatorGrossCents).toBe(0);
    expect(result1.platformCents).toBe(1);
    expect(result1.creatorGrossCents + result1.platformCents).toBe(1);

    // 3 cents at 80/20: floor(3 * 80 / 100) = floor(2.4) = 2. Platform gets 3 - 2 = 1.
    const result3 = calculateSmartSplitWaterfall(3, 'DAO_80_20');
    expect(result3.creatorGrossCents).toBe(2);
    expect(result3.platformCents).toBe(1);
    expect(result3.creatorGrossCents + result3.platformCents).toBe(3);
  });

  it('handles DAO treasury allocation with zero-penny leakage', () => {
    const gross = 10000; // $100.00
    const result = calculateSmartSplitWaterfall(gross, 'DAO_80_20', {
      creatorSharePct: 75.0,
      daoTreasurySharePct: 5.0,
      platformSharePct: 20.0,
    });

    expect(result.invarianceVerified).toBe(true);
    expect(result.creatorGrossCents).toBe(7500);
    expect(result.daoTreasuryCents).toBe(500);
    expect(result.platformCents).toBe(2000);
    expect(result.creatorGrossCents + result.daoTreasuryCents + result.platformCents).toBe(gross);
  });

  it('passes Monte Carlo simulation of 1,000 random amounts with zero leakage', () => {
    for (let i = 0; i < 1000; i++) {
      const gross = Math.floor(Math.random() * 10_000_000); // 0 to $100,000
      const tier = i % 2 === 0 ? 'DAO_80_20' : 'STANDARD_70_30';
      const result = calculateSmartSplitWaterfall(gross, tier);

      expect(result.invarianceVerified).toBe(true);
      expect(result.creatorGrossCents + result.daoTreasuryCents + result.platformCents).toBe(gross);
      expect(Number.isInteger(result.creatorGrossCents)).toBe(true);
      expect(Number.isInteger(result.platformCents)).toBe(true);
      expect(result.creatorGrossCents).toBeGreaterThanOrEqual(0);
      expect(result.platformCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('calculates multi-tier lineage attribution for remix derivatives without leakage', () => {
    const gross = 10000; // $100.00
    const result = calculateSmartSplitWaterfall(gross, 'STANDARD_70_30', {
      lineageParentCreatorId: 'remixer_user_123',
      rootCreatorId: 'root_original_456',
    });

    // 70% to creator = 7000 cents
    expect(result.creatorGrossCents).toBe(7000);
    expect(result.platformCents).toBe(3000);
    // Lineage: 70% of 7000 = 4900 to root, 30% of 7000 = 2100 to remixer
    expect(result.rootCreatorCents).toBe(4900);
    expect(result.remixerCents).toBe(2100);
    expect((result.rootCreatorCents ?? 0) + (result.remixerCents ?? 0)).toBe(result.creatorGrossCents);
  });

  it('throws on negative or non-integer revenue amounts', () => {
    expect(() => calculateSmartSplitWaterfall(-100, 'STANDARD_70_30')).toThrow();
    expect(() => calculateSmartSplitWaterfall(10.5, 'STANDARD_70_30')).toThrow();
  });
});

describe('Royalty Split Engine - Statutory Tax Withholding', () => {
  it('withholds Vietnam TT111 contractor tax (10%) correctly', () => {
    const gross = 10000; // $100.00
    const result = calculateTaxWithholding(gross, 'VN_CONTRACTOR_10PCT');

    expect(result.invarianceVerified).toBe(true);
    expect(result.taxRatePct).toBe(10.0);
    expect(result.taxWithheldCents).toBe(1000);
    expect(result.netPayableCents).toBe(9000);
    expect(result.taxWithheldCents + result.netPayableCents).toBe(gross);
  });

  it('withholds Vietnam micro-business contractor tax (5%) correctly', () => {
    const gross = 10000;
    const result = calculateTaxWithholding(gross, 'VN_CONTRACTOR_5PCT');

    expect(result.invarianceVerified).toBe(true);
    expect(result.taxRatePct).toBe(5.0);
    expect(result.taxWithheldCents).toBe(500);
    expect(result.netPayableCents).toBe(9500);
  });

  it('withholds US W-8BEN statutory tax (30%) and treaty rate (10%)', () => {
    const gross = 5000; // $50.00

    const w8Statutory = calculateTaxWithholding(gross, 'US_W8BEN_30PCT');
    expect(w8Statutory.taxRatePct).toBe(30.0);
    expect(w8Statutory.taxWithheldCents).toBe(1500);
    expect(w8Statutory.netPayableCents).toBe(3500);
    expect(w8Statutory.invarianceVerified).toBe(true);

    const w8Treaty = calculateTaxWithholding(gross, 'US_W8BEN_TREATY_10PCT');
    expect(w8Treaty.taxRatePct).toBe(10.0);
    expect(w8Treaty.taxWithheldCents).toBe(500);
    expect(w8Treaty.netPayableCents).toBe(4500);
    expect(w8Treaty.invarianceVerified).toBe(true);
  });

  it('withholds Thailand WHT (3%) correctly', () => {
    const gross = 10000;
    const result = calculateTaxWithholding(gross, 'TH_WHT_3PCT');

    expect(result.taxRatePct).toBe(3.0);
    expect(result.taxWithheldCents).toBe(300);
    expect(result.netPayableCents).toBe(9700);
    expect(result.invarianceVerified).toBe(true);
  });

  it('applies 0% withholding for EU reverse charge and exempt status', () => {
    const gross = 20000;

    const euResult = calculateTaxWithholding(gross, 'EU_REVERSE_CHARGE_0PCT');
    expect(euResult.taxWithheldCents).toBe(0);
    expect(euResult.netPayableCents).toBe(gross);
    expect(euResult.invarianceVerified).toBe(true);

    const exemptResult = calculateTaxWithholding(gross, 'EXEMPT_NONE');
    expect(exemptResult.taxWithheldCents).toBe(0);
    expect(exemptResult.netPayableCents).toBe(gross);
    expect(exemptResult.invarianceVerified).toBe(true);
  });

  it('handles odd cents in tax withholding without fractional leakage', () => {
    // 3 cents at 10%: floor(3 * 10 / 100) = 0. net = 3.
    const result = calculateTaxWithholding(3, 'VN_CONTRACTOR_10PCT');
    expect(result.taxWithheldCents).toBe(0);
    expect(result.netPayableCents).toBe(3);
    expect(result.taxWithheldCents + result.netPayableCents).toBe(3);
  });
});

describe('Royalty Split Engine - Payout Rail Destination Validation', () => {
  it('validates EVM addresses for NOWPAYMENTS_USDC rails', () => {
    const validEVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const invalidEVM = '0xnothexaddress';
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    expect(validatePayoutDestination('NOWPAYMENTS_USDC_ARBITRUM', validEVM).valid).toBe(true);
    expect(validatePayoutDestination('NOWPAYMENTS_USDC_POLYGON', validEVM).valid).toBe(true);

    expect(validatePayoutDestination('NOWPAYMENTS_USDC_ARBITRUM', invalidEVM).valid).toBe(false);
    expect(validatePayoutDestination('NOWPAYMENTS_USDC_ARBITRUM', zeroAddress).valid).toBe(false);
  });

  it('validates VietQR NAPAS BIN and account numbers', () => {
    const validBin = '970422'; // MBBank
    const validAcc = '1234567890';

    expect(validatePayoutDestination('PAYOS_VIETQR', validAcc, validBin).valid).toBe(true);
    // Invalid 5-digit BIN
    expect(validatePayoutDestination('PAYOS_VIETQR', validAcc, '12345').valid).toBe(false);
    // Missing BIN
    expect(validatePayoutDestination('PAYOS_VIETQR', validAcc).valid).toBe(false);
    // Short account
    expect(validatePayoutDestination('PAYOS_VIETQR', '12', validBin).valid).toBe(false);
  });

  it('validates PromptPay phone and national IDs', () => {
    const validPhone = '0812345678';
    const validNationalId = '1234567890123';
    const invalidPromptPay = '12345';

    expect(validatePayoutDestination('PROMPTPAY', validPhone).valid).toBe(true);
    expect(validatePayoutDestination('PROMPTPAY', validNationalId).valid).toBe(true);
    expect(validatePayoutDestination('PROMPTPAY', invalidPromptPay).valid).toBe(false);
  });

  it('validates SEPA IBAN format', () => {
    const validIban = 'DE89370400440532013000';
    const invalidIban = 'INVALID123';

    expect(validatePayoutDestination('SEPA_INSTANT', validIban).valid).toBe(true);
    expect(validatePayoutDestination('SEPA_INSTANT', invalidIban).valid).toBe(false);
  });
});

describe('Royalty Split Engine - QR Code Generation', () => {
  it('generates VietQR image URL correctly', () => {
    const qrUrl = generatePaymentQrPayload('PAYOS_VIETQR', {
      amount: 2540000,
      currency: 'VND',
      destinationAddress: '0123456789',
      destinationBankBin: '970422',
      destinationName: 'NGUYEN VAN A',
      reference: 'SETTLE-20270926-001',
    });

    expect(qrUrl).toContain('https://img.vietqr.io/image/970422-0123456789-compact2.png');
    expect(qrUrl).toContain('amount=2540000');
    expect(qrUrl).toContain('addInfo=SETTLE-20270926-001');
  });

  it('generates PromptPay URI correctly', () => {
    const uri = generatePaymentQrPayload('PROMPTPAY', {
      amount: 1500.5,
      currency: 'THB',
      destinationAddress: '0812345678',
      destinationName: 'SOMCHAI',
      reference: 'SETTLE-TH-001',
    });

    expect(uri).toContain('promptpay://0812345678?amount=1500.50');
    expect(uri).toContain('ref=SETTLE-TH-001');
  });

  it('returns null for crypto and wire rails without QR payloads', () => {
    const qr = generatePaymentQrPayload('NOWPAYMENTS_USDC_ARBITRUM', {
      amount: 100,
      currency: 'USDC',
      destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      destinationName: 'Vitalik',
      reference: 'SETTLE-CRYPTO-01',
    });
    expect(qr).toBeNull();
  });
});

describe('Royalty Split Engine - Database Integration Mock', () => {
  function createMockD1(initialRows: Record<string, unknown>[] = []): D1Database {
    const rows = [...initialRows];

    return {
      prepare: vi.fn((query: string) => {
        let boundValues: unknown[] = [];
        return {
          bind: vi.fn((...args: unknown[]) => {
            boundValues = args;
            return {
              first: vi.fn(async () => {
                if (query.includes('FROM creator_royalty_settlements WHERE idempotency_key = ?')) {
                  const key = boundValues[0];
                  return rows.find((r) => (r as Record<string, unknown>).idempotency_key === key) ?? null;
                }
                if (query.includes('FROM creator_licensing_contracts WHERE id = ?')) {
                  const id = boundValues[0];
                  return rows.find((r) => (r as Record<string, unknown>).id === id) ?? null;
                }
                return rows[0] ?? null;
              }),
              all: vi.fn(async () => ({ results: rows })),
              run: vi.fn(async () => {
                if (query.startsWith('INSERT INTO creator_licensing_contracts')) {
                  rows.push({
                    id: boundValues[0],
                    contract_number: boundValues[1],
                    creator_id: boundValues[2],
                    dao_id: boundValues[3],
                    contract_title: boundValues[4],
                    contract_type: boundValues[5],
                    split_tier: boundValues[6],
                    creator_share_pct: boundValues[7],
                    platform_share_pct: boundValues[8],
                    dao_treasury_share_pct: boundValues[9],
                    commercial_rights: boundValues[10],
                    ai_training_permission: boundValues[11],
                    minimum_payout_cents: boundValues[12],
                    preferred_payout_rail: boundValues[13],
                    contractor_tax_regime: boundValues[14],
                    tax_withholding_rate_pct: boundValues[15],
                    tax_id_number: boundValues[16],
                    status: 'active',
                    terms_canonical_json: boundValues[17],
                    contract_hash: boundValues[18],
                    creator_signature: boundValues[19],
                    starts_at: boundValues[20],
                    expires_at: boundValues[21],
                    created_at: boundValues[22],
                    updated_at: boundValues[23],
                  });
                } else if (query.startsWith('INSERT INTO creator_royalty_settlements')) {
                  rows.push({
                    id: boundValues[0],
                    settlement_reference: boundValues[1],
                    contract_id: boundValues[2],
                    creator_id: boundValues[3],
                    template_id: boundValues[4],
                    batch_id: boundValues[5],
                    gross_royalty_cents: boundValues[6],
                    platform_fee_cents: boundValues[7],
                    dao_treasury_cents: boundValues[8],
                    contractor_tax_regime: boundValues[9],
                    tax_withholding_rate_pct: boundValues[10],
                    tax_withheld_cents: boundValues[11],
                    rail_fee_cents: 0,
                    net_payable_cents: boundValues[12],
                    payout_rail: boundValues[13],
                    settlement_currency: boundValues[14],
                    settlement_amount: boundValues[15],
                    fx_rate_applied: boundValues[16],
                    destination_address: boundValues[17],
                    destination_bank_bin: boundValues[18],
                    destination_name: boundValues[19],
                    status: 'pending',
                    tx_hash: null,
                    qr_payload: boundValues[21],
                    idempotency_key: boundValues[20],
                    failure_reason: null,
                    settled_at: null,
                    metadata_json: boundValues[22],
                    created_at: boundValues[23],
                    updated_at: boundValues[24],
                  });
                }
                return { success: true };
              }),
            };
          }),
        };
      }),
    } as unknown as D1Database;
  }

  it('creates and canonically hashes licensing contract in D1', async () => {
    const mockDb = createMockD1();
    const contract = await createLicensingContract(mockDb, {
      creatorId: 'creator_001',
      contractTitle: 'Creator DAO Guild Agreement',
      contractType: 'dao_exclusive',
      splitTier: 'DAO_80_20',
      contractorTaxRegime: 'VN_CONTRACTOR_10PCT',
    });

    expect(contract.creatorSharePct).toBe(80.0);
    expect(contract.platformSharePct).toBe(20.0);
    expect(contract.contractHash).toHaveLength(64);
    expect(contract.creatorSignature).toBeDefined();
    expect(contract.status).toBe('active');
  });

  it('executes royalty split and creates settlement record with idempotency', async () => {
    const mockContractRow = {
      id: 'contract_test_123',
      contract_number: 'CLC-2027-0001',
      creator_id: 'creator_001',
      dao_id: null,
      contract_title: 'Marketplace Standard',
      contract_type: 'standard_marketplace',
      split_tier: 'STANDARD_70_30',
      creator_share_pct: 70.0,
      platform_share_pct: 30.0,
      dao_treasury_share_pct: 0.0,
      commercial_rights: 'non_exclusive',
      ai_training_permission: 'prohibited',
      minimum_payout_cents: 5000,
      preferred_payout_rail: 'NOWPAYMENTS_USDC_ARBITRUM',
      contractor_tax_regime: 'VN_CONTRACTOR_10PCT',
      tax_withholding_rate_pct: 10.0,
      tax_id_number: 'MST-12345678',
      status: 'active',
      terms_canonical_json: '{}',
      contract_hash: 'abc',
      creator_signature: 'sig',
      starts_at: Date.now(),
      expires_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const mockDb = createMockD1([mockContractRow]);

    const result = await executeRoyaltySplitAndSettle(mockDb, {
      contractId: 'contract_test_123',
      grossRevenueCents: 10000, // $100.00
      idempotencyKey: 'idem_key_001',
      destinationAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      destinationName: 'Creator John',
    });

    expect(result.success).toBe(true);
    expect(result.waterfall.creatorGrossCents).toBe(7000);
    expect(result.waterfall.platformCents).toBe(3000);
    expect(result.taxWithholding.taxWithheldCents).toBe(700);
    expect(result.taxWithholding.netPayableCents).toBe(6300);

    // Second execution with same idempotency key returns idempotent cached result
    const secondResult = await executeRoyaltySplitAndSettle(mockDb, {
      contractId: 'contract_test_123',
      grossRevenueCents: 10000,
      idempotencyKey: 'idem_key_001',
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.settlementId).toBe(result.settlementId);
  });
});
