/**
 * Settings Server Action Helpers
 *
 * Pure formatting and encryption helpers for user profile settings.
 */

import { encrypt } from '@/seed/security/encryption-aes-gcm';
import { type UserProfileFormValues } from '@/land/schemas/settings';
import { type EncryptedApiKeys } from '@/seed/types/user';

export function parseEncryptedApiKeys(rawKeys: unknown): EncryptedApiKeys {
  if (typeof rawKeys === 'string') {
    return JSON.parse(rawKeys) as EncryptedApiKeys;
  }
  return (rawKeys || {}) as EncryptedApiKeys;
}

export function buildDefaultUserProfileFormValues(user: {
  full_name?: unknown;
  email?: string | null;
}): UserProfileFormValues {
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

export function mapRecordToUserProfileFormValues(
  user: { full_name?: unknown; email?: string | null },
  profile: Record<string, unknown>,
): UserProfileFormValues {
  const apiKeys = parseEncryptedApiKeys(profile.api_keys);
  const rawSettings = profile.settings;
  const settings =
    typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings || {};

  const maskedKeys = {
    openai: apiKeys.openai ? '********' : '',
    anthropic: apiKeys.anthropic ? '********' : '',
    elevenlabs: apiKeys.elevenlabs ? '********' : '',
  };

  const theme =
    settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system'
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

export async function mergeAndEncryptApiKeys(
  currentKeys: EncryptedApiKeys,
  apiKeys: UserProfileFormValues['apiKeys'],
): Promise<EncryptedApiKeys> {
  const nextKeys: EncryptedApiKeys = { ...currentKeys };
  const providers = ['openai', 'anthropic', 'elevenlabs'] as const;

  for (const provider of providers) {
    const val = apiKeys[provider];
    if (val && val !== '********') {
      nextKeys[provider] = await encrypt(val);
    } else if (val === '') {
      delete nextKeys[provider];
    }
  }

  return nextKeys;
}
