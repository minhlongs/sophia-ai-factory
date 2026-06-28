#!/usr/bin/env bash
# analyze-free100-redemptions.sh
# Founder tool: weekly / on-demand redemption pattern analysis for FREE100.
# Reads promo_code_redemptions on the remote sophia-raas-db.

set -euo pipefail

DB="sophia-raas-db"
CODE="${1:-FREE100}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }

bold "=== FREE100 redemption analysis — code: $CODE ==="
echo

bold "1. Slot usage (current vs max)"
npx wrangler d1 execute "$DB" --remote --command "
  SELECT code, used_count, max_uses,
         max_uses - used_count AS remaining_slots,
         status
  FROM promo_codes
  WHERE code = '$CODE';
"
echo

bold "2. Per-day redemption count"
npx wrangler d1 execute "$DB" --remote --command "
  SELECT DATE(redeemed_at, 'unixepoch') AS redeem_day,
         COUNT(*) AS redemptions
  FROM promo_code_redemptions
  WHERE promo_code = '$CODE' AND status = 'redeemed'
  GROUP BY redeem_day
  ORDER BY redeem_day;
"
echo

bold "3. Day-of-week distribution (0=Sun … 6=Sat)"
npx wrangler d1 execute "$DB" --remote --command "
  SELECT strftime('%w', redeemed_at, 'unixepoch') AS dow,
         COUNT(*) AS redemptions
  FROM promo_code_redemptions
  WHERE promo_code = '$CODE' AND status = 'redeemed'
  GROUP BY dow
  ORDER BY dow;
"
echo

bold "4. Tier applied breakdown"
npx wrangler d1 execute "$DB" --remote --command "
  SELECT applied_to_tier, COUNT(*) AS redemptions
  FROM promo_code_redemptions
  WHERE promo_code = '$CODE' AND status = 'redeemed'
  GROUP BY applied_to_tier;
"
echo

bold "5. Most recent 10 redemptions"
npx wrangler d1 execute "$DB" --remote --command "
  SELECT DATE(redeemed_at, 'unixepoch') AS day,
         TIME(redeemed_at, 'unixepoch') AS time_utc,
         email,
         applied_to_tier
  FROM promo_code_redemptions
  WHERE promo_code = '$CODE' AND status = 'redeemed'
  ORDER BY redeemed_at DESC
  LIMIT 10;
"
echo

bold "=== Done ==="
echo "Tip: cross-reference output with docs/handover/free100-distribution-tracker-260512.md"
echo "to identify which outreach template (A vs B) converted best."
