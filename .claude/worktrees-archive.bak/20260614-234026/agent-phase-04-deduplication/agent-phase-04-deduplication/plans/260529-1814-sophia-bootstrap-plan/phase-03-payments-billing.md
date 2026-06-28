# Phase 3: Payments & Subscriptions

## Overview
* **Priority:** Critical
* **Status:** Complete (Verified)
* **Date:** 2026-05-29

## Key Insights
* Use append-only commission ledgers and 14-day clawback logic to protect split payouts.

## Requirements
* NOWPayments USDT subscription and PayOS payment gateways activation.

## Related Code Files
* [nowpayments-client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/clients/nowpayments-client.ts)
* [payouts.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/payouts/clawback-handler.ts)

## Todo List
* [x] Integrate NOWPayments IPN webhooks.
* [x] Configure commission split ledgers.
* [x] Verify tier gating on subscription update.
