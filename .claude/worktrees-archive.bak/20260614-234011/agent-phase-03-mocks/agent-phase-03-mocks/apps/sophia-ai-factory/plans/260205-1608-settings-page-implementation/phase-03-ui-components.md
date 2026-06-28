# Phase 3: UI Components

## Context
The UI needs to be responsive, accessible, and provide immediate feedback. We will use Tailwind CSS 4 and `next-themes`.

## Requirements
- **Theme Switcher**: Dropdown or toggle for Light/Dark/System.
- **Settings Form**: Tabbed or sectioned layout.
- **Inputs**: Text inputs, Toggle switches (for notifications), Secret inputs (for API keys).

## Implementation Steps

1.  **Theme Provider Setup**
    - Ensure `ThemeProvider` from `next-themes` is wrapping the app (check `layout.tsx`).

2.  **Theme Switcher Component (`src/components/settings/theme-switcher.tsx`)**
    - Use `useTheme` hook.
    - UI: Select/Dropdown or Radio Group.

3.  **Form Components (`src/components/ui/...`)**
    - Verify/Create `Switch` component (for toggles).
    - Verify/Create `Input` component with eye icon for toggling visibility of API keys.

4.  **Settings Form Wrapper (`src/components/settings/settings-form.tsx`)**
    - Client Component.
    - Use `react-hook-form` + `zodResolver`.
    - Handle submission state (loading spinners).
    - Optimistic updates for Toggles.

## Deliverables
- [ ] `ThemeSwitcher` component.
- [ ] `SettingsForm` component with validation and error handling.
- [ ] Reusable form input components.
