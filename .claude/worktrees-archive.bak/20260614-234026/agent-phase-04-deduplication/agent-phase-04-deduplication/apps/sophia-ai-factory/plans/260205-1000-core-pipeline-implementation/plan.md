# Core Pipeline Implementation Plan

## Context
Phase 3 of the roadmap focuses on wiring up the "Brain" (n8n/AI) to the "Body" (Frontend). We need to enable users to generate scripts and videos from the Dashboard. Currently, the `src/app/dashboard` directory exists but appears empty. The server actions for automation are partially implemented in `src/app/actions/automation.ts`.

## Goals
1.  **Dashboard UI**: Create a functional dashboard to view projects and trigger actions.
2.  **Script Generation**: Connect the UI to the `generateScript` server action and handle the async flow.
3.  **Video Rendering**: Implement the video generation trigger and status tracking.
4.  **Feedback Loop**: Implement polling or refresh mechanism to show status updates from Airtable.

## Architecture

### Data Flow
1.  **User** submits "Create Project" form (Topic, Audience).
2.  **Server Action** (`generateScript`):
    *   Creates "Draft" record in Airtable.
    *   Triggers n8n Webhook (asynchronous).
    *   Returns success/ID to UI.
3.  **n8n Workflow** (External):
    *   Generates script.
    *   Updates Airtable record with content and status "generated".
4.  **UI**:
    *   Polls/Refreshes data to see status change.
    *   Displays generated script.
5.  **User** clicks "Render Video".
6.  **Server Action** (`renderVideo`):
    *   Updates status to "video_queued".
    *   Triggers n8n Webhook for video.
7.  **Video Engine** (External):
    *   Generates video.
    *   Updates Airtable with `VideoUrl`.

## Implementation Steps

### 1. Dashboard Scaffold
- [x] Create `src/app/dashboard/layout.tsx` (Sidebar navigation, shell).
- [x] Create `src/app/dashboard/page.tsx` (Project list view).
- [x] Create `src/app/dashboard/create/page.tsx` (New project form).

### 2. UI Components
- [x] `ProjectCard`: Display script/video status, basic info.
- [x] `ScriptView`: Component to read/edit the generated script. (Implemented as read-only preview in Card for now)
- [x] `CreateProjectForm`: Form with validation (Zod).

### 3. Server Actions & API
- [x] Review/Update `src/app/actions/automation.ts`.
- [x] Add `renderVideo` action.
- [x] Ensure proper error handling and revalidation.

### 4. Integration
- [x] Wire up the form to `generateScript`.
- [x] Wire up "Render" button to `renderVideo`.
- [x] Implement a simple polling hook or manual refresh button for status updates.

## Technical Considerations
- **Polling**: Since we use Airtable (latency), simple polling every 10-15s or a "Refresh" button is safer than complex websockets for now.
- **State**: Use URL search params for simple state or React Server Components data fetching.
- **Styling**: Use existing Tailwind components.

## Verification
- [x] Test creating a project.
- [x] Mock n8n response (or manually update Airtable) to verify UI updates.
- [x] **Linting & Build**: Fixed `any` type errors in tests and Airtable mock. `npm run lint`, `npm test`, and `npm run build` all pass.

## Status
**Completed**. The Core Pipeline frontend and server actions are implemented and tested. The codebase is verified clean (Lint/Test/Build passed). Next steps involve configuring the n8n workflows to consume the webhooks.
