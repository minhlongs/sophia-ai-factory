-- ============================================================================
-- MIGRATION 004: Billing Tables for Polar Integration
-- ============================================================================
-- Creates: subscriptions, usage_logs, org_balances, billing_settings, customer_feedback
-- Enables: RLS policies, indexes, and utility functions
-- ============================================================================

-- ============================================================================
-- 1. SUBSCRIPTIONS TABLE
-- ============================================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  polar_customer_id text not null,
  polar_subscription_id text unique,
  polar_product_id text not null,
  tier_name text not null, -- 'starter', 'growth', 'premium', 'master'
  status text not null default 'inactive', -- 'active', 'inactive', 'cancelled', 'past_due'
  mcu_monthly integer not null,
  mcu_overage_rate numeric not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  ended_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_org_id on public.subscriptions(org_id);
create index idx_subscriptions_polar_customer on public.subscriptions(polar_customer_id);
create index idx_subscriptions_status on public.subscriptions(status);

-- ============================================================================
-- 2. USAGE_LOGS TABLE
-- ============================================================================
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature text not null, -- 'proposal_generation', 'video_generation', etc.
  mcu_cost integer not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_usage_logs_org_id on public.usage_logs(org_id);
create index idx_usage_logs_feature on public.usage_logs(feature);
create index idx_usage_logs_created on public.usage_logs(created_at);

-- ============================================================================
-- 3. ORG_BALANCES TABLE
-- ============================================================================
create table public.org_balances (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  balance integer not null default 0,
  lifetime_credits integer not null default 0,
  lifetime_used integer not null default 0,
  last_updated timestamptz default now()
);

create index idx_org_balances_balance on public.org_balances(balance);

-- ============================================================================
-- 4. BILLING_SETTINGS TABLE
-- ============================================================================
create table public.billing_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  polar_customer_id text,
  auto_recharge boolean default false,
  recharge_threshold integer default 100,
  recharge_amount integer default 500,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 5. CUSTOMER_FEEDBACK TABLE
-- ============================================================================
create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  survey_type text not null, -- 'nps', 'onboarding', 'churn'
  responses jsonb not null,
  nps_score integer,
  submitted_at timestamptz default now()
);

create index idx_customer_feedback_org on public.customer_feedback(org_id);
create index idx_customer_feedback_type on public.customer_feedback(survey_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table public.subscriptions enable row level security;
alter table public.usage_logs enable row level security;
alter table public.org_balances enable row level security;
alter table public.billing_settings enable row level security;
alter table public.customer_feedback enable row level security;

-- ----------------------------------------------------------------------------
-- Subscriptions Policies
-- ----------------------------------------------------------------------------
create policy "Org members can view subscriptions"
  on public.subscriptions
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage subscriptions"
  on public.subscriptions
  for all
  using (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Usage Logs Policies
-- ----------------------------------------------------------------------------
create policy "Org members can view usage logs"
  on public.usage_logs
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can insert usage logs"
  on public.usage_logs
  for insert
  with check (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Org Balances Policies
-- ----------------------------------------------------------------------------
create policy "Org members can view balance"
  on public.org_balances
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Service role can manage balances"
  on public.org_balances
  for all
  using (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Billing Settings Policies
-- ----------------------------------------------------------------------------
create policy "Org admins can manage billing settings"
  on public.billing_settings
  for all
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- Customer Feedback Policies
-- ----------------------------------------------------------------------------
create policy "Org members can submit feedback"
  on public.customer_feedback
  for insert
  with check (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Org members can view their feedback"
  on public.customer_feedback
  for select
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Credit MCU Balance
-- Adds MCU credits to an organization's balance
-- ----------------------------------------------------------------------------
create or replace function public.credit_mcu_balance(
  p_org_id uuid,
  p_amount integer,
  p_subscription_id text
)
returns void as $$
declare
  v_current_balance integer;
begin
  -- Get current balance
  select balance into v_current_balance
  from public.org_balances
  where org_id = p_org_id;

  if v_current_balance is null then
    -- Create new balance record
    insert into public.org_balances (org_id, balance, lifetime_credits)
    values (p_org_id, p_amount, p_amount);
  else
    -- Update existing balance
    update public.org_balances
    set
      balance = balance + p_amount,
      lifetime_credits = lifetime_credits + p_amount,
      last_updated = now()
    where org_id = p_org_id;
  end if;

  -- Log the credit event
  insert into public.usage_logs (org_id, feature, mcu_cost, metadata)
  values (p_org_id, 'subscription_credit', -p_amount, jsonb_build_object('subscription_id', p_subscription_id));
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- Function: Deduct MCU Balance
-- Deducts MCU from an organization's balance
-- Returns true if successful, false if insufficient balance
-- ----------------------------------------------------------------------------
create or replace function public.deduct_mcu_balance(
  p_org_id uuid,
  p_amount integer,
  p_feature text,
  p_metadata jsonb default '{}'
)
returns boolean as $$
declare
  v_current_balance integer;
begin
  -- Get current balance
  select balance into v_current_balance
  from public.org_balances
  where org_id = p_org_id;

  -- Check if sufficient balance
  if v_current_balance is null or v_current_balance < p_amount then
    return false;
  end if;

  -- Deduct balance
  update public.org_balances
  set
    balance = balance - p_amount,
    lifetime_used = lifetime_used + p_amount,
    last_updated = now()
  where org_id = p_org_id;

  -- Log the usage
  insert into public.usage_logs (org_id, feature, mcu_cost, metadata)
  values (p_org_id, p_feature, p_amount, p_metadata);

  return true;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
