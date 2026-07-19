# Phase 2: One-Click Scripts

## Context
**Goal**: Provide a robust terminal-based setup experience for users who prefer CLI or are setting up on a headless server.
**Links**: `plans/260204-2059-turnkey-setup-wizard/plan.md`

## Overview
Bash scripts are the universal interface for server setup. We will create interactive scripts that replicate the Wizard's logic: asking for keys, verifying them against the backend (or direct curl if needed), and writing the configuration.

## Requirements
1.  `scripts/setup.sh`:
    -   Interactive prompts (`read -p`).
    -   Validation loop ("Invalid key, try again").
    -   Writes to `.env.local`.
2.  `scripts/verify.sh`:
    -   Runs a full diagnostic suite.
    -   Outputs a status table.
3.  **npm integration**: `npm run setup` triggers the script.

## Architecture
-   **Language**: Bash (Standard).
-   **Dependencies**: `curl`, `jq` (check existence, fallback to node script if missing).
-   **Validation**:
    -   Option A: `curl` to 3rd party APIs directly (Risk: Complex auth headers in bash).
    -   Option B: `curl` to local Next.js API `/api/setup/verify` (Requires server running).
    -   **Selected Strategy**: Mixed. Use a Node.js helper script `scripts/validate-key.js` that imports the project's validation logic to keep DRY, or simple Curl checks if dependencies allow. *Decision*: Use a Node.js script (`scripts/cli-setup.js`) executed by the bash wrapper to leverage existing project validation logic and libraries.

## Implementation Steps

1.  **Create `scripts/cli-setup.js`**:
    -   Uses `readline` for input.
    -   Imports validation functions from `src/lib/validation` (to be created in Phase 3).
    -   Writes to `.env.local` using `fs`.

2.  **Create `scripts/setup.sh`**:
    -   Checks for Node.js.
    -   Runs `npm install` if `node_modules` missing.
    -   Executes `node scripts/cli-setup.js`.

3.  **Create `scripts/verify.sh`**:
    -   Runs `node scripts/health-check.js`.
    -   `health-check.js` reads `.env.local` and validates all keys again.

4.  **Update `package.json`**:
    -   Add `"setup": "./scripts/setup.sh"`
    -   Add `"verify": "./scripts/verify.sh"`

## Todo List
-   [x] Create `scripts/cli-setup.js` (Node logic).
-   [x] Create `scripts/setup.sh` (Bash wrapper).
-   [x] Create `scripts/health-check.js`.
-   [x] Create `scripts/verify.sh`.
-   [x] Update `package.json` scripts.

## Success Criteria
-   Running `npm run setup` walks the user through configuration.
-   Invalid keys are rejected in the terminal.
-   `.env.local` is correctly generated.
-   `npm run verify` returns a "System Healthy" status after setup.

## Risk Assessment
-   **Permissions**: Scripts may need `chmod +x`.
-   **Environment**: Running `node` scripts requires the project to be built or using `ts-node`/`tsx` if importing TypeScript files. *Mitigation*: Write CLI scripts in plain JS or use `tsx` (included in Next.js dev dependencies usually) to run TS files.

## Next Steps
-   Implement Validation Logic (Phase 3) so scripts can import it.
