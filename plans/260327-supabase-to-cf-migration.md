# Migration Plan: Supabase → Cloudflare Only

## Status: PLANNED (chưa thực hiện)
## Priority: P0 — Blocker for production handover

## Context
- Sophia đã có D1 database (sophia-raas-db) + Custom JWT Auth (Web Crypto)
- Login + Affiliate Discovery vẫn dùng Supabase client → BROKEN trên CF Workers
- `NEXT_PUBLIC_SUPABASE_*` vars set as CF secrets → không accessible ở client-side
- Goal: 100% Cloudflare — ZERO Supabase

## Current Supabase Dependencies (files to migrate)

### Auth (Critical - Login broken)
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server Supabase client
- `src/lib/supabase/admin.ts` — Admin Supabase client
- `src/app/[locale]/login/page.tsx` — Magic link login via Supabase OTP
- `src/app/auth/callback/route.ts` — Auth callback handler
- `src/middleware.ts` — Dashboard auth check via Supabase

### Data Queries (Affiliate broken)
- `src/app/api/discovery/top-50/route.ts` — Supabase query for products
- `src/app/api/discovery/search/route.ts` — Product search
- `src/app/api/health/route.ts` — Supabase health check
- `src/components/discovery/filter-panel.tsx` — Client-side queries

### Already on D1 (no migration needed)
- RaaS missions, API keys, billing — use D1 via `getD1Client()`
- JWT auth utilities — `src/lib/auth/jwt-*.ts`
- Usage metering — D1 tables

## Migration Phases

### Phase 1: Auth → D1 + Magic Link via Resend (3h)
1. Create D1 `users` table (email, password_hash, created_at)
2. Create D1 `magic_links` table (token, email, expires_at, used)
3. Replace login page: Supabase OTP → D1 + Resend email
4. Replace middleware auth: Supabase session → JWT token from cookie
5. Remove `src/lib/supabase/client.ts` and `server.ts`

### Phase 2: Discovery Data → D1 (2h)
1. Migrate `products` table to D1
2. Seed demo products data
3. Replace Supabase queries in discovery API routes
4. Replace filter-panel client queries

### Phase 3: Cleanup (1h)
1. Remove `@supabase/ssr`, `@supabase/supabase-js` from package.json
2. Remove Supabase env vars from CF Workers
3. Remove `connect-src 'https://*.supabase.co'` from CSP
4. Remove supabase/ directory

## Estimated effort: 6h total
## Blocked by: Resend email service setup (for magic links)
