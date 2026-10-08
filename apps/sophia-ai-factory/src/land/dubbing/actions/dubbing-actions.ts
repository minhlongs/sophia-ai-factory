/**
 * @file dubbing-actions.ts
 * @description Authenticated Server Actions for Multilingual Dubbing & Lip-Sync Lineage
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import {
  TriggerDubbingInputSchema,
  type TriggerDubbingInput,
  type LocalizedLineageRecord,
} from '@/seed/types/viral-expansion-types';
import { listUserDubbingLineages } from '@/tree/dubbing/dubbing-store';
import { logger } from '@/seed/utils/logger-utility';

export async function triggerDubbingAction(
  rawInput: TriggerDubbingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized: User session required' };
    }

    const parsed = TriggerDubbingInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    await inngest.send({
      name: 'multilingual.dubbing.requested',
      data: {
        userId: user.id,
        parentVideoJobId: parsed.data.parentVideoJobId,
        targetLocales: parsed.data.targetLocales,
        preserveDuration: parsed.data.preserveDuration,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger multilingual dubbing', { err });
    return { success: false, error: 'Failed to dispatch dubbing event' };
  }
}

export async function fetchUserDubbingLineagesAction(
  limit = 50,
): Promise<{ success: boolean; data?: LocalizedLineageRecord[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const lineages = await listUserDubbingLineages(user.id, limit);
    return { success: true, data: lineages };
  } catch (err) {
    logger.error('Failed to fetch user dubbing lineages', { err });
    return { success: false, error: 'Failed to retrieve lineages' };
  }
}
