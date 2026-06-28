# Phase 1: Setup Orchestration Infrastructure

## Overview
**Priority:** High
**Status:** Pending
**Description:** Initialize the Inngest infrastructure within the Next.js application to handle background job orchestration. This provides the foundation for reliable, long-running campaign generation workflows.

## Context Links
- [Main Plan](./plan.md)
- [Research Report](./reports/researcher-01-campaign-automation-patterns.md)
- [Inngest Next.js Docs](https://www.inngest.com/docs/sdk/serve/nextjs)

## Requirements
- Install `inngest` SDK
- Configure Inngest client
- Create API route `/api/inngest` to serve functions
- Verify local development setup with Inngest Dev Server

## Architecture
- **Client:** `src/lib/inngest/client.ts` - Singleton instance
- **API Route:** `src/app/api/inngest/route.ts` - Entry point for Inngest Cloud/Dev Server
- **Functions:** `src/lib/inngest/functions/` - Directory for workflow definitions

## Related Code Files
- [NEW] `src/lib/inngest/client.ts`
- [NEW] `src/app/api/inngest/route.ts`
- [NEW] `src/lib/inngest/functions/hello-world.ts` (Smoke test)

## Implementation Steps

1.  **Install Dependencies**
    ```bash
    npm install inngest
    ```

2.  **Initialize Inngest Client**
    - Create `src/lib/inngest/client.ts`
    - Export `inngest` instance with app name "Sophia AI Factory"

3.  **Create API Route**
    - Create `src/app/api/inngest/route.ts`
    - Use `serve` from `inngest/next`
    - Register empty function list initially (or a hello-world)

4.  **Create Smoke Test Function**
    - Create `src/lib/inngest/functions/hello-world.ts`
    - Trigger on `test/hello.world`
    - Simple logger to verify connectivity

5.  **Verify Setup**
    - Run `npx inngest-cli@latest dev`
    - Trigger test event via Dev Server UI

## Success Criteria
- [ ] `npm run dev` starts without errors
- [ ] `/api/inngest` responds to GET/POST (handled by SDK)
- [ ] Inngest Dev Server detects the app
- [ ] Test event executes successfully

## Risk Assessment
- **Risk:** Middleware interference.
- **Mitigation:** Ensure `/api/inngest` is excluded from middleware auth checks if necessary (usually Inngest handles its own signing).

## Security Considerations
- Inngest uses signing keys. Ensure `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are in `.env.local` for production.
- For dev, the CLI handles local verification.
