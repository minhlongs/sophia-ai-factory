-- ============================================================================
-- MIGRATION 008: Referral / Affiliate System
-- ============================================================================
-- Creates: referral_codes, referral_events, affiliate_payouts
-- Enables: RLS policies, indexes
-- ============================================================================

-- ============================================================================
-- 1. REFERRAL_CODES TABLE
-- One referral code per org; tracks aggregate stats
-- ============================================================================
create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  commission_rate numeric not null default 0.20, -- 20% default
  is_active boolean not null default true,
  clicks integer not null default 0,
  signups integer not null default 0,
  conversions integer not null default 0,
  total_earned numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. REFERRAL_EVENTS TABLE
-- Immutable audit log of every referral touchpoint
-- event_type: 'click' | 'signup' | 'trial' | 'conversion' | 'payout'
-- ============================================================================
create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_org_id uuid not null references public.organizations(id) on delete cascade,
  referred_org_id uuid references public.organizations(id) on delete set null,
  referral_code text not null,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint referral_events_event_type_check
    check (event_type in ('click', 'signup', 'trial', 'conversion', 'payout'))
);

-- ============================================================================
-- 3. AFFILIATE_PAYOUTS TABLE
-- Aggregated payout records per org per period
-- ============================================================================
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric not null,
  status text not null default 'pending',
  payout_method text not null default 'credit', -- 'credit' (MCU), 'polar', 'bank'
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  constraint affiliate_payouts_status_check
    check (status in ('pending', 'processing', 'paid', 'failed')),
  constraint affiliate_payouts_method_check
    check (payout_method in ('credit', 'polar', 'bank'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index idx_referral_codes_org_id on public.referral_codes(org_id);
create index idx_referral_codes_code on public.referral_codes(code);
create index idx_referral_events_referrer_org on public.referral_events(referrer_org_id);
create index idx_referral_events_referred_org on public.referral_events(referred_org_id);
create index idx_referral_events_code on public.referral_events(referral_code);
create index idx_referral_events_type on public.referral_events(event_type);
create index idx_affiliate_payouts_org_id on public.affiliate_payouts(org_id);
create index idx_affiliate_payouts_status on public.affiliate_payouts(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;
alter table public.affiliate_payouts enable row level security;

-- referral_codes: org members can read their own codes
create policy "referral_codes_select_own"
  on public.referral_codes for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "referral_codes_insert_own"
  on public.referral_codes for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "referral_codes_update_own"
  on public.referral_codes for update
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- referral_events: org members can read events where they are the referrer
create policy "referral_events_select_own"
  on public.referral_events for select
  using (
    referrer_org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- clicks can be inserted without auth (public tracking endpoint uses service role)
create policy "referral_events_insert_service"
  on public.referral_events for insert
  with check (true); -- service_role key enforced at API level

-- affiliate_payouts: org members can read their own payouts
create policy "affiliate_payouts_select_own"
  on public.affiliate_payouts for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER: increment_referral_counter(code, field)
-- Used by track API to atomically bump click/signup counters
-- ============================================================================
create or replace function public.increment_referral_counter(
  p_code text,
  p_field text -- 'clicks' | 'signups' | 'conversions'
) returns void
language plpgsql
security definer
as $$
begin
  if p_field = 'clicks' then
    update public.referral_codes set clicks = clicks + 1 where code = p_code;
  elsif p_field = 'signups' then
    update public.referral_codes set signups = signups + 1 where code = p_code;
  elsif p_field = 'conversions' then
    update public.referral_codes set conversions = conversions + 1 where code = p_code;
  end if;
end;
$$;
