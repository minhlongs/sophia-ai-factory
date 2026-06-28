# Phase 1: Database & Schema Design

## Context
The `user_profiles` table already exists (Migration 004), linked to `auth.users`. It currently stores `telegram_chat_id` and `settings`. We need to add a dedicated column for secure API key storage.

## Requirements
- **Modify Table**: `user_profiles`
- **New Column**: `api_keys` (JSONB) - To store encrypted API keys (e.g., `{"openai": "enc_...", "anthropic": "enc_..."}`).
- **Security**: Ensure RLS policies still apply (they do, based on existing migration).
- **Types**: Update TypeScript definitions.

## Implementation Steps

1.  **Create Migration File**
    - `supabase/migrations/20260205163000_add_api_keys_to_profiles.sql`
    - `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}'::jsonb;`

2.  **Verify RLS Policies**
    - Existing policies in `004_user_profiles.sql` allow users to SELECT and UPDATE their own rows. This is sufficient.

3.  **Define Types**
    - Create `src/types/user.ts` (or update `index.ts`) to define `UserProfile`, `UserSettings`, and `UserApiKeys`.

## Deliverables
- [ ] SQL Migration script.
- [ ] TypeScript interfaces.
