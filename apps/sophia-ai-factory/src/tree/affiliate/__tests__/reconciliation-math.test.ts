import { describe, it, expect } from 'vitest';
import {
  evaluateReconciliation,
  RECONCILIATION_TOLERANCE_CENTS,
} from '@/tree/payouts/reconciliation-math';

describe('Reconciliation Math (tree/payouts/reconciliation-math)', () => {
  it('identifies exact match as reconciled', () => {
    const result = evaluateReconciliation(10000, 10000);
    expect(result.isReconciled).toBe(true);
    expect(result.alertRequired).toBe(false);
    expect(result.diffCents).toBe(0);
  });

  it('tolerates small discrepancies <= $1.00 (100 cents)', () => {
    const result99 = evaluateReconciliation(10000, 10099);
    expect(result99.isReconciled).toBe(true);
    expect(result99.alertRequired).toBe(false);
    expect(result99.diffCents).toBe(99);

    const result100 = evaluateReconciliation(10000, 10100);
    expect(result100.isReconciled).toBe(true);
    expect(result100.alertRequired).toBe(false);
    expect(result100.diffCents).toBe(100);
  });

  it('rejects discrepancies > $1.00 and triggers alert', () => {
    const result101 = evaluateReconciliation(10000, 10101);
    expect(result101.isReconciled).toBe(false);
    expect(result101.alertRequired).toBe(true);
    expect(result101.diffCents).toBe(101);

    const resultBig = evaluateReconciliation(10000, 5000);
    expect(resultBig.isReconciled).toBe(false);
    expect(resultBig.alertRequired).toBe(true);
    expect(resultBig.diffCents).toBe(5000);
  });

  it('supports custom tolerance parameter', () => {
    const resultCustom = evaluateReconciliation(1000, 1050, 25);
    expect(resultCustom.isReconciled).toBe(false);
    expect(resultCustom.alertRequired).toBe(true);
  });
});
