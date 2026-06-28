# Phase 1: Setup Wizard UI

## Context
**Goal**: Create a visual, step-by-step interface for configuring the application.
**Links**: `plans/260204-2059-turnkey-setup-wizard/plan.md`

## Overview
We will build a `/setup-wizard` route using Next.js App Router. This route will be the landing page if the application detects it is not configured. It will feature a stepper interface to reduce cognitive load, validation feedback, and contextual help.

## Requirements
1.  **Route**: `/setup-wizard` (Publicly accessible if config missing).
2.  **UI Components**:
    *   **Stepper**: Visual progress indicator (System -> Keys -> Database -> Finish).
    *   **Input Groups**: Label, Input (password type), "Verify" button, Help Icon.
    *   **Help Modals**: Popover showing screenshot of where to find the key.
3.  **Validation**: Real-time feedback (Green Check / Red X) next to inputs.
4.  **Navigation**: Block "Next" until current step is valid.

## Architecture
-   **Frontend**: React Server Component for shell, Client Component for form state (`useForm` + `zod`).
-   **State Management**: `localStorage` (temporary) + React State.
-   **Styling**: Tailwind CSS + Shadcn/UI (if available) or custom components.
-   **Middleware**: `middleware.ts` checks `IS_CONFIGURED` flag. If false, redirects root `/` to `/setup-wizard`.

## Implementation Steps

1.  **Scaffold Route**:
    -   Create `src/app/setup-wizard/page.tsx`
    -   Create `src/app/setup-wizard/layout.tsx` (clean layout, no sidebar)

2.  **Implement Components**:
    -   `WizardStepper.tsx`: Progress bar.
    -   `ApiKeyInput.tsx`: Composite component with Input, Toggle Visibility, Verify Button, Help Tooltip.
    -   `HelpCard.tsx`: Content for the "Where to find?" modal.

3.  **Build Steps**:
    -   **Step 1: System Check**: Display static checks (Node version, Write access - mocked for UI, actual check via API).
    -   **Step 2: API Keys**:
        -   OpenRouter API Key
        -   ElevenLabs API Key
        -   D-ID API Key
        -   Social Media Tokens (Optional/Later)
    -   **Step 3: Database**:
        -   Airtable PAT (Personal Access Token)
        -   Base ID (Dropdown if possible, else Input)
    -   **Step 4: Finalize**:
        -   "Save Configuration" button.
        -   "Download .env" button (for Vercel users).
        -   "Go to Dashboard" button (redirects to `/`).

4.  **Middleware Logic**:
    -   Update `middleware.ts` to check for `CONFIG_STATUS` cookie or env var.

## Todo List
-   [x] Create `src/app/setup-wizard/` directory structure.
-   [x] Implement `WizardStepper` component.
-   [x] Implement `ApiKeyInput` component with validation callback support.
-   [x] Build Step 1 (System Check) view.
-   [x] Build Step 2 (API Keys) form with Zod validation.
-   [x] Build Step 3 (Airtable) form.
-   [x] Build Step 4 (Finalize) view.
-   [x] Add `middleware.ts` redirection logic.

## Success Criteria
-   User can navigate to `/setup-wizard`.
-   User cannot proceed to Step 3 without validating keys in Step 2.
-   User sees clear error messages if a key is invalid.
-   "Where to find" tooltips provide accurate info.

## Security Considerations
-   API Keys stored in Client State are ephemeral.
-   Input fields must use `type="password"`.
-   No keys logged to console.
