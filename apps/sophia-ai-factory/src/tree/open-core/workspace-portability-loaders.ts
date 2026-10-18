/**
 * D1 Read Loaders & Validators for Open-Core Workspace Portability
 *
 * Layer: tree/open-core
 * @module tree/open-core/workspace-portability-loaders
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { get as getTenantNamespace } from '@/seed/tenant-settings/registry';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { listUserProviders } from '@/tree/credentials/user-credentials-repo';
import type {
  AllowedPortableProvider,
  PortableChannelPreset,
} from './workspace-portability';

const PORTABLE_PROVIDER_SET: ReadonlySet<AllowedPortableProvider> = new Set([
  'openrouter',
  'elevenlabs',
  'heygen',
  'did',
  'resend',
  'nowpayments',
]);

export function normalizeProviderSlug(raw: string): AllowedPortableProvider | null {
  const lowered = raw.trim().toLowerCase();
  const mapped = lowered === 'd-id' ? 'did' : lowered;
  return PORTABLE_PROVIDER_SET.has(mapped as AllowedPortableProvider)
    ? (mapped as AllowedPortableProvider)
    : null;
}

export function isValidPreset(item: unknown): item is PortableChannelPreset {
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

export async function loadProfileSettings(userId: string): Promise<{
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
    const p = (
      typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings
    ) as Record<string, unknown>;
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

export async function loadConfiguredProviders(
  userId: string,
): Promise<AllowedPortableProvider[]> {
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
    creds
      .filter((c) => c.status === 'active')
      .forEach((c) => {
        const norm = normalizeProviderSlug(c.provider);
        if (norm) providerSet.add(norm);
      });
  } catch {
    // Non-fatal
  }
  return Array.from(providerSet);
}

export async function loadChannelPresets(
  userId: string,
): Promise<PortableChannelPreset[]> {
  try {
    const d1 = await getD1();
    if (!d1) return [];
    const misc = await getTenantNamespace<Record<string, unknown>>(d1, userId, 'misc');
    return Array.isArray(misc?.channelPresets)
      ? misc.channelPresets.filter(isValidPreset)
      : [];
  } catch {
    return [];
  }
}
