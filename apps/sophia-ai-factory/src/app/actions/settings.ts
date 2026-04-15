'use server';

import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';
import { revalidatePath } from 'next/cache';
import { encrypt } from '@/utils/encryption';
import { UserProfileFormValues, userProfileFormSchema } from '@/lib/schemas/settings';
import { EncryptedApiKeys } from '@/types/user';

/**
 * Fetch the current user's profile, including settings and masked API keys.
 * Uses Better Auth sessions (D1).
 */
export async function getUserProfile(): Promise<UserProfileFormValues> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try to fetch profile from D1 user_profiles table
  try {
    const db = createServerClient();
    const { data } = await db
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      const profile = data as Record<string, unknown>;
      const rawKeys = profile.api_keys;
      const apiKeys = (typeof rawKeys === 'string' ? JSON.parse(rawKeys) : rawKeys || {}) as EncryptedApiKeys;
      const rawSettings = profile.settings;
      const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings || {};

      const maskedKeys = {
        openai: apiKeys.openai ? '********' : '',
        anthropic: apiKeys.anthropic ? '********' : '',
        elevenlabs: apiKeys.elevenlabs ? '********' : '',
      };

      const theme = (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system')
        ? settings.theme
        : 'system';

      return {
        fullName: (user.full_name as string) || '',
        email: user.email || '',
        settings: {
          theme,
          notifications: {
            email: {
              marketing: settings.notifications?.email?.marketing ?? false,
              security: settings.notifications?.email?.security ?? true,
              updates: settings.notifications?.email?.updates ?? true,
            },
            telegram: {
              enabled: settings.notifications?.telegram?.enabled ?? false,
            },
          },
        },
        apiKeys: maskedKeys,
      };
    }
  } catch {
    // user_profiles table may not exist yet in D1
  }

  // Default profile
  return {
    fullName: (user.full_name as string) || '',
    email: user.email || '',
    settings: {
      theme: 'system',
      notifications: {
        email: { marketing: false, security: true, updates: true },
        telegram: { enabled: false },
      },
    },
    apiKeys: { openai: '', anthropic: '', elevenlabs: '' },
  };
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

  try {
    const db = createServerClient();

    // Update user full_name in users table
    if (fullName !== user.full_name) {
      await db.from('users').update({ full_name: fullName }).eq('id', user.id);
    }

    // Fetch existing keys to merge
    let currentKeys: EncryptedApiKeys = {};
    try {
      const { data: currentData } = await db
        .from('user_profiles')
        .select('api_keys')
        .eq('user_id', user.id)
        .single();

      if (currentData) {
        const row = currentData as Record<string, unknown>;
        const rawKeys = row.api_keys;
        currentKeys = (typeof rawKeys === 'string' ? JSON.parse(rawKeys) : rawKeys || {}) as EncryptedApiKeys;
      }
    } catch {
      // profile may not exist yet
    }

    const newEncryptedKeys: EncryptedApiKeys = { ...currentKeys };

    if (apiKeys.openai && apiKeys.openai !== '********') {
      newEncryptedKeys.openai = await encrypt(apiKeys.openai);
    } else if (apiKeys.openai === '') {
      delete newEncryptedKeys.openai;
    }

    if (apiKeys.anthropic && apiKeys.anthropic !== '********') {
      newEncryptedKeys.anthropic = await encrypt(apiKeys.anthropic);
    } else if (apiKeys.anthropic === '') {
      delete newEncryptedKeys.anthropic;
    }

    if (apiKeys.elevenlabs && apiKeys.elevenlabs !== '********') {
      newEncryptedKeys.elevenlabs = await encrypt(apiKeys.elevenlabs);
    } else if (apiKeys.elevenlabs === '') {
      delete newEncryptedKeys.elevenlabs;
    }

    // Upsert profile
    await db
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          settings: JSON.stringify(settings),
          api_keys: JSON.stringify(newEncryptedKeys),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    revalidatePath('/settings');
    return { success: true };

  } catch {
    return { error: 'Failed to update profile' };
  }
}
