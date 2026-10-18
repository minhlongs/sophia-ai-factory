'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { UserProfileFormValues, userProfileFormSchema } from '@/land/schemas/settings';
import { EncryptedApiKeys } from '@/seed/types/user';
import {
  buildDefaultUserProfileFormValues,
  mapRecordToUserProfileFormValues,
  mergeAndEncryptApiKeys,
  parseEncryptedApiKeys,
} from './settings-helpers';

/**
 * Fetch the current user's profile, including settings and masked API keys.
 * Uses Better Auth sessions (D1).
 */
export async function getUserProfile(): Promise<UserProfileFormValues> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Validate org membership
  const orgResult = await requireOrgMembership(user.id);
  if (!orgResult.authorized) {
    throw new Error(orgResult.error);
  }

  try {
    const db = createServerClient();
    const { data } = await db
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      return mapRecordToUserProfileFormValues(user, data as Record<string, unknown>);
    }
  } catch {
    // user_profiles table may not exist yet in D1
  }

  return buildDefaultUserProfileFormValues(user);
}

/**
 * Update user profile settings and API keys
 */
export async function updateUserProfile(data: UserProfileFormValues) {
  const result = userProfileFormSchema.safeParse(data);

  if (!result.success) {
    return { error: 'Invalid form data', details: result.error.flatten() };
  }

  const { settings, apiKeys, fullName } = result.data;
  const user = await getCurrentUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const orgResult = await requireOrgMembership(user.id);
  if (!orgResult.authorized) {
    return { error: orgResult.error };
  }

  const db = createServerClient();

  try {
    if (fullName !== user.full_name) {
      await db.from('users').update({ full_name: fullName }).eq('id', user.id);
    }

    let currentKeys: EncryptedApiKeys = {};
    try {
      const { data: currentData } = await db
        .from('user_profiles')
        .select('api_keys')
        .eq('user_id', user.id)
        .single();

      if (currentData) {
        currentKeys = parseEncryptedApiKeys((currentData as Record<string, unknown>).api_keys);
      }
    } catch {
      // profile may not exist yet
    }

    const newEncryptedKeys = await mergeAndEncryptApiKeys(currentKeys, apiKeys);

    await db
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        settings: JSON.stringify(settings),
        api_keys: JSON.stringify(newEncryptedKeys),
        updated_at: new Date().toISOString(),
      });

    revalidatePath('/settings');
    return { success: true };
  } catch {
    return { error: 'Failed to update profile' };
  }
}
