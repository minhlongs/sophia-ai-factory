# Cleanup Report — Orphan FREE100 redemptions

**Date:** 2026-05-05 05:46 PT
**Trigger:** Post-FK-fix data hygiene. Six orphan redemptions remained from debug session before migration 0088.

## What was wrong

| Metric | Before |
|---|---|
| FREE100 redemptions total | 14 |
| Orphans (handover_id NULL) | 6 |
| user table rows | 40 |
| promo_codes.used_count (FREE100) | 24 (drift) |

Six redemptions before migration 0088 (org_members FK fix) succeeded at the redeem-promo step but failed silently at handover creation due to FK trap. They left:
- `promo_code_redemptions` row with `handover_id IS NULL`
- better-auth `user` row (created by GET /api/promo/redeem-free signup)
- 0 rows in `subscriptions`, `org_members`, `customer_handovers`, `session`, `account` (FK trap blocked them all)
- `promo_codes.used_count` incremented per failed attempt → drifted to 24 vs 14 actual

## Action

Single transaction:
```sql
DELETE FROM promo_code_redemptions WHERE user_id IN (6 orphan IDs) AND handover_id IS NULL;  -- 6 rows
DELETE FROM user WHERE id IN (6 orphan IDs);  -- 6 rows
UPDATE promo_codes SET used_count = (SELECT COUNT(*) FROM promo_code_redemptions WHERE promo_code='FREE100');  -- synced to 8
```

## After

| Metric | After |
|---|---|
| FREE100 redemptions total | 8 |
| Orphans | 0 |
| user table rows | 34 |
| promo_codes.used_count | 8 (synced) |
| FREE100 slots remaining | 42 (50 max - 8 used) |

## Orphan emails removed

- test-free100-1777943179@example.com
- test-browser-260504@example.com
- test-uxbrowser-1777948007@example.com
- debug-handover-1777948504@example.com
- debug-tail-1777948527@example.com
- trace-1777948592@example.com

All `@example.com` test patterns. No production users affected.

## Real users preserved

- alexnguyen2304@gmail.com (FREE100 redeemed 05-04 02:43, has handover)
- minhlong.rice@gmail.com (FREE100 redeemed 05-03 02:12, has handover)

## Side note: used_count drift root cause

`used_count` increments earlier in the redeem flow than handover creation. With FK trap, increment succeeded but handover insert silently failed → drift accumulated. Post-0088 fix this can't recur, but the historical drift required manual sync.

Future hardening: wrap increment + handover creation in same transaction, OR move `UPDATE promo_codes SET used_count = used_count + 1` to AFTER successful handover. Out of scope for this iteration.

## Unresolved questions

- Should successful test redemptions (4 remaining `@example.com` accounts with handover) be cleaned too? Currently keep as audit trail of fix verification.
- Prevention: add idempotency / saga pattern around redemption flow to prevent partial-state drift in future failures.
