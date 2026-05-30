## 2026-05-30T09:10:45Z
You are a fullstack developer subagent. Your task is to implement the final milestone for the Harness Engineering system.

Working Directory: /Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering

### Objective:
Implement R5 requirements (Dashboard widget, Telegram slash commands, and CLI shortcut) and verify that all tests, lint checks, and typechecks pass.

Specifically, implement:
1. Web Dashboard Widget in 'apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx':
   - Add a 'harness' tab to `NAV_ITEMS` (id: 'harness', label: 'Verification Harness').
   - In `renderPanel()`, return a new `<HarnessPanel />` component.
   - `HarnessPanel` should:
     - Fetch the current daemon status and latest job results on mount and display them. Use `/api/v1/harness/status` (polled periodically or retrieved initially).
     - Include a button to trigger a new job via POST to `/api/v1/harness/trigger` (with body `{ triggered_by: 'web' }`).
     - If the status is 'pending' or 'processing', poll `/api/v1/harness/status` every 3 seconds to show progress.
     - Show a stepper / progress bar and checklist of the 6 validation tests: d1_ping, r2_storage, api_openrouter, api_elevenlabs, api_heygen, remotion_render.
     - Display duration and error messages if failures occur.
     - Display Vietnamese troubleshooting cards explaining how to resolve failures (D1 connection, R2 storage write/delete permission, API key validation, or Remotion compile/ffmpeg errors).

2. Telegram slash commands in 'apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts' (and modular status handler in 'apps/sophia-ai-factory/src/tree/telegram/handlers/status-handler.ts' or modular commands):
   - Modify the route/handlers to intercept `/status` and `/audit` commands.
   - Guard these commands so they are only run by authorized users (e.g., using `isAllowed(db, chatId)` or `chatId === adminChatId` checks).
   - `/status` command:
     - Fetch status from '/api/v1/harness/status' using `fetch` (pass the headers `x-harness-secret: dev-harness-secret`).
     - Reply with the system status (Daemon ONLINE/OFFLINE, last activity timestamp) and the list of tests from the last run job.
   - `/audit` command:
     - Trigger a new job by POSTing to '/api/v1/harness/trigger'.
     - Reply with a dynamic progress message (e.g. starting audit... 20%).
     - Enter a loop polling '/api/v1/harness/status' every 3 seconds for up to 30 seconds.
     - On each poll, count the number of completed tests and update the message with progress percentages (20%, 50%, 80%, 100%) by editing the message (using `editMessageText` API call, which you can implement).
     - Send the final red/green checklist report.

3. CLI Shortcut file:
   - Create a file `/Users/macbook/Desktop/Sophia-Harness.command`.
   - The file should:
     ```bash
     #!/bin/bash
     cd /Users/macbook/projects/sophia-ai-factory/.claude/worktrees/feature-harness-engineering/apps/sophia-ai-factory
     export HARNESS_TARGET_HOST="http://localhost:3000"
     export HARNESS_SECRET="dev-harness-secret"
     npx tsx src/tree/harness/daemon.ts
     ```
   - Make the command script executable using `chmod +x`.

### Verification Requirements:
- Run typescript checks: `npm run type-check` or `npx tsc --noEmit` in 'apps/sophia-ai-factory'.
- Run lint checks: `npm run lint` or `npx eslint src` in 'apps/sophia-ai-factory'.
- Run vitest tests: `npx vitest run src/app/api/v1/harness/__tests__/route.test.ts` and `npx vitest run src/tree/harness/__tests__/daemon.test.ts` and verify they pass.

### Handoff Requirements:
Write a handoff report at '.agents/implementer_harness_engineering/handoff.md' (creating the folder '.agents/implementer_harness_engineering' first) showing your changes, command execution results (typecheck, lint, and vitest), and layout compliance.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
