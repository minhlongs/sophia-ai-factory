/** Compare NOWPayments' paid amount with its expected amount in pay_currency. */
export type CryptoAmountCheck =
  | { status: 'not-reported' }
  | { status: 'missing-expected' }
  | { status: 'invalid' }
  | { status: 'sufficient'; expected: number; required: number }
  | { status: 'underpaid'; expected: number; required: number }

export function checkCryptoPaidAmount(
  actuallyPaid: number | null | undefined,
  payAmount: number | null | undefined,
  threshold: number,
): CryptoAmountCheck {
  if (actuallyPaid === undefined || actuallyPaid === null) return { status: 'not-reported' }
  if (payAmount === undefined || payAmount === null) return { status: 'missing-expected' }
  if (!Number.isFinite(actuallyPaid) || actuallyPaid < 0 || !Number.isFinite(payAmount) || payAmount <= 0) {
    return { status: 'invalid' }
  }

  const required = payAmount * threshold
  return actuallyPaid < required
    ? { status: 'underpaid', expected: payAmount, required }
    : { status: 'sufficient', expected: payAmount, required }
}
