'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreateCreatorProfileInput } from '@/seed/db/marketplace-ops';
import {
  getCreatorProfile as dbGetCreatorProfile,
  updateCreatorProfile as dbUpdateCreatorProfile,
} from '@/seed/db/marketplace-ops';
import type { CreatorProfileView, CreatorError } from './types';
import { toView, updateSchema } from './schemas';

/**
 * Get the authenticated user's creator profile.
 */
export async function getCreatorProfile(): Promise<Result<CreatorProfileView, CreatorError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const profile = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!profile) {
      return failure({ code: 'PROFILE_NOT_FOUND', message: 'Creator profile not found' });
    }

    return success(toView(profile));
  } catch (err) {
    logger.error('[GetCreatorProfile] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Update the authenticated user's creator profile.
 * Only provided fields are updated; undefined fields are left unchanged.
 */
export async function updateCreatorProfile(
  formData: Partial<{
    displayName: string;
    bio: string;
    avatarUrl: string;
    payoutMethod: 'nowpayments' | 'stripe_connect' | 'usdt';
    payoutAddress: string;
  }>,
): Promise<Result<{ profileId: string }, CreatorError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const parsed = updateSchema.safeParse(formData);
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    // Verify profile exists
    const existing = await dbGetCreatorProfile(d1, user.id, tenantId);
    if (!existing) {
      return failure({ code: 'PROFILE_NOT_FOUND', message: 'Creator profile not found' });
    }

    // Build update payload — only include explicitly provided fields
    const updateInput: Partial<CreateCreatorProfileInput> = {};

    if (parsed.data.displayName !== undefined) {
      updateInput.display_name = parsed.data.displayName;
    }
    if (parsed.data.bio !== undefined) {
      updateInput.bio = parsed.data.bio || null;
    }
    if (parsed.data.avatarUrl !== undefined) {
      updateInput.avatar_url = parsed.data.avatarUrl?.trim() || null;
    }
    if (parsed.data.payoutMethod !== undefined) {
      updateInput.payout_method = parsed.data.payoutMethod;
    }
    if (parsed.data.payoutAddress !== undefined) {
      updateInput.payout_address = parsed.data.payoutAddress;
    }

    const updated = await dbUpdateCreatorProfile(d1, user.id, updateInput, tenantId);
    if (!updated) {
      return failure({ code: 'DB_ERROR', message: 'Failed to update profile' });
    }

    logger.info('[UpdateCreatorProfile] Profile updated', {
      userId: user.id,
      profileId: updated.id,
      tenantId,
    });

    return success({ profileId: updated.id });
  } catch (err) {
    logger.error('[UpdateCreatorProfile] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
