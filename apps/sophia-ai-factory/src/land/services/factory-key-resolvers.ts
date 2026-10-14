/**
 * Credential resolution helpers for ServiceFactory (BYOK + env fallback).
 * @module land/services/factory-key-resolvers
 */

import { MissingCredentialsError } from './errors';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';

export const isProd = process.env.NODE_ENV === 'production';
export const isExplicitMock = process.env.NEXT_PUBLIC_MOCK_AI_SERVICES === 'true';

/**
 * Per-service credential gate (sync, for env-only path).
 */
export function requireKey(name: string): boolean {
  if (isExplicitMock) return false;
  const value = process.env[name]?.trim();
  if (value) return true;
  if (isProd) throw new MissingCredentialsError(name);
  logger.warn(`[ServiceFactory] ${name} not set — falling back to mock service (dev/staging only)`);
  return false;
}

/**
 * Async credential gate for ByokProvider-registered providers (openrouter, elevenlabs, etc.).
 * Resolves user key first; falls back to env. Returns null → mock.
 */
export async function resolveKey(
  envName: string,
  provider: Parameters<typeof resolveUserApiKey>[1],
  userId?: string,
): Promise<string | null> {
  if (isExplicitMock) return null;
  const envKey = process.env[envName]?.trim() || undefined;
  if (!userId) {
    if (envKey) return envKey;
    if (isProd) throw new MissingCredentialsError(envName);
    logger.warn(`[ServiceFactory] ${envName} not set — falling back to mock service (dev/staging only)`);
    return null;
  }
  const key = await resolveUserApiKey(userId, provider, envKey);
  if (!key) {
    if (isProd) throw new MissingCredentialsError(envName);
    logger.warn(`[ServiceFactory] ${envName} not resolvable for user — falling back to mock service (dev/staging only)`);
  }
  return key;
}

/**
 * Async credential gate for 'heygen'.
 */
export async function resolveHeygenKey(userId?: string): Promise<string | null> {
  if (isExplicitMock) return null;
  const envKey = process.env['HEYGEN_API_KEY']?.trim() || null;
  if (!userId) {
    if (envKey) return envKey;
    if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY');
    logger.warn('[ServiceFactory] HEYGEN_API_KEY not set — falling back to mock service (dev/staging only)');
    return null;
  }
  if (isByokEnabled()) {
    const userKey = await getUserApiKey(userId, 'heygen');
    const key = userKey ?? envKey;
    if (!key) {
      if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY');
      logger.warn('[ServiceFactory] HEYGEN_API_KEY not resolvable for user — falling back to mock service (dev/staging only)');
    }
    return key;
  }
  if (!envKey) {
    if (isProd) throw new MissingCredentialsError('HEYGEN_API_KEY');
    logger.warn('[ServiceFactory] HEYGEN_API_KEY not set — falling back to mock service (dev/staging only)');
  }
  return envKey;
}

/**
 * Async credential gate for 'replicate'.
 */
export async function resolveReplicateKey(userId?: string): Promise<string | null> {
  if (isExplicitMock) return null;
  const envKey = process.env['REPLICATE_API_TOKEN']?.trim() || null;
  if (!userId) {
    if (envKey) return envKey;
    if (isProd) throw new MissingCredentialsError('REPLICATE_API_TOKEN');
    logger.warn('[ServiceFactory] REPLICATE_API_TOKEN not set — falling back to mock service (dev/staging only)');
    return null;
  }
  if (isByokEnabled()) {
    const userKey = await getUserApiKey(userId, 'replicate');
    const key = userKey ?? envKey;
    if (!key) {
      if (isProd) throw new MissingCredentialsError('REPLICATE_API_TOKEN');
      logger.warn('[ServiceFactory] REPLICATE_API_TOKEN not resolvable for user — falling back to mock service (dev/staging only)');
    }
    return key;
  }
  if (!envKey) {
    if (isProd) throw new MissingCredentialsError('REPLICATE_API_TOKEN');
    logger.warn('[ServiceFactory] REPLICATE_API_TOKEN not set — falling back to mock service (dev/staging only)');
  }
  return envKey;
}
