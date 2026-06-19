/**
 * User Domain Types
 *
 * Database row types for user profiles, sessions, telegram mappings.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/user
 */

import { Json } from './json';

// User profile (from user_profiles table)
export interface UserProfileRow {
  user_id: string;
  telegram_chat_id: string | null;
  settings: Json | null;
  api_keys: Json | null;
  subscription_tier: 'free' | 'pro' | 'enterprise' | 'basic' | 'premium' | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileInsert {
  user_id: string;
  telegram_chat_id?: string | null;
  settings?: Json | null;
  api_keys?: Json | null;
  subscription_tier?: 'free' | 'pro' | 'enterprise' | 'basic' | 'premium' | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// User session (for stateful operations)
export interface UserSessionRow {
  id?: string;
  telegram_chat_id: string;
  state: string;
  context_data: Json;
  last_event?: string | null;
  subscription_tier?: string | null;
  auth_cache?: Json;
  expires_at?: string | null;
  updated_at: string;
  created_at?: string;
}

// Telegram user mapping
export interface TelegramUserMappingRow {
  id?: string;
  telegram_chat_id: string;
  user_id: string;
  subscription_tier?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TelegramUserMappingInsert {
  telegram_chat_id: string;
  user_id: string;
  subscription_tier?: string | null;
}

export interface TelegramUserMappingUpdate {
  user_id?: string;
  subscription_tier?: string | null;
  updated_at?: string;
}

// API keys (encrypted storage in user_profiles.api_keys)
export interface EncryptedApiKeys {
  openai?: string;
  anthropic?: string;
  elevenlabs?: string;
}
