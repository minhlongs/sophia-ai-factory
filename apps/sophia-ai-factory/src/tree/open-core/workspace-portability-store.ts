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

import { getD1 } from '@/seed/db/client';
import { merge as mergeTenantNamespace } from '@/seed/tenant-settings/registry';
import type {
  AllowedPortableProvider,
  PortableChannelPreset,
  PortableWorkspaceConfig,
} from './workspace-portability';
import {
  loadProfileSettings,
  loadConfiguredProviders,
  loadChannelPresets,
} from './workspace-portability-loaders';

export interface PersistedUserPortableState {
  readonly defaultLocale: 'vi' | 'en';
  readonly routingStrategy: 'priority' | 'costOptimized' | 'leastUsed';
  readonly configuredProviders: readonly AllowedPortableProvider[];
  readonly channelPresets: readonly PortableChannelPreset[];
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
