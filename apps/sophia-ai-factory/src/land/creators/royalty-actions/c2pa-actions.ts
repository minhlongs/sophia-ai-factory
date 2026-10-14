import { logger } from '@/seed/utils/logger-utility';
import type {
  C2paProvenanceManifestRecord,
  CreateC2paManifestInput,
  C2paVerificationResult,
} from '@/seed/types/creator-dao-c2pa';
import {
  signC2paManifest,
  verifyC2paManifest,
  getManifestByAssetId,
} from '@/tree/creators/c2pa-provenance-signer';
import type { ActionResult } from './types';
import { requireAuthUser, getRequiredD1 } from './auth-helper';

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
