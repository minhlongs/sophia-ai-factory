-- Postback receipt idempotency for canonical non-Domain-B conversions.
--
-- Problem: tracking_conversions never deduplicated provider replays, so one
-- provider retry produced N conversion rows (inflating Telegram analytics and
-- any downstream consumer).
--
-- Fix in two steps (single-apply via the wrangler journal, 0477 convention):
--   1. Delete exact replay duplicates: same (link_id, network,
--      external_conversion_id, amount_usd), keep the earliest row. A provider
--      transaction id identifies one real-world order, so same-key + same-amount
--      rows are replays by definition. Rows with NULL external id are untouched.
--   2. Enforce one row per provider receipt with a partial unique index.
--      NULL external ids keep legacy behavior (SQLite treats NULLs as distinct).
DELETE FROM tracking_conversions
WHERE id IN (
  SELECT c2.id
  FROM tracking_conversions c1
  JOIN tracking_conversions c2
    ON c2.link_id = c1.link_id
   AND c2.network IS c1.network
   AND c2.external_conversion_id = c1.external_conversion_id
   AND (c2.amount_usd = c1.amount_usd
        OR (c2.amount_usd IS NULL AND c1.amount_usd IS NULL))
   AND (c2.ts > c1.ts OR (c2.ts = c1.ts AND c2.rowid > c1.rowid))
  WHERE c1.external_conversion_id IS NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_conversions_receipt
  ON tracking_conversions(link_id, network, external_conversion_id, amount_usd)
  WHERE external_conversion_id IS NOT NULL;
