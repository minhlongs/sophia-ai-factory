/**
 * Runtime Brand Domain Synchronization (D1 -> Seed Allowlist Cache)
 * Layer: tree
 *
 * Loads ACTIVE brand domains for the current Worker from D1 and updates the
 * in-memory seed host allowlist (which in turn updates Better Auth's dynamic
 * allowedHosts in-place).
 *
 * Fail-safe: if D1 is unavailable or the brand_domains table has not yet been
 * migrated, the Worker continues serving its technical workers.dev address and
 * static Env ALLOWED_HOSTS without crashing.
 *
 * @module tree/brand-domains/runtime-sync
 */

import { getD1 } from '@/seed/db/client';
import {
  getTechnicalRuntimeIdentity,
  isDynamicHostCacheFresh,
  registerDynamicActiveHosts,
  type DomainEnvLike,
} from '@/seed/domain';
import { listActiveHostnamesForWorker } from './repository';

export async function syncActiveBrandDomainsFromD1(
  options?: {
    db?: D1Database | null;
    force?: boolean;
    env?: DomainEnvLike;
  },
): Promise<readonly string[]> {
  if (!options?.force && isDynamicHostCacheFresh()) {
    return [];
  }

  try {
    const db = options?.db !== undefined ? options.db : await getD1();
    if (!db) return [];

    const identity = getTechnicalRuntimeIdentity(options?.env);
    const activeHosts = await listActiveHostnamesForWorker(db, identity.workerName);
    registerDynamicActiveHosts(activeHosts);
    return activeHosts;
  } catch {
    // Table may not exist yet before migration 0518 is applied, or D1 may be
    // transiently unreachable. Keep technical workers.dev + Env ALLOWED_HOSTS active.
    return [];
  }
}
