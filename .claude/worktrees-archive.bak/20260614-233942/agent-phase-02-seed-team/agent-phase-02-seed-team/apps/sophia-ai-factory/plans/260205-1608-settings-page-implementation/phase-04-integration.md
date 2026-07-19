# Phase 4: Integration & Page Assembly

## Context
Bring it all together in the `/settings` route. This phase connects the data fetching (Phase 2) with the UI (Phase 3).

## Requirements
- **Route**: `/settings/page.tsx`.
- **Protection**: Middleware should already handle auth, but page should double-check or handle "no profile" states gracefully.

## Implementation Steps

1.  **Page Implementation (`src/app/settings/page.tsx`)**
    - Async Server Component.
    - Call `getProfile` (Server Action).
    - Pass data to `SettingsForm`.

2.  **Sidebar/Navigation Integration**
    - Add "Settings" link to the main app dashboard sidebar.
    - Ensure active state styling works.

3.  **Notification System**
    - Integrate `sonner` or `react-hot-toast` (check project deps) to show "Settings Saved" messages triggered from the Client Component.

4.  **Manual Testing**
    - Test Theme Switch persistence.
    - Test Profile updates.
    - Test API Key saving (verify encryption in DB if possible via logs/admin).

## Deliverables
- [ ] Fully functional `/settings` page.
- [ ] Navigation updates.
- [ ] Verified E2E flow for user settings.
