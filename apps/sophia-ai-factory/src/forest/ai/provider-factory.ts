/**
 * @module forest/ai/provider-factory
 *
 * Factory for creating AI provider instances from configuration.
 *
 * Resolves API keys with BYOK-first strategy:
 * 1. Check BYOK store (user-provided key) via tree resolver
 * 2. Fall back to platform environment variables
 *
 * Creates and registers OpenRouterProvider and AnthropicProvider
 * adapters that implement the seed ProviderInterface.
 *
 * Layer rule: forest — imports seed + tree only.
 */

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities,
} from '@/seed/ai/provider-interface';
import type { ByokProvider } from '@/tree/byok/user-api-key-store';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { OpenRouterProvider } from './openrouter-provider';
import { AnthropicProvider } from './anthropic-provider';

// ── Configuration ──────────────────────────────────────────────────────────────

/**
 * Configuration for a single provider instance.
 */
export interface ProviderConfig {
  /** Provider identifier. */
  id: ProviderId;
  /** Human-readable label for logs and UI. */
  label: string;
  /** Platform-level API key (used when BYOK is off or user has no key). */
  platformApiKey?: string;
  /** Optional base URL override (for OpenRouter gateway routing). */
  baseUrl?: string;
}

/**
 * Options for the ProviderFactory.
 */
export interface ProviderFactoryOptions {
  /** User ID for BYOK key resolution. Pass null for platform-only mode. */
  userId?: string | null;
  /** Provider configurations to instantiate. */
  providers: ProviderConfig[];
  /** Whether to auto-register created providers in the global registry. */
  autoRegister?: boolean;
  /** Custom fallback order for the registry. */
  fallbackOrder?: ProviderId[];
}

// ── Factory result ─────────────────────────────────────────────────────────────

/**
 * Result of building providers — holds instances and the registry.
 */
export interface ProviderFactoryResult {
  /** Map of provider id → Provider instance. */
  providers: Map<ProviderId, Provider>;
  /** The shared provider registry. */
  registry: ProviderRegistry;
}

// ── Provider factory ───────────────────────────────────────────────────────────

/**
 * Create provider instances from configuration, resolve API keys,
 * and register them in a shared ProviderRegistry.
 *
 * Key resolution order per provider:
 * 1. BYOK store (if BYOK_ENABLED=1 and userId provided)
 * 2. Platform env var / config fallback
 *
 * @example
 * const result = await buildProviders({
 *   userId: 'user_123',
 *   providers: [
 *     { id: 'openrouter', label: 'OpenRouter', platformApiKey: env.OPENROUTER_API_KEY },
 *     { id: 'anthropic', label: 'Anthropic', platformApiKey: env.ANTHROPIC_API_KEY },
 *   ],
 *   autoRegister: true,
 * });
 * const router = new MultiProviderRouter(result.registry);
 */
export async function buildProviders(
  options: ProviderFactoryOptions,
): Promise<ProviderFactoryResult> {
  const { userId, providers: configs, autoRegister = true, fallbackOrder } = options;

  const registry = new ProviderRegistry(fallbackOrder);
  const instances = new Map<ProviderId, Provider>();

  for (const config of configs) {
    const apiKey = await resolveApiKey(userId, config.id, config.platformApiKey);

    if (!apiKey) {
      logger.warn('[ProviderFactory] No API key resolved — skipping provider', undefined, {
        providerId: config.id,
        label: config.label,
        byokEnabled: isByokEnabled(),
        userId,
      });
      continue;
    }

    const provider = createProvider(config, apiKey);

    instances.set(config.id, provider);

    if (autoRegister) {
      registry.register(provider);
      logger.info('[ProviderFactory] Registered provider', undefined, {
        providerId: config.id,
        label: config.label,
      });
    }
  }

  return { providers: instances, registry };
}

// ── Key resolution ─────────────────────────────────────────────────────────────

/**
 * Resolve the API key for a provider using BYOK-first strategy.
 *
 * Order:
 * 1. BYOK store (user key) — only when BYOK_ENABLED=1 and userId is set
 * 2. Platform fallback key from config
 *
 * @returns Resolved key or null if none available.
 */
async function resolveApiKey(
  userId: string | null | undefined,
  providerId: ProviderId,
  platformFallback?: string,
): Promise<string | null> {
  // BYOK first: try user's stored key (only for BYOK-supported providers)
  const byokProvider = providerId as ByokProvider;
  const byokSupported: ByokProvider[] = ['openrouter', 'anthropic', 'elevenlabs'];

  if (userId && isByokEnabled() && byokSupported.includes(byokProvider)) {
    try {
      const userKey = await resolveUserApiKey(userId, byokProvider);
      if (userKey) {
        logger.debug('[ProviderFactory] Resolved BYOK key', undefined, {
          providerId,
          userId,
        });
        return userKey;
      }
    } catch (err) {
      logger.warn('[ProviderFactory] BYOK key resolution failed — using fallback', undefined, {
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Platform fallback
  if (platformFallback) {
    logger.debug('[ProviderFactory] Using platform API key', undefined, { providerId });
    return platformFallback;
  }

  return null;
}

// ── Provider creation ──────────────────────────────────────────────────────────

/**
 * Create a single provider instance from config + resolved key.
 *
 * @internal
 */
function createProvider(config: ProviderConfig, apiKey: string): Provider {
  switch (config.id) {
    case 'openrouter':
      return new OpenRouterProvider({
        apiKey,
        baseUrl: config.baseUrl,
        label: config.label,
      });

    case 'anthropic':
      return new AnthropicProvider({
        apiKey,
        label: config.label,
      });

    default:
      throw new Error(`[ProviderFactory] Unsupported provider: ${config.id}`);
  }
}

// ── Singleton registry (module-level) ─────────────────────────────────────────

/** Module-level registry shared across the application. */
let sharedRegistry: ProviderRegistry | null = null;

/**
 * Get or create the shared provider registry.
 *
 * The registry is a singleton — calling this multiple times returns
 * the same instance after the first call.
 */
export function getSharedRegistry(): ProviderRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new ProviderRegistry();
    logger.info('[ProviderFactory] Created shared ProviderRegistry');
  }
  return sharedRegistry;
}

/**
 * Reset the shared registry (useful for testing).
 */
export function resetSharedRegistry(): void {
  sharedRegistry = null;
}
