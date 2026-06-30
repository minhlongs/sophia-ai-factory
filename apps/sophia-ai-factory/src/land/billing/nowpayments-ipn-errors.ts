/**
 * IPN (Instant Payment Notification) domain errors for the NOWPayments pipeline.
 * Used as the E type in Result<void, IPNError> return values.
 *
 * @module billing/nowpayments-ipn-errors
 */

export class IPNError extends Error {
  public readonly code: string;
  public readonly cause: unknown;

  constructor(code: string, cause?: unknown) {
    super(code);
    this.name = 'IPNError';
    this.code = code;
    this.cause = cause;
  }
}

export class DLQError extends Error {
  public readonly code: string;
  public readonly cause: unknown;

  constructor(code: string, cause?: unknown) {
    super(code);
    this.name = 'DLQError';
    this.code = code;
    this.cause = cause;
  }
}
