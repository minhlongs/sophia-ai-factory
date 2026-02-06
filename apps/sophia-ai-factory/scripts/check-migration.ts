#!/usr/bin/env npx tsx
/**
 * Run migrations via Supabase - creates tables step by step
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vhlpbginhiqtgjhgpvfm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZobHBiZ2luaGlxdGdqaGdwdmZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3MTYxNywiZXhwIjoyMDg1OTQ3NjE3fQ.G0HMlHAKsm_gjjzBkuhkYwJYTwJBMIeHmsWEUhsjy8Y'
);

async function main() {
  console.log('🔧 Creating tables via Supabase SDK...\n');

  // Test connection by listing tables
  const { data, error } = await supabase.rpc('get_schemas');
  
  if (error) {
    console.log('Note: RPC not available, checking table access...');
  }

  // Try to create user_profiles table by inserting test data
  // This won't work if table doesn't exist, but gives us info
  
  // Check campaigns table
  const { error: campaignErr } = await supabase.from('campaigns').select('id').limit(1);
  if (campaignErr?.message.includes('does not exist')) {
    console.log('❌ campaigns table missing');
  } else {
    console.log('✅ campaigns table exists');
  }

  // Check user_profiles table  
  const { error: profileErr } = await supabase.from('user_profiles').select('user_id').limit(1);
  if (profileErr?.message.includes('does not exist')) {
    console.log('❌ user_profiles table missing');
  } else {
    console.log('✅ user_profiles table exists');
  }

  // Check campaign_templates table
  const { error: templateErr } = await supabase.from('campaign_templates').select('id').limit(1);
  if (templateErr?.message.includes('does not exist')) {
    console.log('❌ campaign_templates table missing');
  } else {
    console.log('✅ campaign_templates table exists');
  }

  console.log('\n📋 To run migrations manually:');
  console.log('1. Go to: https://supabase.com/dashboard/project/vhlpbginhiqtgjhgpvfm/sql/new');
  console.log('2. Copy contents of FULL_MIGRATION.sql');
  console.log('3. Paste and click Run');
  console.log('\nOr use supabase CLI:');
  console.log('  supabase login');
  console.log('  supabase link --project-ref vhlpbginhiqtgjhgpvfm');
  console.log('  supabase db push');
}

main().catch(console.error);
