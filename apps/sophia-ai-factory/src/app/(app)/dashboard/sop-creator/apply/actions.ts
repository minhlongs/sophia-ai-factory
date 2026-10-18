'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  marketplaceTemporarilyUnavailableError,
} from '@/land/sop-marketplace/availability';
import {
  isValidCreatorApplicationInput,
  persistCreatorApplicationInDb,
  type ApplyError,
} from './creator-application-db';

export interface SubmitCreatorApplicationInput {
  website: string;
  niche: string;
  subscribers: string;
  monthlyViews: string;
  experience: string;
  whyJoin: string;
  sampleContent?: string;
}

export async function submitCreatorApplication(
  input: SubmitCreatorApplicationInput
): Promise<Result<{ applicationId: string }, ApplyError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      return failure(marketplaceTemporarilyUnavailableError());
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const { hasCreatorAccess } = await import('@/land/sop-marketplace');
    const hasAccess = await hasCreatorAccess(d1, user.id);
    if (hasAccess) {
      return failure({ code: 'ALREADY_HAS_ACCESS', message: 'You already have creator access' });
    }

    if (!isValidCreatorApplicationInput(input)) {
      return failure({ code: 'VALIDATION_ERROR', message: 'All required fields must be filled' });
    }

    const applicationId = await persistCreatorApplicationInDb(d1, user.id, input);

    logger.info('[SubmitCreatorApplication] Application submitted', {
      userId: user.id,
      applicationId,
      niche: input.niche,
      subscribers: input.subscribers,
    });

    const { revalidatePath, revalidateTag } = await import('next/cache');
    revalidatePath('/dashboard/sop-creator/apply');
    revalidatePath('/[locale]/dashboard/sop-creator/apply');
    revalidateTag('creator_applications', 'max');

    return success({ applicationId });
  } catch (err) {
    logger.error('[SubmitCreatorApplication] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
