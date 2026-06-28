-- User-specific integration storage (ClickBank, ShareASale keys)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Links to auth.users
  network_id TEXT NOT NULL CHECK (network_id IN ('clickbank', 'shareasale', 'amazon')),
  api_key TEXT NOT NULL, -- Encrypted at rest
  api_secret TEXT, -- For OAuth networks like ShareASale
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, network_id)
);

-- RLS: Users can only see their own integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to get user's active integration credentials
CREATE OR REPLACE FUNCTION get_user_integration(p_network TEXT)
RETURNS TABLE (api_key TEXT, api_secret TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ui.api_key, ui.api_secret
  FROM user_integrations ui
  WHERE ui.user_id = auth.uid()
    AND ui.network_id = p_network
    AND ui.is_active = TRUE
  LIMIT 1;
END;
$$;
