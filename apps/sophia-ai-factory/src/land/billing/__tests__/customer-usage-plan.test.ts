import { describe, it, expect, vi } from 'vitest';
import { calculateOverageAndRemaining, resolveCustomerPlan } from '../customer-usage-plan';
import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs';

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: () => ({
      bind: () => ({
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  }),
}));

describe('CustomerUsagePlan & Overage Accounting', () => {
  it('calculates remaining MCU when within monthly quota allowance', () => {
    const { percentUsed, remaining, overage } = calculateOverageAndRemaining(150, 500);

    expect(percentUsed).toBe(30.0);
    expect(remaining.mcuRemaining).toBe(350);
    expect(overage.overageCredits).toBe(0);
    expect(overage.estimatedOverageCost).toBe(0.0);
    expect(overage.isAccruing).toBe(false);
    expect(overage.pricePerCredit).toBe(TOPUP_PRICE_PER_MCU);
  });

  it('calculates exact overage economics when consumption exceeds quota allowance', () => {
    const { percentUsed, remaining, overage } = calculateOverageAndRemaining(620, 500);

    expect(percentUsed).toBe(100);
    expect(remaining.mcuRemaining).toBe(0);
    expect(overage.overageCredits).toBe(120);
    expect(overage.isAccruing).toBe(true);
    expect(overage.pricePerCredit).toBe(0.10);
    // 120 MCU * $0.10 = $12.00
    expect(overage.estimatedOverageCost).toBe(12.0);
  });

  it('handles zero monthly quota without dividing by zero', () => {
    const { percentUsed, remaining, overage } = calculateOverageAndRemaining(50, 0);

    expect(percentUsed).toBe(0);
    expect(remaining.mcuRemaining).toBe(0);
    expect(overage.overageCredits).toBe(50);
    expect(overage.isAccruing).toBe(true);
  });

  it('resolves fallback BASIC plan and billing event when no DB subscription exists', async () => {
    const { plan, limit, nextBillingEvent } = await resolveCustomerPlan('usr_none', '2026-10-01T00:00:00.000Z');

    expect(plan.tier).toBe('BASIC');
    expect(plan.billingType).toBe('monthly');
    expect(limit.mcuMonthly).toBeGreaterThan(0);
    expect(nextBillingEvent.isLifetime).toBe(false);
    expect(nextBillingEvent.date).toBe('2026-10-01T00:00:00.000Z');
  });
});
