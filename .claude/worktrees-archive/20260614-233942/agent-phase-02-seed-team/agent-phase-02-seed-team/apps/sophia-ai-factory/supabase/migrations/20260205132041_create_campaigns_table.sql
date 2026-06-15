-- Create campaign_status enum
create type campaign_status as enum (
  'draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'
);

-- Create campaigns table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title text not null,
  topic text,
  audience text,

  -- State & Progress
  status campaign_status default 'draft'::campaign_status,
  progress integer default 0, -- 0 to 100
  error_message text,

  -- Assets (JSONB for flexibility)
  script_content jsonb, -- { "scenes": [...] }
  video_url text,
  thumbnail_url text,

  -- Meta
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for dashboard queries
create index idx_campaigns_user on campaigns(user_id);

-- Enable RLS
alter table campaigns enable row level security;

-- Policies
create policy "Users can view their own campaigns"
  on campaigns for select
  using (auth.uid() = user_id);

create policy "Users can create their own campaigns"
  on campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
  on campaigns for update
  using (auth.uid() = user_id);

-- Add trigger for updated_at
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on campaigns
  for each row execute procedure moddatetime (updated_at);

-- Add to realtime publication
alter publication supabase_realtime add table campaigns;
