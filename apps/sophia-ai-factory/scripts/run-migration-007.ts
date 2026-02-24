#!/usr/bin/env npx tsx
/**
 * Run migration 007 - Add subscription expiration columns
 * Uses Supabase Edge Function to execute SQL
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars before running');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔧 Checking subscription columns...\n');

  // Check if columns exist by trying to select them
  const { error } = await supabase
    .from('user_profiles')
    .select('subscription_expires_at, polar_customer_id')
    .limit(1);

  if (error) {
    if (error.message.includes('subscription_expires_at') || error.message.includes('polar_customer_id')) {
      console.log('❌ Columns missing. Run this SQL in Supabase Dashboard:\n');
      console.log(`
-- Migration 007: Add subscription expiration tracking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Update tier constraint
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium', 'enterprise'));

-- Index for expired subscriptions
CREATE INDEX IF NOT EXISTS idx_user_profiles_expires 
ON user_profiles(subscription_expires_at) 
WHERE subscription_expires_at IS NOT NULL;
      `);
      console.log('\n📋 Go to: https://supabase.com/dashboard/project/vhlpbginhiqtgjhgpvfm/sql/new');
    } else {
      console.log('Error:', error.message);
    }
  } else {
    console.log('✅ subscription_expires_at column exists');
    console.log('✅ polar_customer_id column exists');
    console.log('\n🎉 Migration 007 already applied!');
    
    // Show current data
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, subscription_tier, subscription_expires_at')
      .limit(5);
    
    if (profiles && profiles.length > 0) {
      console.log('\n📊 Current profiles:');
      profiles.forEach(p => {
        console.log(`  - ${p.user_id}: tier=${p.subscription_tier}, expires=${p.subscription_expires_at || 'never'}`);
      });
    } else {
      console.log('\n📊 No user profiles yet (empty table)');
    }
  }
}

main().catch(console.error);
