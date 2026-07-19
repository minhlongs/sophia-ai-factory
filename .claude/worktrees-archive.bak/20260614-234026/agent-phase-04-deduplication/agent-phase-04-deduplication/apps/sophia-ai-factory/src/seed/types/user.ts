/**
 * User Profile Types
 * Matches the 'user_profiles' table in Supabase
 */

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: {
      marketing?: boolean;
      security?: boolean;
      updates?: boolean;
    };
    telegram?: {
      enabled?: boolean;
    };
  };
}

// Encrypted values stored in DB
export interface EncryptedApiKeys {
  openai?: string;
  anthropic?: string;
  elevenlabs?: string;
  heygen?: string;
  muapi?: string;
}

export interface UserProfile {
  user_id: string;
  telegram_chat_id?: string | null;
  settings: UserSettings;
  api_keys?: EncryptedApiKeys; // Only present if fetched with permission
  created_at: string;
  updated_at: string;
}

// Form values (decrypted/masked for UI)
export interface UserProfileFormData {
  full_name?: string; // Sourced from auth.users metadata if needed, or separate profile field
  settings: UserSettings;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    elevenlabs?: string;
  };
}
