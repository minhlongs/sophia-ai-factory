# Phase 1: Infrastructure Setup

**Goal**: Production-ready database and hosting environment.

## 1. Database Schema Extensions
We need to store user integrations securely.

**Task**: Create `supabase/migrations/003_user_integrations.sql`
```sql
-- Store user-specific API keys for networks
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('clickbank', 'shareasale', 'amazon')),

  -- Encrypted credentials (handled by app or pgcrypto if enabled)
  -- For MVP, we'll store as text but RLS is CRITICAL
  credentials JSONB NOT NULL,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own keys
CREATE POLICY "Users can manage own integrations"
  ON user_integrations
  USING (auth.uid() = user_id);
```

## 2. Supabase Setup
- [ ] Create Project `sophia-prod`
- [ ] Enable Auth (Email/Password)
- [ ] Run Migrations 001, 002, 003

## 3. Vercel Deployment
- [ ] Import project from Git
- [ ] Add Environment Variables (see plan.md)
- [ ] Deploy initial build

## 4. Verification
- [ ] Check DB connection
- [ ] Check migrations applied
- [ ] Check site loads
