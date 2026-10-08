/**
 * @file cart-recovery-fsm.test.ts
 * @description Unit tests for Cart Recovery FSM & DNC calling window
 */

import { describe, it, expect } from 'vitest';
import { isDncCallingWindowSafe, resolveCartObjection } from '../cart-recovery-fsm';

describe('Cart Recovery FSM (Tree Layer)', () => {
  it('correctly validates DNC compliant calling hours', () => {
    expect(isDncCallingWindowSafe({ currentHourLocal: 8 })).toBe(false);
    expect(isDncCallingWindowSafe({ currentHourLocal: 9 })).toBe(true);
    expect(isDncCallingWindowSafe({ currentHourLocal: 14 })).toBe(true);
    expect(isDncCallingWindowSafe({ currentHourLocal: 19 })).toBe(true);
    expect(isDncCallingWindowSafe({ currentHourLocal: 20 })).toBe(false);
    expect(isDncCallingWindowSafe({ currentHourLocal: 23 })).toBe(false);
  });

  it('resolves PRICE_TOO_HIGH objection with tiered discount voucher', () => {
    const highCart = resolveCartObjection('PRICE_TOO_HIGH', 800000);
    expect(highCart.resolutionStrategy).toBe('DISCOUNT_VOUCHER');
    expect(highCart.suggestedDiscountPercent).toBe(15);
    expect(highCart.voucherCodePrefix).toBe('VOICE_FLASH');

    const lowCart = resolveCartObjection('PRICE_TOO_HIGH', 300000);
    expect(lowCart.suggestedDiscountPercent).toBe(10);
  });

  it('resolves SHIPPING_COST objection with free shipping voucher', () => {
    const res = resolveCartObjection('SHIPPING_COST', 250000);
    expect(res.resolutionStrategy).toBe('FREE_SHIPPING');
    expect(res.voucherCodePrefix).toBe('FREESHIP');
    expect(res.responseScriptVi).toContain('miễn phí giao hàng');
  });

  it('resolves TRUST_ISSUE objection with guarantee and trust voucher', () => {
    const res = resolveCartObjection('TRUST_ISSUE', 500000);
    expect(res.resolutionStrategy).toBe('TRUST_GUARANTEE');
    expect(res.responseScriptVi).toContain('bảo hành chính hãng đổi mới 1-1');
  });
});
