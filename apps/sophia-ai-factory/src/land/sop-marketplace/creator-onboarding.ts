/**
 * Creator Onboarding Server Actions
 *
 * 'use server' module for creator registration and profile management.
 * Handles auth, input validation, invite code validation, and profile CRUD.
 *
 * @module land/sop-marketplace/creator-onboarding
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CreateCreatorProfileInput,
  CreatorProfile,
} from '@/seed/db/marketplace-ops';
import {
  createCreatorProfile as dbCreateCreatorProfile,
  getCreatorProfile as dbGetCreatorProfile,
  updateCreatorProfile as dbUpdateCreatorProfile,
} from '@/seed/db/marketplace-ops';
import { validateInviteCode } from './beta-invites';

// ── Public Types ─────────────────────────────────────────────────────────

export interface CreatorProfileView {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  payoutMethod: 'nowpayments' | 'stripe_connect' | 'usdt' | null;
  payoutAddress: string | null;
  totalEarningsCents: number;
  totalPaidCents: number;
  status: 'pending' | 'active' | 'suspended';
  createdAt: number;
}

type CreatorErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ALREADY_REGISTERED'
  | 'VALIDATION_ERROR'
  | 'INVITE_INVALID'
  | 'DB_ERROR'
  | 'PROFILE_NOT_FOUND';

interface CreatorError {
  code: CreatorErrorCode;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Map a DB CreatorProfile (snake_case) to a public CreatorProfileView (camelCase). */
function toView(profile: CreatorProfile): CreatorProfileView {
  return {
    id: profile.id,
    userId: profile.user_id,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    payoutMethod: profile.payout_method,
    payoutAddress: profile.payout_address,
    totalEarningsCents: profile.total_earnings_cents,
    totalPaidCents: profile.total_paid_cents,
    status: profile.status,
    createdAt: profile.created_at,
  };
}

// ── Validation Schemas ──────────────────────────────────────────────────

const registerSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  payoutMethod: z.enum(['nowpayments', 'stripe_connect', 'usdt']),
  payoutAddress: z.string().min(1, 'Payout address is required').max(256),
  inviteCode: z.string().max(20).optional(),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  payoutMethod: z.enum(['nowpayments', 'stripe_connect', 'usdt']).optional(),
  payoutAddress: z.string().min(1).max(256).optional(),
});

// ── Actions ─────────────────────────────────────────────────────────────

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
