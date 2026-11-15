-- 0505_publish_ledger_compliance_json.sql
-- Persists reviewer compliance decisions (TikTok privacyLevel, brand disclosure
-- toggles, musicUsageConfirmed, and YouTube containsSyntheticMedia) on
-- publish_ledger so resumed Inngest publish executions read authoritative
-- compliance metadata from D1 rather than dropping it after human approval.

ALTER TABLE publish_ledger ADD COLUMN compliance_json TEXT;
