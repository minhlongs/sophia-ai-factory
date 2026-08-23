/**
 * AI Provider Abstraction — barrel export.
 *
 * @deprecated Dead code — tracked in DEPRECATION_REGISTRY
 * (seed/types/deprecation-markers.ts, target 'tree/ai-providers').
 * 0 importers; removal eligible after 2026-09-06. Do not add new imports.
 *
 * @module tree/ai-providers
 */

// Errors
export {
  AIProviderError,
  AIProviderErrorCode,
} from './errors'

// Types
export type {
  AIModel,
  AIModelType,
  AIProvider,
  AIRequest,
  AIResponse,
  ProviderRow,
  ProviderStatus,
  UsageRecord,
  UsageRow,
  UsageSummary,
  DateRange,
} from './types'
export {
  newProviderId,
  newAIRequestId,
} from './types'

// Registry
export {
  registerProvider,
  getProvider,
  listProviders,
  getAvailableProvider,
  invalidateCache,
} from './registry'

// Circuit integration
export {
  recordSuccess,
  recordFailure,
  canAttempt,
  getCircuitState,
  FailureKind,
} from './circuit'
export type { CircuitState } from './circuit'

// Usage tracker
export {
  recordUsage,
  getUsageByProvider,
  getTotalCostCents,
} from './usage-tracker'
