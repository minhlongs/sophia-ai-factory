## 2026-05-31T06:48:56Z

You are teamwork_preview_worker. Your working directory is: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m1/
Your task is to implement the fixes for Milestone 1: Payments & Webhooks Security.

Specifically, you need to:
1. Update `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts` to:
   - Use status-aware event_id format: `nowpayments_${payment_id}_${payment_status}`.
   - Atomically insert the event into `payment_events` with `processed: 0`.
   - If insertion fails (unique key violation), query the database:
     - If processed is 1, return success immediately (`{ success: true, message: 'Already processed' }`).
     - If processed is 0, return success/processing in progress (`{ success: true, message: 'Already processed or processing' }` or similar).
   - If downstream processing (the switch case) throws an error, delete the event row to allow retries, and rethrow/return failure.
   - If downstream processing succeeds, update `processed` to 1.

2. Update `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts` to:
   - Atomically insert the event into `payos_events` with `processed: 0`.
   - If insertion fails (unique key violation), query the database:
     - If processed is 1, return success immediately (`NextResponse.json({ received: true, note: 'Already processed' })`).
     - If processed is 0, return success/processing in progress (`NextResponse.json({ received: true, note: 'Already processed or processing' })` or similar).
   - If downstream processing throws an error, delete the event row to allow retries, and return failure.
   - Verify that the received `amount` from the IPN matches the expected price of the tier: `getPayOsTierConfig(tier).vndAmount`. If they do not match, delete the event lock and return a `400 Bad Request` response with an error message.
   - Remove the insecure fallback `?? orders?.[0]` and default basic/synthetic fallback values. If no matching order is found in `pending_orders`, delete the event lock and return a `400 Bad Request` response with an error message.

You can reference the synthesis report at: /Users/macbook/projects/sophia-ai-factory/.agents/orchestrator_fixes_run1/synthesis_m1.md
And proposed implementations by explorers at:
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_3/proposed_nowpayments-ipn-handlers.ts
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_3/proposed_payos_route.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please execute the changes, run build and test commands (like `npm run ci:typecheck` and `npm run ci:test`), and verify everything is correct. Write a handoff report to /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_worker_m1/handoff.md and notify me.
