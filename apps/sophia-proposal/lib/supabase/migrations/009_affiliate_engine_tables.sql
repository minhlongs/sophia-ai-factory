-- ============================================================================
-- MIGRATION 009: Affiliate Engine Tables
-- ============================================================================
-- Creates: affiliate_programs, affiliate_content, affiliate_clicks,
--          affiliate_revenue
-- Enables: RLS policies, indexes
-- ============================================================================

-- ============================================================================
-- 1. AFFILIATE_PROGRAMS TABLE
-- Global directory of SaaS affiliate programs, scored 0-100
-- Public read; write via service role only (scraper/admin)
-- ============================================================================
create table public.affiliate_programs (
  id                   uuid        primary key default gen_random_uuid(),
  name                 text        not null,
  company              text        not null,
  url                  text        not null,
  signup_url           text,
  commission_rate      numeric     not null,              -- percentage e.g. 30.0
  commission_type      text        not null default 'recurring',
  cookie_duration_days integer     not null default 30,
  payout_threshold     numeric     not null default 50,
  payout_frequency     text        not null default 'monthly',
  niche                text        not null,
  description          text,
  logo_url             text,
  score                numeric     not null default 0,    -- computed 0-100
  is_active            boolean     not null default true,
  source               text        not null default 'manual',
  external_id          text,
  metadata             jsonb       not null default '{}',
  last_scraped_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint affiliate_programs_commission_type_check
    check (commission_type in ('recurring', 'one-time', 'tiered')),
  constraint affiliate_programs_source_check
    check (source in ('manual', 'scraper', 'affitor', 'partnerstack')),
  constraint affiliate_programs_score_check
    check (score >= 0 and score <= 100)
);

-- ============================================================================
-- 2. AFFILIATE_CONTENT TABLE
-- AI-generated content (blog, video, social) tied to a program + org
-- ============================================================================
create table public.affiliate_content (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  program_id      uuid        not null references public.affiliate_programs(id) on delete cascade,
  content_type    text        not null,
  title           text        not null,
  body            text,                                   -- markdown or script
  status          text        not null default 'draft',
  mcu_cost        integer     not null default 0,
  video_asset_id  uuid        references public.video_assets(id) on delete set null,
  published_url   text,
  affiliate_link  text        not null,                   -- tracked UTM link
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint affiliate_content_type_check
    check (content_type in ('blog', 'video', 'social', 'comparison')),
  constraint affiliate_content_status_check
    check (status in ('draft', 'generating', 'ready', 'published', 'failed'))
);

-- ============================================================================
-- 3. AFFILIATE_CLICKS TABLE
-- Immutable click log; IP stored as SHA-256 hash only (privacy)
-- ============================================================================
create table public.affiliate_clicks (
  id          uuid        primary key default gen_random_uuid(),
  content_id  uuid        references public.affiliate_content(id) on delete set null,
  program_id  uuid        not null references public.affiliate_programs(id) on delete cascade,
  ip_hash     text,                                       -- SHA-256, never raw IP
  user_agent  text,
  referrer    text,
  country     text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 4. AFFILIATE_REVENUE TABLE
-- Revenue records per org per program per period
-- ============================================================================
create table public.affiliate_revenue (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  program_id   uuid        not null references public.affiliate_programs(id) on delete cascade,
  content_id   uuid        references public.affiliate_content(id) on delete set null,
  amount       numeric     not null,
  currency     text        not null default 'USD',
  status       text        not null default 'pending',
  period_month text,                                      -- '2026-03'
  metadata     jsonb       not null default '{}',
  created_at   timestamptz not null default now(),

  constraint affiliate_revenue_status_check
    check (status in ('pending', 'confirmed', 'paid'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index idx_affiliate_programs_niche     on public.affiliate_programs(niche);
create index idx_affiliate_programs_score     on public.affiliate_programs(score desc);
create index idx_affiliate_programs_is_active on public.affiliate_programs(is_active);
create index idx_affiliate_programs_source    on public.affiliate_programs(source);

create index idx_affiliate_content_org_id      on public.affiliate_content(org_id);
create index idx_affiliate_content_program_id  on public.affiliate_content(program_id);
create index idx_affiliate_content_status      on public.affiliate_content(status);
create index idx_affiliate_content_type        on public.affiliate_content(content_type);

create index idx_affiliate_clicks_program_id  on public.affiliate_clicks(program_id);
create index idx_affiliate_clicks_content_id  on public.affiliate_clicks(content_id);
create index idx_affiliate_clicks_created_at  on public.affiliate_clicks(created_at desc);

create index idx_affiliate_revenue_org_id       on public.affiliate_revenue(org_id);
create index idx_affiliate_revenue_program_id   on public.affiliate_revenue(program_id);
create index idx_affiliate_revenue_status       on public.affiliate_revenue(status);
create index idx_affiliate_revenue_period_month on public.affiliate_revenue(period_month);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.affiliate_programs  enable row level security;
alter table public.affiliate_content   enable row level security;
alter table public.affiliate_clicks    enable row level security;
alter table public.affiliate_revenue   enable row level security;

-- affiliate_programs: public read; no direct user writes (service role only)
create policy "affiliate_programs_select_public"
  on public.affiliate_programs for select
  using (true);

-- affiliate_content: org members read/write their own content
create policy "affiliate_content_select_own"
  on public.affiliate_content for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "affiliate_content_insert_own"
  on public.affiliate_content for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

create policy "affiliate_content_update_own"
  on public.affiliate_content for update
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- affiliate_clicks: insert open (tracking pixel), select restricted to service role
create policy "affiliate_clicks_insert_public"
  on public.affiliate_clicks for insert
  with check (true);

-- affiliate_revenue: org members read their own revenue
create policy "affiliate_revenue_select_own"
  on public.affiliate_revenue for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );
