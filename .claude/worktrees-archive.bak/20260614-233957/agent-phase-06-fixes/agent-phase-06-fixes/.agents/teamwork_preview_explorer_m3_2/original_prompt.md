## 2026-05-31T07:20:18Z
You are an Explorer subagent (explorer_m3_2).
Your working directory (metadata folder) is: `/Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_2/`
The project directory is: `/Users/macbook/projects/sophia-ai-factory/`

Objective: Investigate and analyze implementation strategies for the following Milestone 3 edge cases (Credits & Video Concurrency):
1. **Case 3.1: Concurrent Duplicate HeyGen Webhooks (Success)** in `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`. Use Compare-And-Swap (CAS) to update `status = 'completed'` only if current status is not already completed, preventing duplicate emails/R2 uploads.
2. **Case 3.3: Optimistic Locking Failure in decrementCredits** in `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`. Change the function to check that the update mutated exactly 1 row (using `D1Client` / `D1QueryChain` methods like `.single()` or `.returning()`), returning `false` otherwise.
3. **Case 3.4: Worker Timeouts in Retry Queue Batch Loops** in `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`. Modify the cron's loop (which currently runs sequentially) to chunk the items (e.g., batches of 5) and process each batch concurrently using `Promise.all` or `Promise.allSettled`.

Please check the files, understand their structure, and recommend the exact changes (with file paths and line numbers) for the worker. DO NOT implement any changes directly.

Write your findings and a handoff report in your working directory. Notify when done.
