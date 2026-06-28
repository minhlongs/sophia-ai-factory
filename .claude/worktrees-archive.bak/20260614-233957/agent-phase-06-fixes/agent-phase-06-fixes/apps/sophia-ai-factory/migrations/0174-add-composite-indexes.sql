-- Add composite indexes for common query patterns
-- sop_templates: frequently filtered by author + status
CREATE INDEX IF NOT EXISTS idx_sop_templates_author_status ON sop_templates(author_user_id, status);
-- org_members: frequently filtered by org + role (for permission checks)
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON org_members(org_id, role);
