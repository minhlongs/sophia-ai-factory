---
title: "User Settings Page Implementation"
description: "Implementation of the User Settings page within the Dashboard, including Profile, API Keys, and Notifications."
status: completed
priority: P2
effort: 3h
branch: master
tags: [settings, dashboard, ui, auth]
created: 2026-02-05
---

# User Settings Page Implementation Plan

## 1. Overview
This plan outlines the implementation of the `/dashboard/settings` page. The goal is to migrate and enhance the existing settings functionality into the main dashboard layout, ensuring persistent storage of user preferences in Supabase.

## 2. Architecture & Requirements

### 2.1 Database Schema
- **Table**: `public.user_profiles` (Existing)
- **Column**: `settings` (JSONB)
  - Structure:
    ```json
    {
      "theme": "system" | "light" | "dark",
      "notifications": {
        "email": { "marketing": boolean, "security": boolean, "updates": boolean },
        "telegram": { "enabled": boolean }
      }
    }
    ```
- **Column**: `api_keys` (JSONB)
  - Structure:
    ```json
    {
      "openai": "sk-...",
      "anthropic": "sk-...",
      "elevenlabs": "xi-..."
    }
    ```

### 2.2 Components
- **Page**: `src/app/dashboard/settings/page.tsx`
  - Replaces `src/app/settings/page.tsx`.
  - Uses `DashboardLayout` (automatic via file structure).
- **Form**: `src/components/settings/settings-form.tsx`
  - Needs updates:
    - Add **Email** field (Read-only).
    - Ensure **Theme** selection is explicitly managed in the form state and saved to DB.
- **Actions**: `src/app/actions/settings.ts`
  - Update `getUserProfile` to return user email from Auth.

## 3. Implementation Phases

### Phase 1: Setup & Core Structure (Completed)
- **Goal**: Create the route and ensure basic rendering within Dashboard.
- **Steps**:
  1. Create `src/app/dashboard/settings/page.tsx`.
  2. Copy logic from `src/app/settings/page.tsx` (fetching profile, rendering form).
  3. Verify the page renders correctly inside the Dashboard layout.

### Phase 2: Feature Enhancements (Completed)
- **Goal**: Add missing requirements (Email display, Theme persistence).
- **Steps**:
  1. **Schema Update**:
     - Modify `src/lib/schemas/settings.ts` to include `email` (string, optional/readonly) in `UserProfileFormValues`.
  2. **Action Update**:
     - Modify `getUserProfile` in `src/app/actions/settings.ts` to extract `email` from `supabase.auth.getUser()` and include it in the return object.
  3. **Form Update (`settings-form.tsx`)**:
     - Add a Read-only Input for Email in the "Profile" section.
     - Add a "Theme Preference" selection (Select/Radio) in the form to explicitly save the preference to the DB `settings.theme` field.
     - *Note*: Keep the header `ThemeSwitcher` for immediate client-side toggling, but ensure the Form setting is the source of truth for *default* state on load.

### Phase 3: Cleanup & Verification (Completed)
- **Goal**: Remove redundant code and verify functionality.
- **Steps**:
  1. Remove or redirect `src/app/settings/page.tsx`.
  2. Verify saving settings persists to Supabase `user_profiles`.
  3. Verify API Key masking works (already implemented, just verify).
  4. Verify Notification toggles work.

## 4. Testing Strategy
- **Manual Testing**:
  - Navigate to `/dashboard/settings`.
  - Verify Email matches logged-in user.
  - Change Theme preference, save, reload -> Check if theme is applied (requires ThemeProvider to read from DB or local storage - currently `next-themes` usually reads local storage. We might need to sync DB setting to local storage on login/load).
  - Update API Keys -> Check if masked on reload.
  - Toggle Notifications -> Check DB update.

## 5. Technical Specifications

### API Route / Actions
- **`getUserProfile()`**:
  - Auth check.
  - Fetch `user_profiles`.
  - Return `{ fullName, email, settings, apiKeys (masked) }`.
- **`updateUserProfile(data)`**:
  - Auth check.
  - Update `full_name` in Auth (optional).
  - Merge and Encrypt `api_keys`.
  - Update `settings` JSONB.

### Component Structure
```tsx
// src/app/dashboard/settings/page.tsx
export default async function SettingsPage() {
  const profile = await getUserProfile();
  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold">Settings</h1>
       <SettingsForm defaultValues={profile} />
    </div>
  )
}
```

## 6. Questions / Risks
- **Theme Sync**: `next-themes` relies on `localStorage`. Syncing with DB `user_profiles.settings.theme` requires a client-side effect to update `setTheme` when the profile loads.
  - *Mitigation*: In `SettingsForm`, use `useEffect` to call `setTheme` if the DB value differs from current, OR just rely on local storage for the active session and only save "preference" to DB for cross-device sync.
