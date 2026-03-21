-- ============================================================================
-- MIGRATION 010: RaaS Missions Tables
-- ============================================================================
-- Creates: missions, mission_templates
-- Enables: RLS policies, indexes, seed data
-- ============================================================================

-- ============================================================================
-- 1. MISSIONS TABLE
-- Tracks every submitted robot mission (PEV execution unit)
-- ============================================================================
create table public.missions (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        not null references organizations(id) on delete cascade,
  title            text        not null,
  description      text,
  command          text        not null,
  params           jsonb       not null default '{}',
  status           text        not null default 'queued'
                               check (status in ('queued','planning','executing','verifying','completed','failed')),
  priority         text        not null default 'normal'
                               check (priority in ('low','normal','high','urgent')),
  mcu_cost         integer     not null default 0,
  mcu_reserved     integer     not null default 0,
  result           jsonb,
  error_message    text,
  plan             jsonb,
  execution_log    jsonb       not null default '[]',
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================================
-- 2. MISSION_TEMPLATES TABLE
-- Catalog of available OpenClaw commands with MCU costs
-- ============================================================================
create table public.mission_templates (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  command         text        not null unique,
  description     text,
  default_params  jsonb       not null default '{}',
  mcu_cost        integer     not null,
  category        text        not null
                              check (category in ('proposal','video','affiliate','content','analytics')),
  is_active       boolean     not null default true,
  icon            text,
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
create index missions_org_id_idx         on public.missions (org_id);
create index missions_status_idx         on public.missions (status);
create index missions_command_idx        on public.missions (command);
create index missions_created_at_idx     on public.missions (created_at desc);
create index missions_org_status_idx     on public.missions (org_id, status);
create index mission_templates_category  on public.mission_templates (category);
create index mission_templates_active    on public.mission_templates (is_active) where is_active = true;

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger missions_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================
alter table public.missions          enable row level security;
alter table public.mission_templates enable row level security;

-- missions: orgs see only their own missions
create policy "missions_select_own"
  on public.missions for select
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid()
  ));

create policy "missions_insert_own"
  on public.missions for insert
  with check (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid()
  ));

create policy "missions_update_own"
  on public.missions for update
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid()
  ));

-- mission_templates: public read, service-role write
create policy "mission_templates_public_read"
  on public.mission_templates for select
  using (true);

-- ============================================================================
-- 6. SEED MISSION TEMPLATES
-- ============================================================================
insert into public.mission_templates
  (name, command, description, default_params, mcu_cost, category, icon)
values
  (
    'Generate AI Proposal',
    'proposal:create',
    'Create a professional AI-generated sales proposal tailored to your prospect.',
    '{"tone":"professional","sections":["executive_summary","solution","pricing","timeline"]}',
    100, 'proposal', '📝'
  ),
  (
    'Create Video Review',
    'video:create',
    'Generate a HeyGen AI avatar video review for a product or service.',
    '{"duration":60,"avatar":"default","voice":"en-US-Neural"}',
    200, 'video', '🎥'
  ),
  (
    'Affiliate Content Bundle',
    'affiliate:generate',
    'Generate blog post + social media bundle for an affiliate program.',
    '{"include_blog":true,"include_social":true,"include_video":false}',
    260, 'affiliate', '💰'
  ),
  (
    'Scrape Affiliate Programs',
    'affiliate:scrape',
    'Refresh the affiliate program directory from PartnerStack and seed data.',
    '{}',
    5, 'affiliate', '🔍'
  ),
  (
    'Generate Blog Post',
    'content:blog',
    'Write an SEO-optimized blog post on any topic (600–800 words).',
    '{"word_count":700,"tone":"informative","include_cta":true}',
    50, 'content', '📰'
  ),
  (
    'Social Media Bundle',
    'content:social',
    'Generate LinkedIn + Twitter + TikTok script for a product or campaign.',
    '{"platforms":["linkedin","twitter","tiktok"]}',
    10, 'content', '📱'
  ),
  (
    'CRM Sync',
    'crm:sync',
    'Sync contacts and deals from HubSpot into Sophia.',
    '{}',
    20, 'analytics', '🔄'
  ),
  (
    'Analytics Export',
    'analytics:export',
    'Export usage, conversion, or metrics data as CSV or JSON.',
    '{"type":"usage","format":"csv","dateRange":30}',
    5, 'analytics', '📊'
  ),
  (
    'Full GTM Campaign',
    'gtm:campaign',
    'End-to-end go-to-market: proposal + video + blog + social bundle.',
    '{"include_proposal":true,"include_video":true,"include_blog":true,"include_social":true}',
    500, 'content', '🚀'
  ),
  (
    'Competitive Battlecard',
    'sales:battlecard',
    'Generate a competitive intelligence battlecard for sales teams.',
    '{"format":"markdown","sections":["strengths","weaknesses","objections","counter_points"]}',
    30, 'content', '⚔️'
  );
