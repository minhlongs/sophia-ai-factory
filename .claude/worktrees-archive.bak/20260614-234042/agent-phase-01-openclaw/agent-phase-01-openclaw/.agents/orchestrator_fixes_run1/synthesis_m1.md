# Synthesis: Milestone 1 - Payments & Webhooks Security

## Consensus
All three Explorer agents (`explorer_m1_1`, `explorer_m1_2`, and `explorer_m1_3`) agree on the core issues and the exact remediation strategies:
1. **Concurrent Duplicate IPN Requests (Idempotency Race)**:
   - **Root Cause**: Non-atomic read-then-write sequence combined with `.upsert()` (which translates to `ON CONFLICT DO UPDATE` in SQLite/D1) in both NOWPayments and PayOS IPN routes. This creates a TOCTOU race condition where multiple concurrent webhooks pass the initial check and proceed to activate memberships or issue credits.
   - **Remediation**: Change the initial reservation from `.upsert()` to `.insert()`. Since `payment_events` has a `UNIQUE` constraint on `event_id` and `payos_events` has a `PRIMARY KEY` on `event_id`, any concurrent insertion will fail. Catch the unique/primary key violation error:
     - If the existing record shows `processed = 1`, return a success response immediately (idempotency).
     - If `processed = 0` (processing is in progress), return a conflict status (409 or success=false) so the provider retries.
     - Release the lock (delete the row) if downstream execution fails to allow webhook retries to succeed.
     - Update the row to `processed = 1` on successful completion.
   - **NOWPayments Key Format**: Modify the event key from status-agnostic `nowpayments_${paymentId}` to status-aware `nowpayments_${paymentId}_${payment_status}` to ensure different status webhooks are not blocked, while blocking duplicates of the same status.
2. **PayOS Expected VND Amount Verification**:
   - **Root Cause**: The IPN handler activates subscriptions blindly upon receiving a success status from PayOS without comparing the paid amount against the expected price in the database.
   - **Remediation**: Import `getPayOsTierConfig` from `@/land/payments/payos`, fetch the expected price for the resolved tier using `getPayOsTierConfig(tier).vndAmount`, and compare it with the received `amount`. If they do not match, log an error and reject the request with a `400` status code.
3. **Removal of Insecure PayOS Fallback**:
   - **Root Cause**: If matching the pending order fails, the handler falls back to the first available pending order (`orders?.[0]`) or a default basic plan. This allows price-spoofing and tier escalation exploits.
   - **Remediation**: Remove the `?? orders?.[0]` and default/synthetic fallbacks. Reject the request with a `400` status code if no matching order is found.

## Resolved Conflicts
- **Lock release on failure**:
  - `explorer_m1_1` recommended an early abort and did not explicitly detail deleting the row on failure.
  - `explorer_m1_2` and `explorer_m1_3` explicitly noted that to prevent permanent lockups when downstream processing fails (e.g., transient network or D1 transaction errors), the lock row must be deleted inside the `catch` block so the payment provider's webhook retries can be processed.
  - *Resolution*: Adopt the lock-release deletion behavior in the `catch` block as it is the most robust engineering pattern.

## Dissenting Views
None.

## Gaps
None. All requirements under R1 for Milestone 1 are covered.
