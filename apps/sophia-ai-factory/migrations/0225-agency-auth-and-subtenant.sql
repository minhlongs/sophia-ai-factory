-- Agency API key auth constraints
-- api_key_prefix column already exists from 0218, safely add index if missing
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_key_prefix ON agency(api_key_prefix);
