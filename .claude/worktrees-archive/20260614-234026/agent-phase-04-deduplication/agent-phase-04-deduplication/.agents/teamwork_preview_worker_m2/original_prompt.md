## 2026-05-31T07:12:35Z

You are a Worker subagent named worker_m2.
Your working directory (metadata folder) is: `/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m2/`
The project directory is: `/Users/macbook/projects/sophia-ai-factory/`

Objective: Implement fixes for Authentication & MFA edge cases (Milestone 2) as described in `/Users/macbook/projects/sophia-ai-factory/.agents/orchestrator_fixes_run1/synthesis_m2.md`.
Scope boundaries:
1. Modify `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts` to remove the early-return fast-path check `if (user.role === 'admin')` from `isUserAdminWithRole()`. This forces a live query to the `user_profiles` table on every check, querying via `createServerClient()`.
2. Modify `apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts` to expect database call when session role is admin, aligning the test suite with the new logic.
3. Modify `apps/sophia-ai-factory/src/middleware.ts`'s catch block for `isSessionMfaPending` check (around line 151) to fail closed by redirecting the user to `/login?error=auth_service_unavailable`:
`return NextResponse.redirect(new URL('/login?error=auth_service_unavailable', request.url))`
4. Run the build and test commands to verify your changes:
`npm run ci:typecheck` and `npm run ci:test` (or direct vitest commands like `npx vitest run apps/sophia-ai-factory/src/seed/auth/is-user-admin.test.ts`).

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please report your progress and write a handoff report in your working directory. Notify when you are done.
