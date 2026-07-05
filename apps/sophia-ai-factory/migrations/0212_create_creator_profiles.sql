-- Migration 0212: Creator profiles for SOP Marketplace
--
-- Each user can have at most one creator profile. A creator profile
-- enables the user to publish SOP templates to the marketplace
-- and receive payouts from sales.

CREATE TABLE IF NOT EXISTS creator_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  payout_method TEXT CHECK(payout_method IN ('nowpayments','stripe_connect','usdt')),
  payout_address TEXT,
  total_earnings_cents INTEGER DEFAULT 0,
  total_paid_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON creator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_status ON creator_profiles(status);

-- Verify
SELECT '0212: OK' AS migration_status FROM creator_profiles LIMIT 1;
