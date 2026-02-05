'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { encrypt } from '@/utils/encryption';
import { UserProfileFormValues, userProfileFormSchema } from '@/lib/schemas/settings';
import { UserSettings, EncryptedApiKeys } from '@/types/user';
import { Database } from '@/lib/supabase/types';

type ProfileRow = Database['public']['Tables']['user_profiles']['Row'];

/**
 * Fetch the current user's profile, including settings and masked API keys
 */
export async function getUserProfile(): Promise<UserProfileFormValues> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !data) {
    console.error('Error fetching profile:', profileError);
    // If profile doesn't exist yet (race condition with trigger), return default
    return {
      fullName: user.user_metadata?.full_name || '',
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

  const profile = data as ProfileRow;

  // Decrypt keys only to check existence/mask them (NEVER send full keys to client)
  const apiKeys = (profile.api_keys as unknown as EncryptedApiKeys) || {};
  const maskedKeys = {
    openai: apiKeys.openai ? '********' : '',
    anthropic: apiKeys.anthropic ? '********' : '',
    elevenlabs: apiKeys.elevenlabs ? '********' : '',
  };

  const currentSettings = (profile.settings as unknown as UserSettings) || {};

  // Ensure theme is one of the valid values
  const theme = (currentSettings.theme === 'light' || currentSettings.theme === 'dark' || currentSettings.theme === 'system')
    ? currentSettings.theme
    : 'system';

  return {
    fullName: user.user_metadata?.full_name || '',
    email: user.email || '',
    settings: {
      theme: theme,
      notifications: {
        email: {
          marketing: currentSettings.notifications?.email?.marketing ?? false,
          security: currentSettings.notifications?.email?.security ?? true,
          updates: currentSettings.notifications?.email?.updates ?? true,
        },
        telegram: {
          enabled: currentSettings.notifications?.telegram?.enabled ?? false,
        },
      },
    },
    apiKeys: maskedKeys,
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

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  try {
    // 1. Update Auth Metadata (Full Name)
    if (fullName !== user.user_metadata?.full_name) {
      await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
    }

    // 2. Handle API Keys Encryption
    // Only update keys that are provided (not empty strings if they were already set)
    // If the user sends "********", we ignore it (means no change)

    // First fetch existing keys to merge
    const { data: currentData } = await supabase
      .from('user_profiles')
      .select('api_keys')
      .eq('user_id', user.id)
      .single();

    const currentProfile = currentData as { api_keys: unknown } | null;
    const currentKeys = (currentProfile?.api_keys as EncryptedApiKeys) || {};
    const newEncryptedKeys: EncryptedApiKeys = { ...currentKeys };

    // Process each key type
    if (apiKeys.openai && apiKeys.openai !== '********') {
      newEncryptedKeys.openai = encrypt(apiKeys.openai);
    } else if (apiKeys.openai === '') {
       // If explicitly cleared (user deleted it), remove it?
       // Or usually UI handles "clear" separately.
       // For now, if empty string, we assume they might want to clear it OR it's just empty.
       // Let's assume empty string means "clear" if it wasn't masked.
       // But typically we don't want to clear if they just left it empty.
       // Logic: If it's empty string, we don't update it unless we want to support deleting.
       // Let's support deleting if the user passes a specific flag or we can assume empty = delete if user explicitly cleared it.
       // Ideally, the UI sends `undefined` for no change, and empty string for delete.
       // Zod schema allows optional or literal empty string.
       // Let's simplify: If it's not masked '********' and has value, update it.
       if (apiKeys.openai === '') delete newEncryptedKeys.openai;
    }

    if (apiKeys.anthropic && apiKeys.anthropic !== '********') {
      newEncryptedKeys.anthropic = encrypt(apiKeys.anthropic);
    } else if (apiKeys.anthropic === '') {
      delete newEncryptedKeys.anthropic;
    }

    if (apiKeys.elevenlabs && apiKeys.elevenlabs !== '********') {
      newEncryptedKeys.elevenlabs = encrypt(apiKeys.elevenlabs);
    } else if (apiKeys.elevenlabs === '') {
       delete newEncryptedKeys.elevenlabs;
    }

    // 3. Update Profile Table
    // Cast to any to bypass "Argument of type ... is not assignable to parameter of type 'never'"
    // This is likely a circular type reference issue in the Database definitions
    const { error: updateError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('user_profiles') as any)
      .update({
        settings: settings,
        api_keys: newEncryptedKeys,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    revalidatePath('/settings');
    return { success: true };

  } catch (error) {
    console.error('Update profile error:', error);
    return { error: 'Failed to update profile' };
  }
}
