'use server';

/**
 * Server Actions: Creator DAO Royalty Splits & C2PA Provenance
 *
 * Implements authenticated server mutations and queries for:
 * - Digital licensing contracts with Smart Split Waterfall (80/20 DAO & 70/30 Standard)
 * - Multi-currency micro-settlement execution with statutory contractor tax withholding
 * - Creator settlement history and contract ledger retrieval
 * - C2PA tamper-evident content provenance signing and 1-byte tamper verification
 *
 * Layer: land (Next.js 15 Server Actions, auth check, database dispatch)
 * Dependencies: @/seed/auth/better-auth-session, @/seed/db/client, @/seed/utils/logger-utility, @/tree/creators/*
 *
 * Rules:
 * - NO imports from @/forest
 * - NO :any types
 * - Structured error handling with ActionResult<T>
 *
 * @module land/creators/creator-royalty-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorLicensingContract,
  CreateLicensingContractInput,
  ExecuteRoyaltySplitInput,
  RoyaltySettlementResult,
  CreatorRoyaltySettlement,
  C2paProvenanceManifestRecord,
  CreateC2paManifestInput,
  C2paVerificationResult,
} from '@/seed/types/creator-dao-c2pa';
import {
  createLicensingContract,
  executeRoyaltySplitAndSettle,
  getCreatorContracts,
  listSettlements,
} from '@/tree/creators/royalty-split-engine';
import {
  signC2paManifest,
  verifyC2paManifest,
  getManifestByAssetId,
} from '@/tree/creators/c2pa-provenance-signer';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function requireAuthUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: Authentication required to perform creator operations.');
  }
  return user;
}

async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database connection unavailable.');
  }
  return db;
}

/**
 * Creates and cryptographically signs a digital licensing contract (80/20 DAO or 70/30 Standard).
 */
export async function createLicensingContractAction(
  input: CreateLicensingContractInput,
): Promise<ActionResult<CreatorLicensingContract>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const creatorId = input.creatorId || user.id;
    const contract = await createLicensingContract(db, {
      ...input,
      creatorId,
    });

    return { success: true, data: contract };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] createLicensingContractAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Executes a Smart Split Waterfall distribution and schedules a micro-settlement with tax withholding.
 */
export async function executeSplitSettlementAction(
  input: ExecuteRoyaltySplitInput,
): Promise<ActionResult<RoyaltySettlementResult>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const result = await executeRoyaltySplitAndSettle(db, {
      ...input,
      activatingUserId: input.activatingUserId || user.id,
    });

    return { success: result.success, data: result, error: result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] executeSplitSettlementAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Lists licensing contracts owned by a creator or DAO.
 */
export async function getCreatorContractsAction(
  creatorId?: string,
): Promise<ActionResult<CreatorLicensingContract[]>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();
    const targetCreatorId = creatorId || user.id;

    const contracts = await getCreatorContracts(db, targetCreatorId);
    return { success: true, data: contracts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] getCreatorContractsAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Lists micro-settlements filtered by creator and status.
 */
export async function listSettlementsAction(
  creatorId?: string,
  status?: string,
): Promise<ActionResult<CreatorRoyaltySettlement[]>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();
    const targetCreatorId = creatorId || user.id;

    const settlements = await listSettlements(db, targetCreatorId, status);
    return { success: true, data: settlements };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] listSettlementsAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Signs and stores a tamper-evident C2PA content provenance manifest for a video.
 */
export async function signC2paManifestAction(
  input: CreateC2paManifestInput,
): Promise<ActionResult<C2paProvenanceManifestRecord>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const creatorId = input.creatorId || user.id;
    const manifest = await signC2paManifest(db, {
      ...input,
      creatorId,
    });

    return { success: true, data: manifest };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] signC2paManifestAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Verifies a C2PA manifest against deepfakes and checks for 1-byte tamper modifications.
 */
export async function verifyC2paManifestAction(
  manifestId: string,
  assetSha256?: string,
): Promise<ActionResult<C2paVerificationResult>> {
  try {
    const db = await getRequiredD1();
    const verification = await verifyC2paManifest(db, manifestId, assetSha256);
    return { success: true, data: verification };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] verifyC2paManifestAction failed', { manifestId, error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves the C2PA manifest for an asset by assetId.
 */
export async function getAssetProvenanceAction(
  assetId: string,
): Promise<ActionResult<C2paProvenanceManifestRecord | null>> {
  try {
    const db = await getRequiredD1();
    const manifest = await getManifestByAssetId(db, assetId);
    return { success: true, data: manifest };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creator-royalty-actions] getAssetProvenanceAction failed', { assetId, error: message });
    return { success: false, error: message };
  }
}
