-- Migration 0007: Leads table for LeadHunter AI agent
-- Stores AI-generated prospect leads by ICP criteria

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT,
  estimated_size TEXT,
  decision_maker_title TEXT,
  pain_points TEXT, -- JSON array
  fit_score INTEGER DEFAULT 0,
  approach_angle TEXT,
  suggested_first_touch TEXT,
  source TEXT DEFAULT 'lead-hunter-ai',
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  email TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);

-- Email outreach tracking
CREATE TABLE IF NOT EXISTS email_outreach (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_id TEXT NOT NULL,
  lead_id TEXT,
  mission_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'sent', -- sent, delivered, opened, clicked, bounced
  provider TEXT DEFAULT 'resend',
  message_id TEXT,
  sequence_day INTEGER,
  sent_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE INDEX IF NOT EXISTS idx_email_outreach_org ON email_outreach(org_id);
CREATE INDEX IF NOT EXISTS idx_email_outreach_lead ON email_outreach(lead_id);
