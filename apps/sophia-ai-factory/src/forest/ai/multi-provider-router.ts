/**
 * @module forest/ai/multi-provider-router
 *
 * Re-exports from seed/ai/multi-provider-router (single source of truth).
 *
 * The MultiProviderRouter class lives in seed/ because it only depends
 * on seed types (Provider, ProviderRegistry, classifyComplexity, etc.).
 * This re-export keeps the forest/ import path working for existing callers.
 *
 * Layer rule: forest — re-exports seed only.
 */

export {
  MultiProviderRouter,
  AllProvidersFailedError,
  type RoutedChatResult,
  type MultiProviderRouterOptions,
} from '@/seed/ai/multi-provider-router';
