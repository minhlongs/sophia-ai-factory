## 2026-05-30T07:47:51Z
You are the implementation and documentation worker (teamwork_preview_worker). Your working directory is `/Users/macbook/projects/sophia-ai-factory/.agents/worker_fixes_m4`.
Your tasks are:

1. Implement the credit balance split mismatch fixes:
   - In `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts`: Call `addCredits(user.id, 50, 'Signup Bonus')` in the `after` user creation callback using a lazy dynamic import of `addCredits` from `@/lib/mcu/credits-repo` (to comply with layer boundary rules: `const { addCredits } = await import('@/lib/mcu/credits-repo');`).
   - In `apps/sophia-ai-factory/src/app/api/coupons/activate/route.ts`: Call `await addCredits(userId, couponDef.mcuBonus, 'Coupon Activation', { coupon })` right where `org_balances` is updated (make sure to import `addCredits` from `@/lib/mcu/credits-repo`).

2. Fix the missing cron mappings in `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` in the `CRON_ROUTES` map:
   - Add `"0 7 * * *": ['/api/cron/llm-cache-purge']`
   - Add `"0 */4 * * *": ['/api/cron/affiliate-scout']`
   - Add `"10 * * * *": ['/api/cron/wallet-rebuild']`
   - Add `"*/10 * * * *": ['/api/cron/heartbeat']`
   - Add `/api/cron/error-digest` to the existing `'0 5 * * *'` array so it maps both backups and error-digests.

3. Register active missing Inngest functions in `apps/sophia-ai-factory/src/app/api/inngest/route.ts`:
   - Import and add: `videoGenerate`, `batchVideoFanout`, `repurposeAnalyze`, `repurposeClipGenerate`, `analyticsSync`, `tokenRefreshCron`, `thumbnailAbSelector` to the serve functions array.

4. Run `npm run ci:typecheck`, `npm run ci:lint`, and `npm run ci:test` in `apps/sophia-ai-factory` to ensure they compile and pass perfectly with zero errors/failures and warnings below 341.

5. Create standard markdown files under `docs/go-live-readiness/` directory (you will need to create the directory if it does not exist), satisfying all documentation backfill requirements, ensuring all links to code paths use `file://` scheme with absolute paths on disk, and no placeholder strings (e.g. TBD, todo, etc.) exist:
   - `docs/go-live-readiness/SUMMARY.md` — Landing index of all Go-Live readiness documents.
   - `docs/go-live-readiness/SCORECARD.md` — Go-Live gap scorecard, scoring Architecture, Reliability, Scalability, Security, Observability, Documentation, Testing, Deployment, DevEx, and Maintainability out of 100 with clear justifications. Include blocker fixes and priority levels (Blockers, High, Medium, Low) with implementation plans.
   - `docs/go-live-readiness/STRUCTURAL_MAP.md` — Repository structural mapping (purpose, boundaries, dependencies, runtime role, and architectural risk level for apps, packages, services, scripts, infra, configs, CI/CD, tests, docs).
   - `docs/go-live-readiness/EXECUTION_FLOWS.md` — Tracing of entry points, middlewares, Inngest queues, databases, authentication, background jobs, external APIs, and deployment topology.
   - `docs/go-live-readiness/PRODUCTION_READINESS.md` — Deep audit of Reliability, Scalability, Security, and Observability.
   - `docs/go-live-readiness/TECHNICAL_DEBT.md` — Technical debt discovery: dead code, duplicate logic, legacy Supabase leftovers, pricing margins. Include confidence levels (High, Medium, Needs Verification).
   - `docs/go-live-readiness/DEVELOPMENT_GUIDE.md` — Quickstart, setup, local dev, testing, and contributing guidelines.
   - `docs/go-live-readiness/PLAYBOOKS.md` — Release process, deployment, incident response, disaster recovery, backups, secret rotation, and API/DB references (including schema relationships, cron routing tables, queue lifecycles).

Always update your progress.md at least every 5 minutes and include the 'Last visited' header. When complete, write your handoff.md inside your working directory and send a message back.
