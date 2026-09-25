-- Migration 0292: Enterprise Deals CRM & AI Lead Enrichment Engine
-- Milestone: $200K MRR — Autonomous Enterprise Sales Pipeline, B2B Lead Enrichment & AI Sales Fleet
-- Target: Cloudflare D1 (sophia-raas-db)

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- 1. Table: enterprise_deals
CREATE TABLE IF NOT EXISTS enterprise_deals (
  id TEXT PRIMARY KEY,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  lead_phone TEXT,
  lead_title TEXT,
  company_name TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  lead_source TEXT NOT NULL DEFAULT 'website' CHECK (
    lead_source IN ('website', 'inbound_form', 'telegram', 'outbound', 'referral', 'event', 'partner')
  ),
  deal_stage TEXT NOT NULL DEFAULT 'new_lead' CHECK (
    deal_stage IN (
      'new_lead',
      'enriching',
      'qualified',
      'demo_prepared',
      'demo_active',
      'proposal_sent',
      'negotiating',
      'closed_won',
      'closed_lost'
    )
  ),
  pipeline_tier TEXT NOT NULL DEFAULT 'cold' CHECK (pipeline_tier IN ('hot', 'warm', 'cold')),
  deal_value_estimate_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND', 'EUR', 'JPY', 'SGD')),
  requested_mcu_monthly INTEGER NOT NULL DEFAULT 0,
  
  -- BANT 4-Factor Qualification Scores (0-25 each, Total 0-100)
  bant_score INTEGER NOT NULL DEFAULT 0 CHECK (bant_score >= 0 AND bant_score <= 100),
  bant_budget_score INTEGER NOT NULL DEFAULT 0 CHECK (bant_budget_score >= 0 AND bant_budget_score <= 25),
  bant_authority_score INTEGER NOT NULL DEFAULT 0 CHECK (bant_authority_score >= 0 AND bant_authority_score <= 25),
  bant_need_score INTEGER NOT NULL DEFAULT 0 CHECK (bant_need_score >= 0 AND bant_need_score <= 25),
  bant_timeline_score INTEGER NOT NULL DEFAULT 0 CHECK (bant_timeline_score >= 0 AND bant_timeline_score <= 25),
  bant_analysis_json TEXT NOT NULL DEFAULT '{}',

  -- Assigned Agent & Briefing
  assigned_agent_id TEXT,
  assigned_agent_role TEXT NOT NULL DEFAULT 'ai_sales_executive' CHECK (
    assigned_agent_role IN ('ai_sales_executive', 'human_executive', 'unassigned')
  ),
  meeting_prep_brief TEXT,
  
  -- Proposal Generation
  proposal_id TEXT,
  proposal_language TEXT NOT NULL DEFAULT 'en' CHECK (proposal_language IN ('en', 'vi')),
  proposal_content TEXT,

  -- 1-Click Sandbox Demo Workspace Linkage
  sandbox_subaccount_id TEXT REFERENCES client_subaccounts(id) ON DELETE SET NULL,
  sandbox_status TEXT NOT NULL DEFAULT 'none' CHECK (
    sandbox_status IN ('none', 'provisioning', 'active', 'expired', 'converted')
  ),
  sandbox_token TEXT,
  sandbox_expires_at INTEGER,

  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_deals_stage ON enterprise_deals(deal_stage);
CREATE INDEX IF NOT EXISTS idx_enterprise_deals_pipeline_tier ON enterprise_deals(pipeline_tier);
CREATE INDEX IF NOT EXISTS idx_enterprise_deals_domain ON enterprise_deals(company_domain);
CREATE INDEX IF NOT EXISTS idx_enterprise_deals_bant_score ON enterprise_deals(bant_score DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_deals_created ON enterprise_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_deals_sandbox ON enterprise_deals(sandbox_subaccount_id);

-- 2. Table: enterprise_lead_enrichments
CREATE TABLE IF NOT EXISTS enterprise_lead_enrichments (
  id TEXT PRIMARY KEY,
  deal_id TEXT REFERENCES enterprise_deals(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  employee_count_range TEXT,
  estimated_annual_revenue TEXT,
  headquarters_location TEXT,
  country TEXT,
  tech_stack_json TEXT NOT NULL DEFAULT '[]',
  linkedin_company_url TEXT,
  twitter_handle TEXT,
  enrichment_source TEXT NOT NULL DEFAULT 'heuristic' CHECK (
    enrichment_source IN ('clearbit', 'hunter', 'apollo', 'ai_web_search', 'heuristic', 'manual')
  ),
  confidence_score REAL NOT NULL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'stale')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_ele_deal_id ON enterprise_lead_enrichments(deal_id);
CREATE INDEX IF NOT EXISTS idx_ele_domain ON enterprise_lead_enrichments(domain);
CREATE INDEX IF NOT EXISTS idx_ele_industry ON enterprise_lead_enrichments(industry);
CREATE INDEX IF NOT EXISTS idx_ele_status ON enterprise_lead_enrichments(status);
