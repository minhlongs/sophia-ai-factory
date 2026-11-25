-- Add operator status & reply columns to pilot_feedback so customers can see
-- when their pilot feedback has been acknowledged or updated right in the UI.
ALTER TABLE pilot_feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'received';
ALTER TABLE pilot_feedback ADD COLUMN operator_reply TEXT;
ALTER TABLE pilot_feedback ADD COLUMN resolved_at_iso TEXT;
