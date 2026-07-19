-- Enable RLS (already enabled in 001, but refining policies)

-- Policy: Public can see basic info (Title, Score, etc.)
-- But cannot see affiliate_link unless they are authenticated (or specific role)
-- For MVP: We might just rely on the API layer to filter fields if we don't want to complicate RLS too much yet.
-- However, "Deep Defense" suggests RLS.

-- Let's create a secure view or use column-level security if Postgres supports it nicely,
-- or just policies. Postgres doesn't natively support "Column Level RLS" easily for SELECT (it hides rows, not columns).
-- Common pattern: separate sensitive data into a separate table or 1-to-1 table, OR use a View.

-- Approach: Create a VIEW for public discovery that excludes affiliate_link.
CREATE OR REPLACE VIEW public_affiliate_products AS
SELECT
  id,
  title,
  description,
  thumbnail_url,
  price_usd,
  commission_rate,
  avg_earnings_usd,
  sps_score,
  is_hidden_gem,
  category_id,
  created_at,
  updated_at
  -- Excludes: affiliate_link, external_id, raw_metrics (maybe too detailed?)
FROM affiliate_products;

-- Grant access to this view
GRANT SELECT ON public_affiliate_products TO anon, authenticated;

-- RPC Function for efficient Top 50 fetching with filtering
-- This allows us to encapsulate logic and potentially cache at DB level if needed later.
CREATE OR REPLACE FUNCTION get_top_products(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_category_id INTEGER DEFAULT NULL,
  p_min_sps DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  sps_score DECIMAL,
  avg_earnings_usd DECIMAL,
  is_hidden_gem BOOLEAN,
  category_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner permissions (bypass RLS if needed, or ensuring consistent view)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.description,
    p.thumbnail_url,
    p.sps_score,
    p.avg_earnings_usd,
    p.is_hidden_gem,
    p.category_id
  FROM affiliate_products p
  WHERE
    (p_category_id IS NULL OR p.category_id = p_category_id)
    AND (p_min_sps IS NULL OR p.sps_score >= p_min_sps)
  ORDER BY p.sps_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
