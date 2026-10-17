/**
 * Self-Host to Sophia Cloud Workspace Portability (Export / Import)
 *
 * Allows developers testing the Apache-2.0 Community Edition locally to export
 * their non-sensitive workspace configuration (providers enabled, routing
 * strategy, channel presets, and locale) and import it into a paid
 * `https://sophia.agencyos.network` Cloud workspace in under 60 seconds.
 *
 * Security invariant: Raw BYOK API keys are NEVER exported in plaintext.
 *
 * Layer: tree/open-core
 * @module tree/open-core/workspace-portability
 */

import { computeHmacHex, timingSafeEqual } from '@/seed/security/signature-primitives';
import { success, failure, type Result } from '@/seed/types/result';

export type AllowedPortableProvider =
  | 'openrouter'
  | 'elevenlabs'
  | 'heygen'
  | 'did'
  | 'resend'
  | 'nowpayments';

export interface PortableChannelPreset {
  readonly slug: string;
  readonly niche: string;
  readonly locale: 'vi' | 'en';
  readonly cadencePerWeek: number;
}

export interface PortableWorkspaceConfig {
  readonly schemaVersion: 'sophia-workspace-v1';
  readonly exportedAt: number;
  readonly sourceEdition: 'community' | 'cloud' | 'enterprise';
  readonly defaultLocale: 'vi' | 'en';
  readonly routingStrategy: 'priority' | 'costOptimized' | 'leastUsed';
  readonly configuredProviders: readonly AllowedPortableProvider[];
  readonly channelPresets: readonly PortableChannelPreset[];
}

export interface SignedWorkspaceBundle {
  readonly config: PortableWorkspaceConfig;
  readonly checksumHex: string;
}

const BUNDLE_INTEGRITY_CONTEXT = 'sophia-open-core-workspace-portability-v1';
const ALLOWED_PROVIDERS: ReadonlySet<string> = new Set([
  'openrouter', 'elevenlabs', 'heygen', 'did', 'resend', 'nowpayments',
]);

function isValidChannelPreset(item: unknown): item is PortableChannelPreset {
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

/**
 * Exports a workspace configuration into a tamper-evident JSON bundle
 * ready for 1-click import into Sophia Managed Cloud.
 */
export async function exportWorkspaceBundle(
  config: Omit<PortableWorkspaceConfig, 'schemaVersion'>,
): Promise<SignedWorkspaceBundle> {
  const normalized: PortableWorkspaceConfig = {
    schemaVersion: 'sophia-workspace-v1',
    exportedAt: config.exportedAt,
    sourceEdition: config.sourceEdition,
    defaultLocale: config.defaultLocale,
    routingStrategy: config.routingStrategy,
    configuredProviders: [...config.configuredProviders],
    channelPresets: [...config.channelPresets],
  };

  const canonical = JSON.stringify(normalized);
  const checksumHex = await computeHmacHex(canonical, BUNDLE_INTEGRITY_CONTEXT, 'SHA-256');

  return { config: normalized, checksumHex };
}

/**
 * Validates and imports a portable workspace bundle on Sophia Cloud.
 */
export async function importWorkspaceBundle(
  rawBundle: unknown,
): Promise<Result<PortableWorkspaceConfig, { code: string; message: string }>> {
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

  const expectedChecksum = await computeHmacHex(
    JSON.stringify(typedConfig),
    BUNDLE_INTEGRITY_CONTEXT,
    'SHA-256',
  );

  if (!timingSafeEqual(expectedChecksum, checksumHex.toLowerCase())) {
    return failure({
      code: 'CHECKSUM_MISMATCH',
      message: 'Workspace bundle integrity checksum mismatch',
    });
  }

  return success(typedConfig);
}
