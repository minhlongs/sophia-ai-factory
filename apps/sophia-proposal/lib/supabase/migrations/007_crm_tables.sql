-- ============================================================================
-- MIGRATION 007: CRM Tables for HubSpot Integration
-- ============================================================================
-- Creates: crm_settings, contacts, deals, crm_sync_status
-- Enables: RLS policies, indexes, unique constraints
-- ============================================================================

-- ============================================================================
-- 1. CRM_SETTINGS TABLE
-- Stores HubSpot OAuth tokens per organization
-- ============================================================================
create table public.crm_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  hubspot_access_token text,
  hubspot_refresh_token text,
  hubspot_token_expires_at timestamptz,
  hubspot_portal_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 2. CONTACTS TABLE
-- Local copy of HubSpot contacts synced per organization
-- ============================================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,          -- HubSpot contact ID
  email text,
  first_name text,
  last_name text,
  phone text,
  company text,
  source text not null default 'hubspot',
  external_data jsonb default '{}',   -- Raw HubSpot response
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_contacts_org_external unique (org_id, external_id, source)
);

create index idx_contacts_org_id on public.contacts(org_id);
create index idx_contacts_external_id on public.contacts(external_id);
create index idx_contacts_email on public.contacts(email);

-- ============================================================================
-- 3. DEALS TABLE
-- Local copy of HubSpot deals synced per organization
-- ============================================================================
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,          -- HubSpot deal ID
  name text,
  amount numeric,
  stage text,
  pipeline text,
  close_date date,
  proposal_id uuid references public.proposals(id) on delete set null,
  source text not null default 'hubspot',
  external_data jsonb default '{}',   -- Raw HubSpot response
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_deals_org_external unique (org_id, external_id, source)
);

create index idx_deals_org_id on public.deals(org_id);
create index idx_deals_external_id on public.deals(external_id);
create index idx_deals_proposal_id on public.deals(proposal_id);

-- ============================================================================
-- 4. CRM_SYNC_STATUS TABLE
-- Tracks last sync state per organization
-- ============================================================================
create table public.crm_sync_status (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  last_sync timestamptz,
  status text not null default 'idle',  -- 'idle', 'syncing', 'completed', 'error'
  error_message text,
  contacts_synced integer not null default 0,
  deals_synced integer not null default 0,
  companies_synced integer not null default 0
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================
alter table public.crm_settings enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.crm_sync_status enable row level security;

-- crm_settings: org members can view; service role manages
create policy "Org members can view crm settings"
  on public.crm_settings for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage crm settings"
  on public.crm_settings for all
  using (auth.jwt()->>'role' = 'service_role');

-- contacts: org members can view; service role manages
create policy "Org members can view contacts"
  on public.contacts for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage contacts"
  on public.contacts for all
  using (auth.jwt()->>'role' = 'service_role');

-- deals: org members can view; service role manages
create policy "Org members can view deals"
  on public.deals for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage deals"
  on public.deals for all
  using (auth.jwt()->>'role' = 'service_role');

-- crm_sync_status: org members can view; service role manages
create policy "Org members can view crm sync status"
  on public.crm_sync_status for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage crm sync status"
  on public.crm_sync_status for all
  using (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
