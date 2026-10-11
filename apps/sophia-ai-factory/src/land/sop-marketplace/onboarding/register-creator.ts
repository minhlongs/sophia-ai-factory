'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreateCreatorProfileInput } from '@/seed/db/marketplace-ops';
import {
  createCreatorProfile as dbCreateCreatorProfile,
  getCreatorProfile as dbGetCreatorProfile,
} from '@/seed/db/marketplace-ops';
import { validateInviteCode } from '../beta-invites';
import type { CreatorError } from './types';
import { registerSchema } from './schemas';

/**
 * Register as a creator on the platform.
 * Requires authentication. Optionally validates a beta invite code.
 */
export async function registerCreator(formData: {
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  payoutMethod: 'nowpayments' | 'stripe_connect' | 'usdt';
  payoutAddress: string;
  inviteCode?: string;
}): Promise<Result<{ profileId: string }, CreatorError>> {
  try {
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Validate input
    const parsed = registerSchema.safeParse(formData);
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

    // Check if already registered
    const existing = await dbGetCreatorProfile(d1, user.id);
    if (existing) {
      return failure({
        code: 'ALREADY_REGISTERED',
        message: 'You are already registered as a creator',
      });
    }

    // Validate invite code if provided
    if (parsed.data.inviteCode) {
      const inviteResult = await validateInviteCode(d1, parsed.data.inviteCode);
      if (!inviteResult.valid) {
        const reasonMessages: Record<string, string> = {
          not_found: 'Invite code not found',
          expired: 'Invite code has expired',
          exhausted: 'Invite code has already been used',
        };
        return failure({
          code: 'INVITE_INVALID',
          message: reasonMessages[inviteResult.reason ?? 'not_found'] ?? 'Invalid invite code',
        });
      }
    }

    // Build DB input — map camelCase form fields to snake_case DB keys
    const dbInput: CreateCreatorProfileInput = {
      user_id: user.id,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio ?? null,
      avatar_url: parsed.data.avatarUrl?.trim() || null,
      payout_method: parsed.data.payoutMethod,
      payout_address: parsed.data.payoutAddress,
      status: 'pending',
    };

    // Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    const profile = await dbCreateCreatorProfile(d1, dbInput, tenantId);

    logger.info('[RegisterCreator] Creator profile created', {
      userId: user.id,
      profileId: profile.id,
      tenantId,
    });

    return success({ profileId: profile.id });
  } catch (err) {
    logger.error('[RegisterCreator] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
