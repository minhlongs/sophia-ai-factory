## 2026-05-30T07:54:43Z
You are the documentation correction worker (teamwork_preview_worker). Your working directory is `/Users/macbook/projects/sophia-ai-factory/.agents/worker_fixes_m6`.
Your tasks are:
1. Correct the 5 broken absolute path links in `docs/go-live-readiness/TECHNICAL_DEBT.md`:
   - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/supabase-client-legacy.ts` -> `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/client.ts`
   - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/auth/legacy-callback/route.ts` -> `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/auth/callback/route.ts`
   - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/crypto/signatures.ts` -> `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/signature.ts`
   - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/legacy-video-runner.ts` -> `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/video-job-pipeline.ts`
   - `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/mcu/pricing-calculator.ts` -> `file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/cost-guardrail.ts`
2. Run `npm run ci:typecheck`, `npm run ci:lint`, and `npm run ci:test` in `apps/sophia-ai-factory` to ensure they compile and pass perfectly with zero errors/failures and warnings below 341.
3. Write your handoff report to `/Users/macbook/projects/sophia-ai-factory/.agents/worker_fixes_m6/handoff.md` and send a message back.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
