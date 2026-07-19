-- Migration 0215: SOP reviews for Marketplace
--
-- User-submitted ratings and review text for installed SOP listings.
-- One review per install (enforced by UNIQUE constraint on install_id).
-- Rating must be between 1 and 5.

CREATE TABLE IF NOT EXISTS sop_reviews (
  id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (install_id) REFERENCES sop_installs(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_sop_reviews_install_id ON sop_reviews(install_id);
CREATE INDEX IF NOT EXISTS idx_sop_reviews_user_id ON sop_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_reviews_rating ON sop_reviews(rating);

-- Verify
SELECT '0215: OK' AS migration_status FROM sop_reviews LIMIT 1;
