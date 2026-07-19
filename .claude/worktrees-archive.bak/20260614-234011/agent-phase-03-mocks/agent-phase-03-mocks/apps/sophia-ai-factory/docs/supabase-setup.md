# Supabase Setup for Sophia Index

## 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Copy Project URL and anon key

## 2. Run Migration
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/migrations/001_create_sophia_index.sql`
3. Execute

## 3. Configure Environment
Add to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 4. Generate Types
```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
```

## 5. Verify Connection
```bash
npm run dev
# Check http://localhost:3000/api/sophia-index/health (create test endpoint)
```
