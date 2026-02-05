# Research Report: Settings Page Implementation Best Practices
**Date:** 2026-02-05
**Context:** Next.js 16 App Router, Supabase, Tailwind CSS 4

## Executive Summary
For the Sophia AI Factory settings page, we recommend a **hybrid architecture** using Server Components for data fetching and Client Components for interactivity. User preferences should be stored in a dedicated `profiles` table in Supabase, not `auth.users` metadata. API keys must be encrypted at rest. Theme management should leverage `next-themes` with Tailwind 4's native CSS variable support.

---

## 1. Next.js 16 App Router Patterns

### Architecture: Server Data, Client Interactivity
The optimal pattern for settings pages in Next.js 16 separates data fetching from user interaction.

*   **Server Component (`page.tsx`)**:
    *   Fetches user profile, settings, and masked API keys directly from Supabase.
    *   Verifies authentication and permissions.
    *   Passes initial data to the Client Component.
*   **Client Component (`SettingsForm.tsx`)**:
    *   Manages local state for form inputs (optimistic UI).
    *   Uses **Server Actions** for all mutations (saving settings, updating keys).
    *   Handles validation (Zod) and toast notifications.

### Server Actions for Mutations
Instead of API routes, use Server Actions for type-safe, direct backend logic.

```typescript
// actions/update-settings.ts
'use server'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateSettings(formData: SettingsSchema) {
  const supabase = await createClient()
  // ... validation & update logic ...
  revalidatePath('/settings') // Refresh UI with new server data
}
```

---

## 2. Supabase Data Strategy: Metadata vs. Profiles

### 🔴 Avoid `auth.users.user_metadata`
*   **Pros**: Accessible in session/JWT.
*   **Cons**: Not meant for frequent application-data updates; limited querying capabilities; messy to manage via SQL triggers; strict size limits.
*   **Verdict**: Use only for static auth info (e.g., `avatar_url`, `full_name` from OAuth).

### 🟢 Recommended: `public.profiles` Table
Create a `profiles` table linked 1:1 with `auth.users`.

*   **Structure**:
    *   `id` (references `auth.users.id`)
    *   `updated_at`
    *   `preferences` (JSONB) - Flexible storage for UI themes, notification toggles.
    *   `api_keys` (Encrypted/Separate Table) - See Section 4.

**Implementation**:
Use a Postgres Trigger on `auth.users` creation to automatically insert a row into `public.profiles`.

---

## 3. Theme Management (Tailwind 4 + Next.js)

### Integration
Tailwind CSS 4 relies heavily on native CSS variables. `next-themes` is the standard library for managing the `.dark` class or `data-theme` attribute on the `<html>` tag.

*   **Provider**: Wrap the app in `<ThemeProvider attribute="class">`.
*   **Component**: Use `useTheme()` hook for the toggle switch.
*   **Persistence**: `next-themes` handles `localStorage` automatically.

### Tailwind 4 Specifics
Ensure your CSS variables in `globals.css` adapt to the selector used by `next-themes`.

```css
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

/* Light Mode (Default) */
:root {
  --background: #ffffff;
  --foreground: #171717;
}

/* Dark Mode */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

---

## 4. API Key Security

### Storage & Encryption
**NEVER** store API keys in plain text.

1.  **Encryption**: Use `pgcrypto` in Postgres or application-level encryption (e.g., `aes-256-gcm`) before saving to the database.
2.  **Schema**: Consider a separate table `user_api_keys` to allow multiple keys per provider.
    *   `id`, `user_id`, `provider` (e.g., 'openai'), `key_hash` (for lookups), `encrypted_key`, `mask` (e.g., 'sk-...482s').

### Display & Overrides
*   **Read**: Never return the full key to the client after initial creation. Return only the `mask` or last 4 characters.
*   **Write**: Input field should be empty or show placeholder "••••••••". Only update if the user enters a new value.
*   **Overrides**: Logic in backend services should check: `User Key > Org Key > System Default Key`.

---

## 5. Notification Preferences

### Data Structure (JSONB)
Using a JSONB column in `profiles` allows easy extension without schema migrations.

```json
// profiles.preferences
{
  "notifications": {
    "email": {
      "marketing": false,
      "security": true,
      "usage_alerts": true
    },
    "telegram": {
      "enabled": true,
      "chat_id": "123456789"
    }
  }
}
```

### UX Patterns
*   **Optimistic UI**: Toggle switches should flip immediately. Revert if the Server Action fails.
*   **Granularity**: Group notifications by channel (Email, Telegram, In-App) and type (Security, Updates, Promos).

---

## Unresolved Questions / Next Steps
1.  **Encryption Key Management**: Where will the master key for API encryption be stored? (Env var `API_ENCRYPTION_KEY` recommended).
2.  **Telegram Integration**: Need to define the handshake flow for linking a Telegram `chat_id` to a Supabase user.

## Sources
- [Next.js Server Actions Docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Supabase Manage User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Next-Themes GitHub](https://github.com/pacocoursey/next-themes)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
