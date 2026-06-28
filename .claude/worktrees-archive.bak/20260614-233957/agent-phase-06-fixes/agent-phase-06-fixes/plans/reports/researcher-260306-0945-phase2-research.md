# ROIaaS PHASE 2 - License Management UI Research

## Exec Summary

**Study Date:** 2026-03-06
**Focus:** Research patterns for Supabase schema, admin auth, RBAC, audit logging, UI components

---

## 1. Supabase Schema Patterns

### Existing Tables (from `lib/supabase/types.ts`)

```typescript
// Campaign: 15,780|UserProfiles: 15,625|AffiliateProducts: 12,450|CampaigmTemplates: 8,230|PaymentEvents: 5,120
{
  campaigns: Row/Insert/Update structures
  user_profiles: subscription_tier (free/pro/enterprise/basic/premium)
  payment_events: Polar webhook payloads
  affiliate_products: Product data from networks
}
```

### Proposed RaaS Tables (from `plan.md`)

```sql
-- raas_licenses (Redis-based, plan: migrate to PG)
CREATE TABLE raas_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,      -- SHA256 hash (not plain text)
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'premium', 'enterprise', 'master')),
  expires_at BIGINT,
  nonce TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at BIGINT,
  created_by UUID REFERENCES auth.users(id),
  created_at BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- raas_audit_logs
CREATE TABLE raas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'VALIDATE', 'REVOKE', 'VIEW')),
  license_id UUID REFERENCES raas_licenses(id),
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at BIGINT NOT NULL
);
```

### Key Patterns Verified

1. **ID Field:** `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
2. **Timestamps:** `BIGINT` (Unix seconds) for performance
3. **JSONB:** For flexible metadata
4. **Enum Check:** `CHECK (tier IN (...))` pattern

---

## 2. Admin Authentication Patterns

### Existing Patterns (`lib/supabase/admin.ts`)

```typescript
// Admin client with SERVICE_ROLE_KEY
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
```

### Access Control Flow

```
Request → /api/admin/*
  ↓
Basic Auth: ADMIN_USER/ADMIN_PASS headers (lib/supabase/server.ts)
  ↓
Supabase Auth: getUser() → user_metadata.tier
  ↓
Tier Gate: verifyTierAccess(tier, "enable_admin_dashboard")
  ↓
Admin Client: createAdminClient() → bypass RLS for analytics
```

### Code Example (`app/actions/admin.ts`)

```typescript
async function getAdminStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rawTier = user.user_metadata?.tier;
  const userTier: Tier = (rawTier && ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"].includes(rawTier))
    ? (rawTier as Tier) : "BASIC";

  verifyTierAccess(userTier, "enable_admin_dashboard"); // Throws if denied

  const adminSupabase = createAdminClient(); // Bypass RLS
  // ... fetch stats
}
```

### Appendix: Implemented Endpoints

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/admin/invite` | POST | Basic | ✅ Done |
| `/api/admin/licenses` | GET | Basic | ✅ Done |
| `/api/admin/licenses/create` | POST | Basic | ✅ Done |
| `/api/admin/licenses/[id]` | GET | Basic | ✅ Done |
| `/api/admin/licenses/[id]/revoke` | POST | Basic | ✅ Done |
| `/api/admin/licenses/audit` | GET | Basic | ✅ Done |

---

## 3. Role-Based Access Control (RBAC) Patterns

### Tier Hierarchy

```typescript
// src/types/index.ts
export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER";

const tierOrder: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];
// Basic < Premium < Enterprise < Master (highest)
```

### Tier Gate Implementation (`lib/tier-gate.ts`)

```typescript
export function verifyTierAccess(userTier: Tier, feature: FeatureFlag): void {
  const result = checkTierAccess(userTier, feature);
  if (!result.hasAccess) {
    throw new AuthorizationError(result.reason, result.requiredTier);
  }
}

// Usage:
verifyTierAccess(user.tier, "enable_admin_dashboard");
```

### RLS Patterns (Not Yet Applied to RaaS)

```sql
-- Example pattern (from existing tables)
CREATE POLICY "Users can see own profile"
ON user_profiles FOR SELECT USING (auth.uid() = user_id);

-- For raas_licenses (admin-only):
CREATE POLICY "Admins can manage licenses"
ON raas_licenses FOR ALL
USING (auth.role() = 'service_role'); -- Only admin bypass
```

---

## 4. Audit Logging Best Practices

### Current Implementation (Redis-based)

```typescript
// src/app/api/admin/licenses/create/route.ts
await redis.lpush('raas:audit:creation', JSON.stringify({
  action: 'CREATE',
  nonce,
  tier,
  timestamp,
  createdAt: now,
  createdBy: 'admin',
}));

await redis.ltrim('raas:audit:creation', 0, 999); // Keep last 1000
```

### Audit Log Structure (Applied)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `action` | ENUM | 'CREATE', 'REVOKE', 'VALIDATE' | Operation type |
| `nonce` | TEXT | 'a1b2c3d4...' | License ID reference |
| `tier` | TEXT | 'premium' | License tier |
| `timestamp` | BIGINT | 1735689600 | Unix seconds |
| `createdBy` | TEXT | 'admin' | Admin user reference |
| `ip_address` | TEXT | '203.110...' | Geo-location |
| `user_agent` | TEXT | 'Mozilla/5.0...' | Device detect |

### Schema Design Recommendation

```sql
-- raas_audit_logs (Supabase migration target)
CREATE TABLE raas_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  license_id UUID,
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for common queries
CREATE INDEX idx_raas_audit_action ON raas_audit_logs(action);
CREATE INDEX idx_raas_audit_license ON raas_audit_logs(license_id);
CREATE INDEX idx_raas_audit_user ON raas_audit_logs(user_id);
CREATE INDEX idx_raas_audit_timestamp ON raas_audit_logs(created_at DESC);
```

---

## 5. UI Component Patterns

### Already Implemented Components

| Component | File | Features |
|-----------|------|----------|
| `LicenseGenerator` | `src/components/admin/licenses/license-generator.tsx` | Tier select, date picker, JSON metadata, copy-to-clipboard, warning "show once" |
| `LicenseList` | `src/components/admin/licenses/license-list.tsx` | Search, filter by tier/status, pagination, revoke action |
| `AuditLogTable` | `src/components/admin/licenses/audit-log-table.tsx` | Filter by action, export CSV, pagination |

### UI Component Architecture

```typescript
// Pattern: shadcn/ui + Neon theme
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';

// Tier badges with CSS variables
const TIER_COLORS = {
  basic: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  premium: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  enterprise: 'bg-gradient-to-r from-[var(--neon-cyan)]/10 to-[var(--neon-purple)]/10 text-white',
};

// Usage
<Badge className={TIER_COLORS[license.tier]} variant="outline">
  {license.tier}
</Badge>
```

### Admin Sidebar (`src/app/components/admin/admin-sidebar.tsx`)

```typescript
const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Licenses", href: "/admin/licenses", icon: Key },  // ✅ Existing
  { name: "Feature Flags", href: "/admin/features", icon: Flag },
  { name: "Affiliates", href: "/admin/affiliates", icon: ExternalLink },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];
```

---

## 6. Supabase RLS Policies Template

```sql
-- Enable RLS
ALTER TABLE raas_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE raas_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access (bypass via service_role)
CREATE POLICY "Admins can read licenses"
ON raas_licenses FOR SELECT
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can insert licenses"
ON raas_licenses FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can update licenses"
ON raas_licenses FOR UPDATE
USING (auth.role() = 'service_role');

-- Audit logs: write-only for service_role (immutable from client)
CREATE POLICY "Service can insert audit logs"
ON raas_audit_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- No select/update/delete from clients (write-only append)
CREATE POLICY "Service can read audit logs"
ON raas_audit_logs FOR SELECT
USING (auth.role() = 'service_role');
```

---

## 7. API Route Pattern

### Standard Structure

```typescript
// src/app/api/admin/licenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  // Auth check via Basic Auth in headers
  const auth = request.headers.get('authorization');
  if (!isAdminAuthorized(auth)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query params for filtering
  const searchParams = request.nextUrl.searchParams;
  const tier = searchParams.get('tier');
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Data fetch
  const data = await redis.keys('raas:license:*');

  // Pagination
  const total = data.length;
  const paginated = data.slice((page - 1) * 20, page * 20);

  return NextResponse.json({ licenses: paginated, total });
}

export async function POST(request: Request) {
  // Admin auth check
  if (!isAdminAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // ... validation and business logic

  return NextResponse.json({ success: true, data }, { status: 201 });
}
```

---

## 8. Key Findings

### ✅ Already Implemented

1. **Admin Dashboard Route:** `/admin/licenses` exists in `[locale]/(admin)/admin/licenses/page.tsx`
2. **API Endpoints:** 5 endpoints fully implemented via Redis
3. **UI Components:** LicenseGenerator, LicenseList, AuditLogTable complete
4. **Admin Sidebar:** License link configured

### ⚠️ Gaps (Migration Required)

| Gap | Current |_target | Impact |
|-----|---------|---------|--------|
| Persistence | Redis (in-memory) | Supabase PG | Data loss on restart |
| Audit Trail | Redis lists | Supabase table | No history beyond 1000 |
| Cross-Server Sync | Local Redis only | DB replication | Multi-instance issues |

### 🔧 Migration Strategy

```bash
# Phase 1: Database schema
npx supabase migration new create_raas_tables

# Phase 2: Data migration script
# Read from Redis → Write to PG → Verify → Flip traffic

# Phase 3: Update API routes
# Replace redis.* calls with supabase.from('raas_licenses').insert()

# Phase 4: Cleanup
# Remove Redis keys, add migration version tracking
```

---

## 9. Unresolved Questions

1. **Key Rotation:** Should support multiple active secrets for key rotation?
2. **Export Format:** CSV only, or also JSON/Excel?
3. **Notifications:** Email alerts for license expiration/revocation?
4. **Multi-tenancy:** One supabase project per customer, or shared with RLS?
5. **Audit Retention:** 90 days auto-archive, or indefinite storage?
6. **Customer Mapping:** Add `customer_email` to track key ownership?
7. **IP allowlists:** Restrict admin access to specific IPs?
8. **MFA requirement:** Should admin actions require TOTP confirmation?

---

## Appendix: File Manifest

### Existing Implementation Files

```
src/
├── components/admin/
│   ├── admin-sidebar.tsx
│   └── licenses/
│       ├── license-generator.tsx
│       ├── license-list.tsx
│       └── audit-log-table.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts (createClient with cookies)
│   │   ├── client.ts (getSupabaseClient)
│   │   └── admin.ts (createAdminClient)
│   ├── auth.ts (getCurrentUser, hasMinimumTier)
│   ├── tier-gate.ts (verifyTierAccess, withTierGate)
│   └── raas-*.ts (key-generator, service, gate)
├── app/
│   ├── [locale]/
│   │   └── (admin)/admin/licenses/page.tsx (UI)
│   ├── admin/
│   │   └── licenses/
│   │       ├── route.ts (GET list)
│   │       ├── create/route.ts (POST create)
│   │       ├── [id]/route.ts (GET detail, POST revoke)
│   │       └── audit/route.ts (GET logs)
│   ├── actions/admin.ts (getAdminStats server action)
```

### Reference Documents

- Plan: `plans/260306-0925-raas-license-management-ui/plan.md`
- RaaS Docs: `docs/raas-license-gating.md`
- Types: `src/types/index.ts`, `src/lib/supabase/types.ts`

---

**Report Generated:** 2026-03-06
**Researcher:** researcher-aa0b43aeb6cbb9b55
**Status:** Complete - Ready for Phase 2 Implementation
