/**
 * Per-workspace ad network credential storage (BYOK).
 * Mirrors land/affiliates/credentials.ts — encrypts via AES-256-GCM.
 * All reads/writes are scoped to a single workspace (org_id).
 * @module land/adsense/credentials
 */

import { encryptToken, decryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { type AdNetworkType, SUPPORTED_AD_NETWORKS } from './types';
import {
  validateMembership,
  fetchEncrypted,
  upsertEncrypted,
  deleteByNetwork,
  listNetworks as listNetworksQuery,
} from './db-helpers';

function isAdNetworkType(value: string): value is AdNetworkType {
  return SUPPORTED_AD_NETWORKS.has(value);
}

/** Store (upsert) encrypted ad network credentials for a workspace. */
export async function storeAdNetworkCredentials(
  db: D1Database,
  userId: string,
  workspaceId: string,
  network: AdNetworkType,
  apiKey: string,
  partnerId: string,
  additionalConfig?: Record<string, string>,
): Promise<Result<void, { message: string }>> {
  if (!isAdNetworkType(network)) {
    return failure({ message: `Unsupported ad network: ${network}` });
  }
  if (!(await validateMembership(db, workspaceId, userId))) {
    return failure({ message: 'Not authorized: not a member of this workspace' });
  }

  const payload = JSON.stringify({ apiKey, partnerId, additionalConfig });
  const encrypted = await encryptToken(payload);
  await upsertEncrypted(db, workspaceId, network, encrypted);

  return success(undefined);
}

/** Retrieve and decrypt ad network credentials. Returns null if not stored. */
export async function getAdNetworkCredentials(
  db: D1Database,
  userId: string,
  workspaceId: string,
  network: AdNetworkType,
): Promise<Result<import('./types').AdNetworkCredentials | null, { message: string }>> {
  if (!isAdNetworkType(network)) {
    return failure({ message: `Unsupported ad network: ${network}` });
  }
  if (!(await validateMembership(db, workspaceId, userId))) {
    return failure({ message: 'Not authorized: not a member of this workspace' });
  }

  const encrypted = await fetchEncrypted(db, workspaceId, network);
  if (!encrypted) return success(null);

  try {
    const decrypted = await decryptToken(encrypted);
    const parsed = JSON.parse(decrypted) as {
      apiKey: string;
      partnerId: string;
      additionalConfig?: Record<string, string>;
    };
    return success({
      network,
      apiKey: parsed.apiKey,
      partnerId: parsed.partnerId,
      additionalConfig: parsed.additionalConfig,
    });
  } catch (err) {
    logger.error(
      '[ad-network-credentials] Decrypt failed',
      err instanceof Error ? err : undefined,
    );
    return failure({ message: 'Failed to decrypt stored credentials' });
  }
}

/** Delete stored ad network credentials for a workspace. */
export async function deleteAdNetworkCredentials(
  db: D1Database,
  userId: string,
  workspaceId: string,
  network: AdNetworkType,
): Promise<Result<void, { message: string }>> {
  if (!isAdNetworkType(network)) {
    return failure({ message: `Unsupported ad network: ${network}` });
  }
  if (!(await validateMembership(db, workspaceId, userId))) {
    return failure({ message: 'Not authorized: not a member of this workspace' });
  }

  await deleteByNetwork(db, workspaceId, network);
  return success(undefined);
}

/** List all ad network types stored for a workspace. */
export async function listAdNetworks(
  db: D1Database,
  userId: string,
  workspaceId: string,
): Promise<Result<AdNetworkType[], { message: string }>> {
  if (!(await validateMembership(db, workspaceId, userId))) {
    return failure({ message: 'Not authorized: not a member of this workspace' });
  }

  const networks = await listNetworksQuery(db, workspaceId);
  return success(networks.filter(isAdNetworkType));
}