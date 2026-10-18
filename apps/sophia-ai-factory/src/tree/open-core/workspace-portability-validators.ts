/**
 * Workspace Portability Validation & Normalization Helpers
 * Layer: tree/open-core
 * @module tree/open-core/workspace-portability-validators
 */

import { success, failure, type Result } from '@/seed/types/result';
import type {
  AllowedPortableProvider,
  PortableChannelPreset,
  PortableWorkspaceConfig,
} from './workspace-portability';

export const BUNDLE_INTEGRITY_CONTEXT = 'sophia-open-core-workspace-portability-v1';

export const ALLOWED_PROVIDERS: ReadonlySet<string> = new Set([
  'openrouter', 'elevenlabs', 'heygen', 'did', 'resend', 'nowpayments',
]);

export function isValidChannelPreset(item: unknown): item is PortableChannelPreset {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.slug === 'string' &&
    p.slug.length > 0 &&
    typeof p.niche === 'string' &&
    (p.locale === 'vi' || p.locale === 'en') &&
    typeof p.cadencePerWeek === 'number' &&
    p.cadencePerWeek >= 0
  );
}

export function normalizePortableWorkspaceConfig(
  config: Omit<PortableWorkspaceConfig, 'schemaVersion'>,
): PortableWorkspaceConfig {
  return {
    schemaVersion: 'sophia-workspace-v1',
    exportedAt: config.exportedAt,
    sourceEdition: config.sourceEdition,
    defaultLocale: config.defaultLocale,
    routingStrategy: config.routingStrategy,
    configuredProviders: [...config.configuredProviders],
    channelPresets: [...config.channelPresets],
  };
}

export function parseAndValidatePortableBundle(
  rawBundle: unknown,
): Result<{ config: PortableWorkspaceConfig; checksumHex: string }, { code: string; message: string }> {
  if (!rawBundle || typeof rawBundle !== 'object') {
    return failure({ code: 'INVALID_BUNDLE', message: 'Workspace bundle must be a JSON object' });
  }

  const candidate = rawBundle as Record<string, unknown>;
  const config = candidate.config as Record<string, unknown> | undefined;
  const checksumHex = candidate.checksumHex;

  if (!config || typeof config !== 'object' || typeof checksumHex !== 'string') {
    return failure({ code: 'MALFORMED_BUNDLE', message: 'Missing config or checksumHex field' });
  }

  if (config.schemaVersion !== 'sophia-workspace-v1') {
    return failure({ code: 'UNSUPPORTED_SCHEMA', message: 'Unsupported workspace schemaVersion' });
  }

  const validLocales = ['vi', 'en'];
  const validStrategies = ['priority', 'costOptimized', 'leastUsed'];
  if (
    typeof config.defaultLocale !== 'string' ||
    !validLocales.includes(config.defaultLocale) ||
    typeof config.routingStrategy !== 'string' ||
    !validStrategies.includes(config.routingStrategy) ||
    !Array.isArray(config.configuredProviders) ||
    !config.configuredProviders.every((p) => typeof p === 'string' && ALLOWED_PROVIDERS.has(p)) ||
    !Array.isArray(config.channelPresets) ||
    !config.channelPresets.every(isValidChannelPreset)
  ) {
    return failure({ code: 'INVALID_CONFIG_FIELDS', message: 'Workspace config fields failed validation' });
  }

  const typedConfig: PortableWorkspaceConfig = {
    schemaVersion: 'sophia-workspace-v1',
    exportedAt: typeof config.exportedAt === 'number' ? config.exportedAt : 0,
    sourceEdition:
      config.sourceEdition === 'cloud' || config.sourceEdition === 'enterprise'
        ? config.sourceEdition
        : 'community',
    defaultLocale: config.defaultLocale as 'vi' | 'en',
    routingStrategy: config.routingStrategy as 'priority' | 'costOptimized' | 'leastUsed',
    configuredProviders: config.configuredProviders as AllowedPortableProvider[],
    channelPresets: config.channelPresets,
  };

  return success({ config: typedConfig, checksumHex });
}
