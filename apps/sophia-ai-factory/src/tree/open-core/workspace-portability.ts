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
import {
  BUNDLE_INTEGRITY_CONTEXT,
  normalizePortableWorkspaceConfig,
  parseAndValidatePortableBundle,
} from './workspace-portability-validators';

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

/**
 * Exports a workspace configuration into a tamper-evident JSON bundle
 * ready for 1-click import into Sophia Managed Cloud.
 */
export async function exportWorkspaceBundle(
  config: Omit<PortableWorkspaceConfig, 'schemaVersion'>,
): Promise<SignedWorkspaceBundle> {
  const normalized = normalizePortableWorkspaceConfig(config);
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
  const parsed = parseAndValidatePortableBundle(rawBundle);
  if (!parsed.ok) {
    return failure(parsed.error);
  }

  const { config: typedConfig, checksumHex } = parsed.value;
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
