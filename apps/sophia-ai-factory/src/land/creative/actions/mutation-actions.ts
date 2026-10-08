/**
 * @file mutation-actions.ts
 * @description Authenticated Server Actions for Darwinian Creative Mutator Cockpit
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import {
  TriggerMutationInputSchema,
  type TriggerMutationInput,
  type CreativeMutationRecord,
} from '@/seed/types/creative-mutator-types';
import { listUserMutations, getMutationById } from '@/tree/creative/mutation-store';
import { logger } from '@/seed/utils/logger-utility';

export async function triggerMutationAction(
  rawInput: TriggerMutationInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized: User session required' };
    }

    const parsed = TriggerMutationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    await inngest.send({
      name: 'creative.mutation.requested',
      data: {
        userId: user.id,
        parentJobId: parsed.data.parentJobId,
        generation: parsed.data.generation,
        mutationIntensity: parsed.data.mutationIntensity,
        triggerReason: parsed.data.triggerReason,
        customOverrides: parsed.data.customOverrides,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger creative mutation', { err });
    return { success: false, error: 'Failed to dispatch mutation event' };
  }
}

export async function fetchUserMutationsAction(
  limit = 50,
): Promise<{ success: boolean; data?: CreativeMutationRecord[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const mutations = await listUserMutations(user.id, limit);
    return { success: true, data: mutations };
  } catch (err) {
    logger.error('Failed to fetch user mutations', { err });
    return { success: false, error: 'Failed to retrieve mutations' };
  }
}

export async function fetchMutationDetailAction(
  mutationId: string,
): Promise<{ success: boolean; data?: CreativeMutationRecord; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const mutation = await getMutationById(mutationId, user.id);
    if (!mutation) {
      return { success: false, error: 'Mutation not found' };
    }

    return { success: true, data: mutation };
  } catch (err) {
    logger.error('Failed to fetch mutation detail', { err, mutationId });
    return { success: false, error: 'Failed to retrieve mutation detail' };
  }
}
