# Phase 5: Handoff & Documentation

## Context
**Goal**: Provide a clean, non-technical delivery package.
**Links**: `plans/260204-2059-turnkey-setup-wizard/plan.md`

## Overview
The final step is to clean up the documentation. The current docs might be developer-focused. We need a "User Manual" style `HANDOFF.md` that assumes zero knowledge.

## Requirements
1.  **HANDOFF.md**:
    -   3 steps max: Install, Setup, Run.
    -   Screenshots (referenced) of the Wizard.
2.  **README.md**:
    -   Move dev details to `CONTRIBUTING.md`.
    -   Keep README focused on "Getting Started" for the end-user.
3.  **Clean Up**:
    -   Ensure no `.env` files with secrets are committed.
    -   Ensure `npm run build` passes cleanly.

## Implementation Steps

1.  **Rewrite HANDOFF.md**:
    -   "Welcome to Sophia AI Factory".
    -   "Step 1: Unzip / Clone".
    -   "Step 2: Run `npm install && npm run dev`".
    -   "Step 3: Open `http://localhost:3000` and follow the Wizard".

2.  **Refactor README.md**:
    -   Banner image.
    -   One-paragraph description.
    -   Link to `HANDOFF.md`.

3.  **Final Verification**:
    -   Clone repo to a fresh folder.
    -   Follow `HANDOFF.md` instructions literally.
    -   Verify Setup Wizard launches.

## Todo List
-   [x] Backup existing `HANDOFF.md` to `docs/legacy/HANDOFF.old.md`.
-   [x] Write new `HANDOFF.md`.
-   [x] Update `README.md`.
-   [x] Create `CONTRIBUTING.md` for dev docs.

## Success Criteria
-   A random person can read `HANDOFF.md` and get the app running without asking questions.

## Next Steps
-   Deliver project.
