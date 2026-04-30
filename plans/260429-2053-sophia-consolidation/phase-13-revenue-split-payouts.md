# Phase 13 — Revenue Split + Payouts

## Status: PENDING (after Phase 12)

## Goal
Commission ledger + NOWPayments USDT auto-payout + 14-day clawback window.

## Deliverables
- [ ] Commission table: `(conversion_id, network, gross, fee, net, tenant_cut, platform_cut, status, payable_after)`
- [ ] Payout cron: aggregate net per tenant > threshold ($10 USDT) → NOWPayments invoice
- [ ] Clawback handler: refund/dispute → reverse commission within 14d
- [ ] Tax: VN PIT 5% withholding option per tenant flag

## Files
- `apps/sophia-ai-factory/lib/revenue/commission-ledger.ts`
- `apps/sophia-ai-factory/lib/revenue/payout-cron.ts`
- `apps/sophia-ai-factory/lib/revenue/clawback.ts`

## Risk: High — financial correctness, tax compliance

## Effort: 5-7 days
