import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorLicensingContract,
  CreateLicensingContractInput,
  ExecuteRoyaltySplitInput,
  RoyaltySettlementResult,
  CreatorRoyaltySettlement,
} from '@/seed/types/creator-dao-c2pa';
import {
  createLicensingContract,
  executeRoyaltySplitAndSettle,
  getCreatorContracts,
  listSettlements,
} from '@/tree/creators/royalty-split-engine';
import type { ActionResult } from './types';
import { requireAuthUser, getRequiredD1 } from './auth-helper';

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
