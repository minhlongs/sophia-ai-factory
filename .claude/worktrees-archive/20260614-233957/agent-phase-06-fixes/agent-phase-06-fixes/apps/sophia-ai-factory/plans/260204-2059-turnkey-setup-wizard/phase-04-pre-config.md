# Phase 4: Pre-configuration

## Context
**Goal**: Minimize user effort by pre-defining schemas, workflows, and defaults.
**Links**: `plans/260204-2059-turnkey-setup-wizard/plan.md`

## Overview
The "Turnkey" promise means the user shouldn't have to design database tables or build n8n workflows. We will include these assets in the repository and provide automation to apply them where possible.

## Requirements
1.  **Airtable Schema**:
    -   Define the table structure (Script, Video, SocialPosts) in a `schemas/airtable-template.json` or similar.
    -   Ideally, use the Airtable API to create the Base. *Constraint*: Airtable API for creating bases/tables requires Enterprise or specific scopes. **Fallback**: Provide a "Copy this Base" link to a public template we host, then user enters Base ID.
2.  **n8n Workflows**:
    -   Export workflows to `workflows/sophia-main.json`.
    -   Provide import instructions (or script if n8n API available).
3.  **Default Config**:
    -   `config/defaults.json`: Contains non-sensitive defaults (e.g., default voice ID, default avatar ID).

## Architecture
-   **Schema Storage**: `src/config/schemas/`
-   **Defaults**: `src/config/defaults.ts`

## Implementation Steps

1.  **Airtable Template**:
    -   Create a robust Airtable Base with all necessary fields.
    -   Generate a "Share View" or "Universe" link (or a public Read-Only invite link).
    -   Document the "Copy Base" process in the Wizard (Step 3).

2.  **Defaults File**:
    -   Create `src/config/defaults.ts`.
    -   Export `DEFAULT_VOICE_ID`, `DEFAULT_AVATAR_ID`.
    -   Use these defaults in the Setup Wizard as placeholders.

3.  **n8n Assets**:
    -   Create `assets/workflows/` folder.
    -   Save JSON exports of the automations.

## Todo List
-   [x] Create `src/config/defaults.ts`.
-   [x] Create `src/config/schemas/` directory.
-   [x] Create/Link Airtable Template (Manual step to create base, then document link).
-   [x] Add "Use Template" link to Setup Wizard Step 3.

## Success Criteria
-   User can click "Copy Base Template", get a Base ID, and enter it.
-   Application works immediately because internal defaults cover all non-key settings.

## Risk Assessment
-   **Airtable API Limitations**: Programmatic creation of columns is complex/restricted. The "Copy Template" approach is safer and 100% reliable for turnkey users.

## Next Steps
-   Update Handoff docs (Phase 5) to reference these pre-configs.
