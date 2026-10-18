/**
 * Correlation Context & Propagation
 *
 * @module seed/types/failure-kind-correlation
 */

export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  missionId?: string;
  provider?: string;
  artifactId?: string;
  timestamp: number;
}

/**
 * Create or initialize a traceable correlation context.
 */
export function createCorrelationContext(
  params: Partial<CorrelationContext> & { correlationId?: string } = {}
): CorrelationContext {
  const correlationId =
    params.correlationId ??
    `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    correlationId,
    requestId: params.requestId,
    missionId: params.missionId,
    provider: params.provider,
    artifactId: params.artifactId,
    timestamp: params.timestamp ?? Date.now(),
  };
}

/**
 * Propagate correlation context forward through lifecycle stages:
 * request → mission → provider → artifact.
 */
export function propagateCorrelation(
  current: CorrelationContext,
  updates: Partial<Omit<CorrelationContext, 'correlationId' | 'timestamp'>>
): CorrelationContext {
  return {
    ...current,
    ...updates,
  };
}
