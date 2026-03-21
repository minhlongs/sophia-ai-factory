-- ============================================================================
-- MIGRATION 005: Video Assets and Templates Tables
-- ============================================================================
-- Creates: video_assets, video_templates tables for HeyGen integration
-- Enables: RLS policies, indexes, and video generation workflow
-- ============================================================================

-- ============================================================================
-- 1. VIDEO_TEMPLATES TABLE
-- ============================================================================
create table public.video_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade, -- null = global template
  name text not null,
  description text,
  template_type text not null check (template_type in ('intro', 'section', 'full_proposal', 'custom')),
  heygen_template_id text,
  avatar_id text,
  voice_id text,
  background_id text,
  default_script text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_video_templates_org_id on public.video_templates(org_id);
create index idx_video_templates_type on public.video_templates(template_type);
create index idx_video_templates_active on public.video_templates(is_active);

-- ============================================================================
-- 2. VIDEO_ASSETS TABLE
-- ============================================================================
create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  heygen_video_id text not null unique,
  video_type text not null check (video_type in ('intro', 'section', 'full_proposal', 'custom')),
  template_id uuid references public.video_templates(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  video_url text,
  preview_url text,
  script_text text not null,
  avatar_id text,
  voice_id text,
  background_id text,
  duration_seconds integer,
  mcu_cost integer not null,
  error_message text,
  heygen_response jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ready_at timestamptz
);

create index idx_video_assets_org_id on public.video_assets(org_id);
create index idx_video_assets_proposal_id on public.video_assets(proposal_id);
create index idx_video_assets_status on public.video_assets(status);
create index idx_video_assets_heygen_id on public.video_assets(heygen_video_id);
create index idx_video_assets_created on public.video_assets(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table public.video_templates enable row level security;
alter table public.video_assets enable row level security;

-- ----------------------------------------------------------------------------
-- Video Templates Policies
-- ----------------------------------------------------------------------------
create policy "Anyone can view active global templates"
  on public.video_templates
  for select
  using (
    org_id is null and is_active = true
  );

create policy "Org members can view org templates"
  on public.video_templates
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Org admins can manage org templates"
  on public.video_templates
  for all
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Service role can manage templates"
  on public.video_templates
  for all
  using (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Video Assets Policies
-- ----------------------------------------------------------------------------
create policy "Org members can view video assets"
  on public.video_assets
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Org members can create video assets"
  on public.video_assets
  for insert
  with check (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Org members can update video assets"
  on public.video_assets
  for update
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage video assets"
  on public.video_assets
  for all
  using (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Create Video Asset
-- Creates a new video asset record with HeyGen video ID
-- ----------------------------------------------------------------------------
create or replace function public.create_video_asset(
  p_org_id uuid,
  p_proposal_id uuid,
  p_heygen_video_id text,
  p_video_type text,
  p_script_text text,
  p_template_id uuid default null,
  p_avatar_id text default null,
  p_voice_id text default null,
  p_background_id text default null,
  p_mcu_cost integer
)
returns uuid as $$
declare
  v_video_id uuid;
begin
  insert into public.video_assets (
    org_id,
    proposal_id,
    heygen_video_id,
    video_type,
    template_id,
    status,
    script_text,
    avatar_id,
    voice_id,
    background_id,
    mcu_cost
  ) values (
    p_org_id,
    p_proposal_id,
    p_heygen_video_id,
    p_video_type,
    p_template_id,
    'pending',
    p_script_text,
    p_avatar_id,
    p_voice_id,
    p_background_id,
    p_mcu_cost
  )
  returning id into v_video_id;

  return v_video_id;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- Function: Update Video Status
-- Updates video status from webhook or polling
-- ----------------------------------------------------------------------------
create or replace function public.update_video_status(
  p_heygen_video_id text,
  p_status text,
  p_video_url text default null,
  p_preview_url text default null,
  p_duration_seconds integer default null,
  p_error_message text default null,
  p_heygen_response jsonb default null
)
returns void as $$
begin
  update public.video_assets
  set
    status = p_status,
    video_url = p_video_url,
    preview_url = p_preview_url,
    duration_seconds = p_duration_seconds,
    error_message = p_error_message,
    heygen_response = coalesce(p_heygen_response, heygen_response),
    updated_at = now(),
    ready_at = case when p_status = 'ready' then now() else ready_at end
  where heygen_video_id = p_heygen_video_id;
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- Function: Deduct MCU for Video
-- Deducts MCU balance when video is ready (called from webhook)
-- Returns true if successful, false if insufficient balance
-- ----------------------------------------------------------------------------
create or replace function public.deduct_mcu_for_video(
  p_video_id uuid
)
returns boolean as $$
declare
  v_org_id uuid;
  v_mcu_cost integer;
  v_success boolean;
begin
  -- Get video org_id and cost
  select org_id, mcu_cost into v_org_id, v_mcu_cost
  from public.video_assets
  where id = p_video_id;

  if v_org_id is null then
    return false;
  end if;

  -- Deduct MCU balance
  v_success := public.deduct_mcu_balance(
    v_org_id,
    v_mcu_cost,
    'video_generation',
    jsonb_build_object('video_id', p_video_id)
  );

  return v_success;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
create or replace function public.update_video_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger video_templates_updated_at
  before update on public.video_templates
  for each row
  execute function public.update_video_templates_updated_at();

create or replace function public.update_video_assets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger video_assets_updated_at
  before update on public.video_assets
  for each row
  execute function public.update_video_assets_updated_at();

-- ============================================================================
-- SEED DATA: Global Templates
-- ============================================================================

-- Default intro template
insert into public.video_templates (
  name,
  description,
  template_type,
  is_active,
  default_script
) values (
  'Professional Introduction',
  'Standard 30-second intro for proposals',
  'intro',
  true,
  'Hi, I''m excited to present this proposal for your project. Let me walk you through how we can help achieve your goals.'
);

-- Default section template
insert into public.video_templates (
  name,
  description,
  template_type,
  is_active,
  default_script
) values (
  'Section Overview',
  '60-second section explanation template',
  'section',
  true,
  'Let me explain this section in more detail. This is a key part of our proposed solution.'
);

-- Default full proposal template
insert into public.video_templates (
  name,
  description,
  template_type,
  is_active,
  default_script
) values (
  'Full Proposal Summary',
  '2-3 minute complete proposal overview',
  'full_proposal',
  true,
  'Thank you for considering our proposal. Here''s a complete summary of how we''ll work together to achieve your objectives.'
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
