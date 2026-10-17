/**
 * D1 Persistence Adapter for Open-Core Workspace Portability
 *
 * Reads and persists tenant-scoped, non-sensitive workspace configuration across
 * existing D1 tables (`user_profiles`, `user_api_keys`, `user_provider_credentials`,
 * and `tenant_settings`) without inventing new schema migrations or exposing
 * plaintext BYOK credentials.
 *
 * Layer: tree/open-core
 * @module tree/open-core/workspace-portability-store
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { get as getTenantNamespace, merge as mergeTenantNamespace } from '@/seed/tenant-settings/registry';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { listUserProviders } from '@/tree/credentials/user-credentials-repo';
import type {
  AllowedPortableProvider,
  PortableChannelPreset,
  PortableWorkspaceConfig,
} from './workspace-portability';

export interface PersistedUserPortableState {
  readonly defaultLocale: 'vi' | 'en';
  readonly routingStrategy: 'priority' | 'costOptimized' | 'leastUsed';
  readonly configuredProviders: readonly AllowedPortableProvider[];
  readonly channelPresets: readonly PortableChannelPreset[];
}

const PORTABLE_PROVIDER_SET: ReadonlySet<AllowedPortableProvider> = new Set([
  'openrouter', 'elevenlabs', 'heygen', 'did', 'resend', 'nowpayments',
]);

function normalizeProviderSlug(raw: string): AllowedPortableProvider | null {
  const lowered = raw.trim().toLowerCase();
  const mapped = lowered === 'd-id' ? 'did' : lowered;
  return PORTABLE_PROVIDER_SET.has(mapped as AllowedPortableProvider)
    ? (mapped as AllowedPortableProvider)
    : null;
}

function isValidPreset(item: unknown): item is PortableChannelPreset {
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

async function loadProfileSettings(userId: string): Promise<{
  defaultLocale: 'vi' | 'en';
  routingStrategy: 'priority' | 'costOptimized' | 'leastUsed';
}> {
  const db = createServerClient();
  if (!db) return { defaultLocale: 'vi', routingStrategy: 'priority' };
  try {
    const row = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>();
    if (!row?.settings) return { defaultLocale: 'vi', routingStrategy: 'priority' };
    const p = (typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings) as Record<string, unknown>;
    const defaultLocale = p?.locale === 'en' ? 'en' : 'vi';
    const routingStrategy =
      p?.routing_strategy === 'costOptimized' || p?.routing_strategy === 'leastUsed'
        ? p.routing_strategy
        : 'priority';
    return { defaultLocale, routingStrategy };
  } catch {
    return { defaultLocale: 'vi', routingStrategy: 'priority' };
  }
}

async function loadConfiguredProviders(userId: string): Promise<AllowedPortableProvider[]> {
  const providerSet = new Set<AllowedPortableProvider>();
  try {
    const byok = await listUserApiKeyProviders(userId);
    byok.forEach((p) => {
      const norm = normalizeProviderSlug(p);
      if (norm) providerSet.add(norm);
    });
  } catch {
    // Non-fatal
  }
  try {
    const creds = await listUserProviders(userId);
    creds.filter((c) => c.status === 'active').forEach((c) => {
      const norm = normalizeProviderSlug(c.provider);
      if (norm) providerSet.add(norm);
    });
  } catch {
    // Non-fatal
  }
  return Array.from(providerSet);
}

async function loadChannelPresets(userId: string): Promise<PortableChannelPreset[]> {
  try {
    const d1 = await getD1();
    if (!d1) return [];
    const misc = await getTenantNamespace<Record<string, unknown>>(d1, userId, 'misc');
    return Array.isArray(misc?.channelPresets) ? misc.channelPresets.filter(isValidPreset) : [];
  } catch {
    return [];
  }
}

/** Loads the authenticated user's persisted non-secret workspace configuration from D1. */
export async function loadUserPortableConfig(userId: string): Promise<PersistedUserPortableState> {
  const [{ defaultLocale, routingStrategy }, configuredProviders, channelPresets] = await Promise.all([
    loadProfileSettings(userId),
    loadConfiguredProviders(userId),
    loadChannelPresets(userId),
  ]);
  return { defaultLocale, routingStrategy, configuredProviders, channelPresets };
}

/** Persists an imported `PortableWorkspaceConfig` into `user_profiles` and `tenant_settings`. */
export async function saveUserPortableConfig(
  userId: string,
  config: PortableWorkspaceConfig,
): Promise<{ persisted: boolean }> {
  const d1 = await getD1();
  if (!d1) return { persisted: false };

  await d1
    .prepare(
      `INSERT INTO user_profiles (user_id, settings, updated_at)
       VALUES (?1, json_object('locale', ?2, 'routing_strategy', ?3), ?4)
       ON CONFLICT(user_id) DO UPDATE SET
         settings = json_set(COALESCE(user_profiles.settings, '{}'), '$.locale', ?2, '$.routing_strategy', ?3),
         updated_at = ?4`,
    )
    .bind(userId, config.defaultLocale, config.routingStrategy, Date.now())
    .run();

  await mergeTenantNamespace<Record<string, unknown>>(d1, userId, 'misc', {
    channelPresets: [...config.channelPresets],
  });
  return { persisted: true };
}
