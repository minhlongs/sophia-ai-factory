## 2026-05-31T06:58:22Z
You are teamwork_preview_worker. Your working directory is: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m1_retry1/
Your task is to fix 3 critical/major issues in Milestone 1 Payments & Webhooks Security identified by Reviewer 2.

Please refer to the reviewer's feedback at: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_reviewer_m1_2/handoff.md

Implement the following:
1. PayOS Description Mismatch & Webhook Failure:
   - In `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`, avoid parsing the userId from description since the production checkout strips the userId prefix to fit PayOS character limits (resulting in `Sophia BASIC - [timestamp]` which fails parsing).
   - Instead, directly query `pending_orders` table matching `payment_method = 'payos'` and `status = 'pending'`, and find the order whose `invoice_url` contains `paymentLinkId` or `orderCode`. Once found, resolve the `userId` directly from `matchOrder.user_id`, and get `tier = matchOrder.tier` and `orderId = matchOrder.order_id`.
   - Update both the success and cancellation paths (`!success`) to use this database-lookup strategy to resolve the order.

2. Silent Success on Lock Conflicts:
   - In `nowpayments-ipn-handlers.ts`, if the initial insertion fails and the select query shows `processed = 0`, return `{ success: false, message: 'Already processing' }` instead of success, to trigger webhook retries.
   - In `api/payos/ipn/route.ts`, if the initial insertion fails and the select query shows `processed = 0`, return status `409` with message `Already processing` instead of returning 200, to trigger webhook retries.

3. Silent Success on Database Query Failures:
   - In both files, if `insertError` occurs and the subsequent SELECT query fails (e.g. `selectError` is present or the query returns null/undefined data), return a failure status code (500 / success: false) rather than defaulting to a 200 success.

4. Test Verification:
   - Run typechecks and unit tests. Verify that both the existing and new tests pass cleanly. Update the mock data in tests to cover the description format `Sophia BASIC - [timestamp]` and verify it parses/matches correctly under the new logic.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute these changes, verify that `npm run ci:typecheck` and `npm run ci:test` pass cleanly, and write a handoff report to: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m1_retry1/handoff.md.
