# Phase 1: Rail Alignment Implementation
> Plan: 260715-rail-alignment-decision | Status: READY | Mode: parallel

## Context
Decision doc: decision.md — Option C (Invoice-Level Routing with Agency Prefix)

## Requirements
- Add NOWPAYMENTS_AGENCY_INVOICE_IDS config mapping agency invoice IDs to agency config
- Add lookupAgencyInvoice() function in nowpayments-client.ts
- Update agency-billing.ts to use invoice lookup (with fallback to amount detection for backward compat)
- Add agency invoice creation API endpoint

## Acceptance Criteria
1. Agency payments route via invoice lookup when invoice ID is in the config
2. Existing agency payments (without invoice ID) fall back to amount detection
3. No breaking changes to individual subscription rail or one-time SKU rail
4. All existing tests pass
5. New tests cover agency invoice lookup + fallback path

## Files to Modify
- src/tree/clients/nowpayments-client.ts — add AGENCY_INVOICE config + lookup
- src/land/billing/agency-billing.ts — replace amount inference with invoice lookup
- src/land/billing/nowpayments-ipn-dispatch-agency.ts — wire new lookup
- src/seed/config/one-time-skus.ts — export AGENCY_INVOICE_IDS

## Files to Create
- src/app/api/agency/invoices/route.ts — agency invoice creation API

## Scope Boundary
- OUT: NOWPayments merchant account setup (no-touch)
- OUT: Credit pack fulfillment logic (separate plan)
- OUT: Tenant isolation wiring (separate track)

## Constraints
- Backward compat required: existing agency payments must continue working
- Fallback to amount detection if invoice not in config
- No new NOWPayments API keys or merchant accounts
- All changes must pass type-check + existing test suite
