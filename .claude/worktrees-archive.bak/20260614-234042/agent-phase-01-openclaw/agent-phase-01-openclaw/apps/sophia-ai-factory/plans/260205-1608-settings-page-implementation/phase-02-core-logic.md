# Phase 2: Core Logic & Server Actions

## Context
Secure handling of data and type-safe mutations are critical. We need utilities to encrypt sensitive API keys before they hit the database and Server Actions to handle the form submissions.

## Requirements
- **Encryption**: AES-256-GCM (or similar) using a server-side secret (`API_ENCRYPTION_KEY`).
- **Validation**: Zod schemas for all inputs.
- **Server Actions**: `updateProfile` and `updateApiKeys`.

## Implementation Steps

1.  **Encryption Utility (`src/utils/encryption.ts`)**
    - `encrypt(text: string): string`
    - `decrypt(text: string): string`
    - **Note**: Ensure `process.env.API_ENCRYPTION_KEY` is set.

2.  **Zod Schemas (`src/lib/schemas/settings.ts`)**
    - `profileSchema`: Validation for name, preferences (notifications).
    - `apiKeySchema`: Validation for API key formats (sk-...).

3.  **Server Actions (`src/app/actions/settings.ts`)**
    - `getProfile()`: Fetch data for the server component.
    - `updateProfile(data: ProfileSchema)`: Update `profiles` table.
    - `updateApiKey(provider: string, key: string)`: Encrypt key and update `profiles` (or separate `user_api_keys` table if we decided on that).
    - **Revalidation**: `revalidatePath('/settings')` after updates.

## Deliverables
- [ ] `encryption.ts` utility.
- [ ] Zod schemas.
- [ ] `actions/settings.ts` with secure mutation logic.
