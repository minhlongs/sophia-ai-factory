-- A bank transfer reference must identify exactly one settlement.
-- Existing duplicate references deliberately abort index creation for review.
-- Preserve every historical settlement and audit row; never deduplicate money records.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_pilot_settlements_transfer_reference_unique
  ON manual_pilot_settlements (transfer_reference);
