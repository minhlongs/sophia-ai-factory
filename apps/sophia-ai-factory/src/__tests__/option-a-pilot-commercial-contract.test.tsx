import { describe, expect, it } from 'vitest';
import { OPTION_A_PILOT_CONTRACT as contract, OPTION_A_PILOT_COPY, formatOptionAPriceVnd } from '@/seed/config/tiers/option-a-pilot-contract';
import { getRefundWindowDays } from '@/seed/config/refund-policy';
import { renderReceipt, type ReceiptInput } from '@/land/billing/email/receipt-email-template';
import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

const receipt: ReceiptInput = {
  email: 'buyer@example.test', tier: 'BASIC', period: 'pilot_14d',
  amountUsd: 79, amountVnd: 1_990_000, paymentId: 'settlement-example',
  paymentMethod: 'manual_bank', orderId: 'pilot-example', activationStatus: 'ACTIVE_14D',
};

describe('Option A pilot commercial contract', () => {
  it('keeps the pilot one-time VND contract and usage-independent refund', () => {
    expect(contract).toMatchObject({ priceVnd: 1_990_000, currency: 'VND', timezone: 'Asia/Saigon',
      durationDays: 14, includedMcu: 500, guaranteedVideos: 0, autoRenews: false });
    expect(contract.refundPolicy).toMatchObject({ pilotGoodwillWindowDays: 7,
      pilotDeliveryFailureWindowDays: 14, goodwillRegardlessOfUsage: true, refundPercent: 100,
      consumedMcuRefundable: true, thirdPartyByokFeesRefundable: false });
    expect(formatOptionAPriceVnd('vi')).toBe('1.990.000 VND');
    expect(formatOptionAPriceVnd('en')).toBe('1,990,000 VND');
    expect(formatOptionAPriceVnd()).toBe('1.990.000 VND');
  });

  it('preserves standard and MASTER refund windows', () => {
    expect(getRefundWindowDays('MASTER')).toBe(14);
    expect(getRefundWindowDays('BASIC')).toBe(30);
    expect(getRefundWindowDays('PREMIUM')).toBe(30);
    expect(getRefundWindowDays('UNKNOWN')).toBe(30);
    expect(getRefundWindowDays('BASIC', 'pilot_14d')).toBe(7);
    // Legacy standard day-10 requests must remain inside their original window.
    for (const tier of ['BASIC', 'PREMIUM', 'ENTERPRISE']) {
      expect(10).toBeLessThanOrEqual(getRefundWindowDays(tier));
      expect(getRefundWindowDays(tier, 'monthly')).toBe(30);
    }
    expect(10).toBeGreaterThan(getRefundWindowDays('BASIC', 'pilot_14d'));
    expect(en.setupWizard.doctrine.bullet_refund_body).toContain('30-day');
    expect(vi.setupWizard.doctrine.bullet_refund_body).toContain('30 ngày');
  });

  for (const locale of ['en', 'vi'] as const) {
    it(`discloses scope and unconditional refund in ${locale}`, () => {
      const copy = OPTION_A_PILOT_COPY[locale];
      expect(copy.scope).toContain('500 MCU');
      expect(copy.scope).toContain('Asia/Saigon');
      expect(copy.scope).toContain('BYOK');
      expect(copy.refund).toContain('100%');
      expect(copy.refund).toContain(locale === 'en' ? 'regardless of MCU usage' : 'bất kể mức sử dụng MCU');
      const output = renderReceipt({ ...receipt, locale });
      expect(output.html).toContain(copy.refund);
      expect(output.text).toContain(copy.scope);
      expect(output.text).toContain(formatOptionAPriceVnd(locale));
      expect(output.text).not.toContain('$79');
    });
  }

  it('does not fabricate collection amount or emit receipts before activation', () => {
    expect(() => renderReceipt({ ...receipt, activationStatus: undefined })).toThrow('ACTIVE_14D');
    for (const amountVnd of [undefined, 0, -1, 1.5, NaN]) {
      expect(() => renderReceipt({ ...receipt, amountVnd })).toThrow('actual settled VND');
    }
    const actual = renderReceipt({ ...receipt, paymentMethod: 'payos', amountVnd: 1_500_000 });
    expect(actual.text).toContain('1,500,000 VND');
  });

  it('retains nonpilot receipts without a pilot activation requirement', () => {
    const output = renderReceipt({ ...receipt, activationStatus: undefined, period: 'monthly',
      amountUsd: 199, amountVnd: undefined, paymentMethod: 'nowpayments' });
    expect(output.text).toContain('$199.00 USD');
    expect(output.text).not.toContain('Pilot only');
  });

  it('removes conditional-use and instant-activation promises in both locales', () => {
    for (const messages of [en, vi]) {
      const pilot = messages.stitch.pricingPage.paidPilot;
      expect(pilot.subtitle).toContain('100%');
      expect(pilot.bullet1).toContain('500 MCU');
      expect(pilot.bullet1).toContain('Asia/Saigon');
      expect(pilot.title).not.toContain('$79');
      expect(pilot.bullet2).not.toMatch(/instant|tức thì/i);
      expect(messages.setupWizard.doctrine.bullet_refund_body).not.toMatch(/unused|minimal|tối thiểu/i);
    }
  });
});
