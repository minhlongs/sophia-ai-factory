-- Create campaign_checkpoints table for SmartResumeEngine
create table campaign_checkpoints (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade not null,
  step text not null,
  completed_at timestamptz default now() not null,
  metadata jsonb,

  -- Ensure unique checkpoint per step for a campaign to support upsert
  unique(campaign_id, step)
);

-- Index for quick lookup by campaign_id
create index idx_campaign_checkpoints_campaign_id on campaign_checkpoints(campaign_id);

-- Enable RLS
alter table campaign_checkpoints enable row level security;

-- Policies: Users can only manage checkpoints for their own campaigns
create policy "Users can view checkpoints for their own campaigns"
  on campaign_checkpoints for select
  using (
    exists (
      select 1 from campaigns
      where campaigns.id = campaign_checkpoints.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );

create policy "Users can manage checkpoints for their own campaigns"
  on campaign_checkpoints for all
  using (
    exists (
      select 1 from campaigns
      where campaigns.id = campaign_checkpoints.campaign_id
      and campaigns.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from campaigns
      where campaigns.id = campaign_checkpoints.campaign_id
      and campaigns.user_id = auth.uid()
    )
  );

-- Add to realtime
alter publication supabase_realtime add table campaign_checkpoints;
