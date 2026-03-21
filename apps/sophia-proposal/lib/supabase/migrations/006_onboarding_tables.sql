-- ============================================================================
-- MIGRATION 006: Onboarding Tables
-- ============================================================================
-- Creates: onboarding_progress, onboarding_events, scheduled_emails
-- Enables: Self-serve onboarding flow with email sequences
-- ============================================================================

-- ============================================================================
-- 1. ONBOARDING_PROGRESS TABLE
-- ============================================================================
create table public.onboarding_progress (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  steps jsonb not null default '[]',
  progress integer not null default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_onboarding_progress_progress on public.onboarding_progress(progress desc);

-- ============================================================================
-- 2. ONBOARDING_EVENTS TABLE (for analytics)
-- ============================================================================
create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_id text not null,
  action text not null, -- 'started', 'completed', 'skipped'
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_onboarding_events_user on public.onboarding_events(user_id);
create index idx_onboarding_events_org on public.onboarding_events(org_id);
create index idx_onboarding_events_created on public.onboarding_events(created_at);

-- ============================================================================
-- 3. SCHEDULED_EMAILS TABLE (for email sequences)
-- ============================================================================
create table public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  template text not null, -- 'day_0', 'day_1', 'day_3', 'day_5', 'day_7', 'nps_survey'
  send_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending', -- 'pending', 'sent', 'failed'
  created_at timestamptz default now()
);

create index idx_scheduled_emails_send_at on public.scheduled_emails(send_at);
create index idx_scheduled_emails_status on public.scheduled_emails(status);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Onboarding progress: org members can view their own
create policy "Org members can view onboarding progress"
  on public.onboarding_progress for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = onboarding_progress.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- Onboarding events: users can view their own
create policy "Users can view own onboarding events"
  on public.onboarding_events for select
  using (user_id = auth.uid());

-- Scheduled emails: org members can view
create policy "Org members can view scheduled emails"
  on public.scheduled_emails for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = scheduled_emails.org_id
      and org_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. UTILITY FUNCTIONS
-- ============================================================================

-- Initialize onboarding progress for new org
create or replace function initialize_onboarding_progress()
returns trigger as $$
begin
  insert into public.onboarding_progress (org_id, steps, progress)
  values (new.id, '[]', 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on org creation
create trigger on_org_created
  after insert on public.organizations
  for each row
  execute function initialize_onboarding_progress();

-- Schedule welcome email on signup
create or replace function schedule_welcome_emails()
returns trigger as $$
begin
  -- Day 0: Welcome
  insert into public.scheduled_emails (org_id, user_id, template, send_at)
  values (new.org_id, new.user_id, 'day_0', now());

  -- Day 1: First proposal
  insert into public.scheduled_emails (org_id, user_id, template, send_at)
  values (new.org_id, new.user_id, 'day_1', now() + interval '24 hours');

  -- Day 3: Case study
  insert into public.scheduled_emails (org_id, user_id, template, send_at)
  values (new.org_id, new.user_id, 'day_3', now() + interval '72 hours');

  -- Day 5: Video tip
  insert into public.scheduled_emails (org_id, user_id, template, send_at)
  values (new.org_id, new.user_id, 'day_5', now() + interval '120 hours');

  -- Day 7: NPS survey
  insert into public.scheduled_emails (org_id, user_id, template, send_at)
  values (new.org_id, new.user_id, 'day_7', now() + interval '168 hours');

  return new;
end;
$$ language plpgsql security definer;

-- Trigger on first onboarding step
create trigger on_onboarding_started
  after insert on public.onboarding_events
  for each row
  when (new.action = 'started')
  execute function schedule_welcome_emails();
