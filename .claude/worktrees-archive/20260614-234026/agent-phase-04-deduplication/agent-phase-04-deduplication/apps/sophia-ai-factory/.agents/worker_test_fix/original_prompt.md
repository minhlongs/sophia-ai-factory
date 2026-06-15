## 2026-05-29T23:56:46Z
You are teamwork_preview_worker.
Your working directory is: /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.agents/worker_test_fix
Your mission is to fix the mock in src/forest/missions/handlers/video-create.test.ts to resolve the vitest failure.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context:
- Currently, running the vitest test runner results in a failure in src/forest/missions/handlers/video-create.test.ts because the `@/seed/db/client` mock is missing the `getD1Raw` export.
- Change the mock on lines 11-13 from:
```typescript
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));
```
to:
```typescript
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1Raw: vi.fn().mockResolvedValue({} as any),
}));
```
Or whatever matches vitest mocking requirements.

Tasks:
1. Edit src/forest/missions/handlers/video-create.test.ts to include the mock export.
2. Run the test command: `npx vitest run src/forest/missions/handlers/video-create.test.ts` to verify that this specific test suite passes.
3. Write your handoff report in `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.agents/worker_test_fix/handoff.md` and report back.
