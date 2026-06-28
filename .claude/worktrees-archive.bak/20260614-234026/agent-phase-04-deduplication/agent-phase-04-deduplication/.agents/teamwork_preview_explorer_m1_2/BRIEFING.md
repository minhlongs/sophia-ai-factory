# BRIEFING — 2026-05-31T06:47:00Z

## Mission
Investigate Milestone 1: Payments & Webhooks Security, covering concurrent duplicate IPN requests (idempotency race), PayOS VND amount verification, and fallback order removal in PayOS IPN.

## 🔒 My Identity
- Archetype: explorer
- Roles: teamwork_preview_explorer, explorer
- Working directory: /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_2/
- Original parent: fa4ccdba-2027-47c6-b690-4bf2f401a527
- Milestone: Milestone 1: Payments & Webhooks Security

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do not make code changes. Write findings to analysis.md and submit a handoff message.

## Current Parent
- Conversation ID: fa4ccdba-2027-47c6-b690-4bf2f401a527
- Updated: 2026-05-31T06:47:00Z

## Investigation State
- **Explored paths**:
  - `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
  - `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-db.ts`
  - `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
  - `apps/sophia-ai-factory/src/land/payments/payos.ts`
  - `apps/sophia-ai-factory/migrations/0002-payment-events.sql`
  - `apps/sophia-ai-factory/migrations/0072-payos-events.sql`
  - `apps/sophia-ai-factory/migrations/0070-pending-orders.sql`
- **Key findings**:
  - Identifed that both NOWPayments and PayOS webhooks check-then-upsert state which exposes them to concurrency race conditions. Using SQLite/D1 `insert()` on UNIQUE/PRIMARY KEY `event_id` will atomically lock processing.
  - PayOS IPN lacks amount verification. `pending_orders.amount_usd_cents` is `0` for PayOS checkouts. Must compute expected amount via `getPayOsTierConfig(tier).vndAmount` and verify `amount === expectedAmount`.
  - Insecure fallback `orders?.[0]` must be removed from PayOS IPN to prevent wrong plan upgrades.
- **Unexplored areas**:
  - Other webhook endpoints like `apps/sophia-ai-factory/src/app/api/webhooks/payos/route.ts` (has similar patterns).

## Key Decisions Made
- Recommend using atomic `insert` to lock events.
- Recommend calling `getPayOsTierConfig` for VND amount comparison.
- Recommend removing `?? orders?.[0]` and returning a 400 response.

## Artifact Index
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_2/analysis.md — Main findings and analysis report
- /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_m1_2/handoff.md — Handoff report
