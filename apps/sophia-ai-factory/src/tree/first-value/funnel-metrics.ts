/**
 * Privacy-safe First-Value Funnel instrumentation for Track B1.
 *
 * Strictly separates:
 * - SIMULATED_FIRST_VALUE (fixture/mocked output)
 * - REAL_MODEL_FIRST_VALUE (live provider output, not yet customer-accepted)
 * - CUSTOMER_ACCEPTED_FIRST_VALUE (live provider output + explicit user acceptance)
 *
 * Never records plaintext API keys, raw script bodies, or PII.
 *
 * @module tree/first-value/funnel-metrics
 */

export type FirstValueEventName =
  | 'funnel_entry'
  | 'byok_setup_completed'
  | 'validation_receipt_issued'
  | 'cost_preview_viewed'
  | 'script_available_for_review'
  | 'script_rejected'
  | 'script_explicitly_accepted'
  | 'error_or_abandonment';

export type FirstValueOutcomeClass =
  | 'NONE'
  | 'SIMULATED_FIRST_VALUE'
  | 'REAL_MODEL_FIRST_VALUE'
  | 'CUSTOMER_ACCEPTED_FIRST_VALUE';

export type AbandonmentOrErrorCategory =
  | 'unauthenticated'
  | 'wrong_organization'
  | 'invalid_or_missing_byok'
  | 'tampered_receipt'
  | 'missing_price_data'
  | 'provider_timeout'
  | 'invalid_script_schema'
  | 'paid_inference_not_authorized'
  | 'mcu_insufficient_or_failed'
  | 'user_rejected_script'
  | 'abandoned_before_acceptance';

export interface FirstValueMetricEvent {
  readonly event: FirstValueEventName;
  readonly orgId: string;
  readonly sessionId: string;
  readonly timestampMs: number;
  readonly stepNumber: number;
  readonly outcomeClass?: FirstValueOutcomeClass;
  readonly receiptAuthStatus?: string;
  readonly costPreviewStatus?: string;
  readonly errorCategory?: AbandonmentOrErrorCategory;
  readonly frictionCode?: string;
}

export interface FirstValueFunnelSummary {
  readonly sessionId: string;
  readonly orgId: string;
  readonly onboardingStepCount: number;
  readonly firstValueElapsedMs: number | null;
  readonly outcomeClass: FirstValueOutcomeClass;
  readonly simulatedFirstValueReached: boolean;
  readonly realModelFirstValueReached: boolean;
  readonly customerAcceptedFirstValueReached: boolean;
  readonly errorCategories: readonly AbandonmentOrErrorCategory[];
  readonly frictionSignals: readonly string[];
  readonly events: readonly FirstValueMetricEvent[];
}

const ALLOWED_SAFE_KEYS = new Set<string>([
  'event',
  'orgId',
  'sessionId',
  'timestampMs',
  'stepNumber',
  'outcomeClass',
  'receiptAuthStatus',
  'costPreviewStatus',
  'errorCategory',
  'frictionCode',
]);

/**
 * In-memory privacy-safe funnel collector (injectable with optional external sink).
 */
export class FirstValueFunnelCollector {
  private readonly events: FirstValueMetricEvent[] = [];
  private readonly onEmit?: (event: FirstValueMetricEvent) => void;

  constructor(onEmit?: (event: FirstValueMetricEvent) => void) {
    this.onEmit = onEmit;
  }

  record(input: FirstValueMetricEvent): FirstValueMetricEvent {
    const sanitized: FirstValueMetricEvent = {
      event: input.event,
      orgId: input.orgId,
      sessionId: input.sessionId,
      timestampMs: input.timestampMs,
      stepNumber: input.stepNumber,
      ...(input.outcomeClass ? { outcomeClass: input.outcomeClass } : {}),
      ...(input.receiptAuthStatus ? { receiptAuthStatus: input.receiptAuthStatus } : {}),
      ...(input.costPreviewStatus ? { costPreviewStatus: input.costPreviewStatus } : {}),
      ...(input.errorCategory ? { errorCategory: input.errorCategory } : {}),
      ...(input.frictionCode ? { frictionCode: input.frictionCode } : {}),
    };

    // Guardrail: ensure no unexpected fields (e.g. raw keys, prompts, script text) slip in.
    for (const key of Object.keys(sanitized)) {
      if (!ALLOWED_SAFE_KEYS.has(key)) {
        throw new Error(`Disallowed metric field: ${key}`);
      }
    }

    this.events.push(sanitized);
    this.onEmit?.(sanitized);
    return sanitized;
  }

  getEvents(sessionId?: string): readonly FirstValueMetricEvent[] {
    if (!sessionId) return [...this.events];
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  summarize(sessionId: string, orgId: string): FirstValueFunnelSummary {
    const scoped = this.events.filter((e) => e.sessionId === sessionId && e.orgId === orgId);
    const entry = scoped.find((e) => e.event === 'funnel_entry');
    const accepted = scoped.find((e) => e.event === 'script_explicitly_accepted');
    const reviewReady = scoped.find((e) => e.event === 'script_available_for_review');

    const simulatedFirstValueReached = scoped.some(
      (e) => e.outcomeClass === 'SIMULATED_FIRST_VALUE',
    );
    const realModelFirstValueReached = scoped.some(
      (e) =>
        e.outcomeClass === 'REAL_MODEL_FIRST_VALUE' ||
        e.outcomeClass === 'CUSTOMER_ACCEPTED_FIRST_VALUE',
    );
    const customerAcceptedFirstValueReached = scoped.some(
      (e) => e.outcomeClass === 'CUSTOMER_ACCEPTED_FIRST_VALUE',
    );

    let outcomeClass: FirstValueOutcomeClass = 'NONE';
    if (customerAcceptedFirstValueReached) {
      outcomeClass = 'CUSTOMER_ACCEPTED_FIRST_VALUE';
    } else if (realModelFirstValueReached) {
      outcomeClass = 'REAL_MODEL_FIRST_VALUE';
    } else if (simulatedFirstValueReached) {
      outcomeClass = 'SIMULATED_FIRST_VALUE';
    }

    const terminalEvent = accepted ?? reviewReady;
    const firstValueElapsedMs =
      entry && terminalEvent && terminalEvent.timestampMs >= entry.timestampMs
        ? terminalEvent.timestampMs - entry.timestampMs
        : null;

    const distinctSteps = new Set(scoped.map((e) => e.stepNumber));
    const errorCategories = scoped
      .map((e) => e.errorCategory)
      .filter((c): c is AbandonmentOrErrorCategory => Boolean(c));
    const frictionSignals = Array.from(
      new Set(scoped.map((e) => e.frictionCode).filter((c): c is string => Boolean(c))),
    );

    return {
      sessionId,
      orgId,
      onboardingStepCount: distinctSteps.size,
      firstValueElapsedMs,
      outcomeClass,
      simulatedFirstValueReached,
      realModelFirstValueReached,
      customerAcceptedFirstValueReached,
      errorCategories,
      frictionSignals,
      events: scoped,
    };
  }
}
