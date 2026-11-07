/**
 * Credential resolution helpers for ServiceFactory (BYOK + env fallback).
 * @module land/services/factory-key-resolvers
 */

import { MissingCredentialsError } from './errors';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';

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
 * Resolves user key first; falls back to env. An unreadable stored key fails
 * closed rather than being treated as absent, so the platform key is never
 * spent while the customer's own credential state is unknown.
 * Returns null → mock.
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
  const lookup = await lookupUserApiKey(userId, provider);
  if (lookup.status !== 'FOUND' && lookup.status !== 'NOT_CONFIGURED') {
    // Key-store failure: fail closed, log, return the caller's fallback as null.
    logger.warn(`[ServiceFactory] ${envName} credential could not be read for user`, {
      status: lookup.status,
    });
    return null;
  }
  const key = lookup.status === 'FOUND' ? lookup.key : envKey;
  if (!key) {
    if (isProd) throw new MissingCredentialsError(envName);
    logger.warn(`[ServiceFactory] ${envName} not resolvable for user — falling back to mock service (dev/staging only)`);
    return null;
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
    const lookup = await lookupUserApiKey(userId, 'heygen');
    if (lookup.status !== 'FOUND' && lookup.status !== 'NOT_CONFIGURED') {
      // An unreadable key is not an absent one: spending the env fallback here
      // would bill us for a call the customer believes is running on their key.
      logger.warn('[ServiceFactory] HEYGEN_API_KEY credential could not be read for user', {
        status: lookup.status,
      });
      return null;
    }
    const key = lookup.status === 'FOUND' ? lookup.key : envKey;
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
    const lookup = await lookupUserApiKey(userId, 'replicate');
    if (lookup.status !== 'FOUND' && lookup.status !== 'NOT_CONFIGURED') {
      logger.warn('[ServiceFactory] REPLICATE_API_TOKEN credential could not be read for user', {
        status: lookup.status,
      });
      return null;
    }
    const key = lookup.status === 'FOUND' ? lookup.key : envKey;
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
