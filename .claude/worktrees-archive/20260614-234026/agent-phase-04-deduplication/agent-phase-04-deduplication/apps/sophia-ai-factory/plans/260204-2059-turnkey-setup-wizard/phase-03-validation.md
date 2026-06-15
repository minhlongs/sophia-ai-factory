# Phase 3: Validation Logic

## Context
**Goal**: Secure, backend-side validation of API keys to prevent leaking credentials and ensuring service health.
**Links**: `plans/260204-2059-turnkey-setup-wizard/plan.md`

## Overview
We need a centralized validation library (`src/lib/validation.ts`) and an API endpoint (`/api/setup/verify`) that the UI and CLI can both use. This ensures a Single Source of Truth for "What is a valid key?".

## Requirements
1.  **Central Library** (`src/lib/validation/services.ts`):
    -   `validateOpenRouter(key)`
    -   `validateElevenLabs(key)`
    -   `validateDID(key)`
    -   `validateAirtable(key, baseId)`
2.  **API Endpoint** (`src/app/api/setup/verify/route.ts`):
    -   POST request.
    -   Body: `{ service: 'openai' | 'airtable' ..., key: string, params?: any }`
    -   Response: `{ valid: boolean, message?: string, meta?: any }`
3.  **Persistence Endpoint** (`src/app/api/setup/save/route.ts`):
    -   POST request.
    -   Writes to `.env.local` (Dev/Local) or returns Config Object (Prod).

## Architecture
-   **Tech Stack**: TypeScript, Server Actions (optional) or Route Handlers.
-   **External Calls**: `fetch` with specific headers per service (see Research 02).
-   **Security**: The `/save` endpoint should check if the app is already configured and reject requests if so (unless an Admin token is provided).

## Implementation Steps

1.  **Create Validation Library**:
    -   `src/lib/validation/openrouter.ts`: Call `https://openrouter.ai/api/v1/auth/key`.
    -   `src/lib/validation/elevenlabs.ts`: Call `https://api.elevenlabs.io/v1/user/subscription`.
    -   `src/lib/validation/d-id.ts`: Call `https://api.d-id.com/credits`.
    -   `src/lib/validation/airtable.ts`: Call `https://api.airtable.com/v0/meta/whoami`.

2.  **Create API Route**:
    -   `src/app/api/setup/verify/route.ts`:
        -   Switch statement based on `service`.
        -   Call appropriate library function.
        -   Return standardized JSON.

3.  **Create Save Route**:
    -   `src/app/api/setup/save/route.ts`:
        -   Read existing env (if any).
        -   Merge new keys.
        -   Write to `.env.local` (Use `fs/promises`).
        -   *Note*: Handle Vercel environment where `fs` is read-only. Return "Download" instructions in response if write fails.

## Todo List
-   [x] Create `src/lib/validation/` directory.
-   [x] Implement OpenRouter validator.
-   [x] Implement ElevenLabs validator.
-   [x] Implement D-ID validator.
-   [x] Implement Airtable validator.
-   [x] Create `/api/setup/verify` route handler.
-   [x] Create `/api/setup/save` route handler.

## Success Criteria
-   API returns `200 { valid: true }` for correct keys.
-   API returns `200 { valid: false, message: "Invalid key" }` for bad keys.
-   API handles network timeouts gracefully.
-   Save route correctly updates `.env.local` in local environment.

## Security Considerations
-   Do not log API keys in server logs.
-   Rate limit the verify endpoint to prevent brute-forcing keys (though less likely in setup phase, good practice).
