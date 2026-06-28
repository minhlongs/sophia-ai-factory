# License Management System Research Report

**Date:** 2026-03-06
**Analyst:** researcher
**Work Context:** /User/macbookprom1/mekong-cli/apps/sophia-ai-factory

---

## 1. License Database Schema

### Tables

#### `raas_licenses` - License Key Metadata (NOT full key storage)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `key_hash` | TEXT | SHA256 hash of full license key (for lookup) |
| `tier` | TEXT | tier: basic | premium | enterprise | master |
| `expires_at` | BIGINT | Unix timestamp (seconds) - 0 = perpetual |
| `nonce` | TEXT | Random nonce from key (32 chars), UNIQUE |
| `is_revoked` | BOOLEAN | Revocation flag (default: false) |
| `revoked_at` | BIGINT | Unix timestamp of revocation |
| `revoked_by` | UUID | User who revoked (fk to auth.users) |
| `created_by` | UUID | Admin who created (fk to auth.users) |
| `created_at` | BIGINT | Unix timestamp (seconds) |
| `metadata` | JSONB | Additional metadata (default: '{}') |
| `updated_at` | BIGINT | Last update timestamp |

#### `raas_audit_logs` - Audit Trail

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `action` | TEXT | CREATE | VALIDATE | REVOKE | UPDATE |
| `license_id` | UUID | FK to raas_licenses |
| `license_nonce` | TEXT | Denormalized for faster queries |
| `user_id` | UUID | FK to auth.users |
| `ip_address` | TEXT | Client IP |
| `user_agent` | TEXT | Client user agent |
| `details` | JSONB | Action-specific details |
| `created_at` | BIGINT | Unix timestamp (seconds) |

### Indexes (for performance)

- `idx_raas_licenses_key_hash` - License lookups by hash
- `idx_raas_licenses_nonce` - License lookups by nonce
- `idx_raas_licenses_tier` - Filter by tier
- `idx_raas_licenses_is_revoked` - Active/revoked status
- `idx_raas_audit_logs_license` - Audit by license
- `idx_raas_audit_logs_created_at` - Chronological logs

### RLS Policies

- **Admins**: Full CRUD access via `raw_user_meta_data->>'role' = 'admin'`
- **Users**: SELECT their own audit logs only

---

## 2. API Endpoints for License CRUD

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/licenses` | List licenses with pagination/search/filter | Admin Basic Auth |
| POST | `/api/admin/licenses/create` | Create new license key | Admin Basic Auth |
| GET | `/api/admin/licenses/[id]` | Get license by nonce | Admin Basic Auth |
| POST | `/api/admin/licenses/[id]/revoke` | Revoke license | Admin Basic Auth |
| POST | `/api/admin/licenses/[id]/reactivate` | Reactivate revoked license | Admin Basic Auth |
| POST | `/api/admin/licenses/[id]/regenerate` | Regenerate license with new key | Admin Basic Auth |
| GET | `/api/admin/licenses/audit` | Get audit logs with filters | Admin Basic Auth |

### Query Parameters (GET /api/admin/licenses)
- `tier` - Filter by tier (BASIC, PREMIUM, ENTERPRISE, MASTER)
- `search` - Search by nonce suffix
- `status` - Filter by status (active, revoked, expired)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

### Request Schema (POST /api/admin/licenses/create)
```typescript
{
  tier: string,              // Required: BASIC | PREMIUM | ENTERPRISE | MASTER
  expiresAt?: number,        // Optional: Unix timestamp (default: 1 year)
  metadata?: object,         // Optional: Custom metadata
  customerEmail?: string     // Optional: Customer email
}
```

### Response Schema
```typescript
{
  key: string,              // Full license key (shown ONCE)
  license: {
    id: string,             // nonce
    tier: string,
    createdAt: number,
    expiresAt: number,
    isRevoked: boolean
  },
  warning: string           // "⚠️ IMPORTANT: Copy this key now..."
}
```

---

## 3. RAAS_LICENSE_KEY System Implementation

### Key Format
```
raas_{tier}_{timestamp}_{nonce}_{hmac}
```
- **tier**: basic | premium | enterprise | master
- **timestamp**: Unix timestamp (seconds) - expiration time
- **nonce**: crypto.randomBytes(16).toString('hex') - 32 hex chars
- **hmac**: HMAC-SHA256(tier:timestamp:nonce, SECRET) - 64 hex chars

**Example:**
```
raas_premium_1735689600_a1b2c3d4e5f6e5f6e5f6e5f6e5f6e5f6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### Components

#### `raas-key-generator.ts`
- `generateLicenseKey(tier, expiresAt, secret)` - Generate license with expiration
- `generateMasterKey(tier, secret)` - Generate perpetual license (timestamp=0)
- `parseKey(key)` - Debug utility to parse key components

#### `raas-service.ts`
- `parseLicenseKey(key)` - Parse key into components
- `verifyHmac(key, secret)` - Verify HMAC signature using timing-safe comparison
- `checkExpiration(timestamp, tier)` - Check if expired (master = perpetual)
- `checkNonce(nonce, redis)` - Replay attack prevention (Redis)
- `checkRevocation(key, redis)` - Check if revoked (Redis)
- `validateLicenseKey(key, options)` - Full validation pipeline
- `revokeLicenseKey(key, redis)` - Add to revocation set
- `generateNonce()` - Generate random nonce

#### `raas-gate.ts` - Middleware
- Extract license key from:
  1. `X-RaaS-License-Key` header (primary)
  2. `Authorization: Bearer` header
  3. Query param `license_key` (insecure, for testing)
- Validate via `raas-service.validateLicenseKey()`
- Return 403 with standardized error response if invalid
- Development bypass: `RAAS_BYPASS_DEV=true`
- V1 format fallback via `RAAS_V1_FORMAT=true`

### Environment Variables
- `RAAS_LICENSE_SECRET` - HMAC signing secret (min 16 chars)
- `RAAS_BYPASS_DEV` - Skip validation in development
- `RAAS_V1_FORMAT` - Enable legacy V1 key format support
- `RAAS_LICENSE_KEY` - Legacy single license key

### License Tiers
| Tier | Expiration | Features |
|------|------------|----------|
| BASIC | Configurable | 1 channel, 5 templates, Basic support |
| PREMIUM | Configurable | 3 channels, Unlimited templates, Priority support |
| ENTERPRISE | Configurable | Unlimited channels, White-label, Dedicated support |
| MASTER | Perpetual (0) | Lifetime access, VIP support, All features |

---

## 4. Admin Authentication/RBAC Patterns

### Basic Auth Middleware (`middleware.ts`)

```typescript
isAdminAuthorized(request): boolean
checkAdminAuth(request): NextResponse | null
```

**Auth Logic:**
```typescript
// Extract Basic Auth credentials
authorization: "Basic base64(user:pass)"

// Validate against env vars
ADMIN_USER = process.env.ADMIN_USER
ADMIN_PASS = process.env.ADMIN_PASS

// Return 401 if invalid
```

### Database-Level RBAC (RLS)

```sql
-- Admin check via user metadata
auth.users.raw_user_meta_data->>'role' = 'admin'
```

### Admin Page Protection

Admin routes under `/admin/*` use middleware:
```typescript
export const config = {
  matcher: ['/admin/:path*'],
};
```

### Supabase Clients

| Client | File | Role |
|--------|------|------|
| `server.ts` | `@supabase/ssr` | Server-side (cookies-based) |
| `client.ts` | Supabase client | Browser-side (user session) |
| `admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Admin operations |

---

## 5. License UI Components

### Page Structure (`/admin/licenses`)

```
admin/licenses/
├── page.tsx                      # Main admin page with tabs
├── license-list.tsx              # License table with CRUD actions
├── license-generator.tsx         # Form to create new licenses
├── audit-log-table.tsx           # Audit log viewer
└── license-regenerate-dialog.tsx # Regenerate confirmation dialog
```

### Component Features

#### License List (`license-list.tsx`)
- **Search**: Filter by nonce suffix
- **Filters**: Tier (all/basic/premium/enterprise/master), Status (active/revoked/expired)
- **Pagination**: 20 items per page
- **Actions**:
  - View Details
  - Regenerate (creates new key, revokes old)
  - Reactivate (un-revoke)
  - Revoke

#### License Generator (`license-generator.tsx`)
- Customer email input (optional)
- Tier selection dropdown with pricing/features
- Expiration date picker (or duration quick-select)
- Custom metadata JSON input
- **One-time display**: Full license key shown ONCE with warning
- Copy to clipboard functionality

#### Audit Log Table (`audit-log-table.tsx`)
- Filter by action (CREATE/REVOKE/VALIDATE/UPDATE)
- Export to CSV functionality
- Pagination: 50 items per page
- **Retention**: 90 days per SOC 2 compliance
- Shows: Timestamp, Action, License ID, Tier, Created By

### Status Colors
| Status | Color |
|--------|-------|
| Active | Green |
| Revoked | Red |
| Expired | Gray |
| Basic | Blue |
| Premium | Purple |
| Enterprise | Yellow |
| Master | Red |

---

## 6. Key Findings

### Strengths
1. **Well-designed architecture**: Layered separation (generator → service → gate)
2. **Security-first**: HMAC-SHA256, timing-safe comparison, nonce replay prevention
3. **Compliance**: Audit logs with 90-day retention, RLS policies
4. **Clean UI**: Tabs, pagination, search, filters, export functionality
5. **Type-safe**: Full TypeScript interfaces matching database schema

### Considerations
1. **Audit logs retention**: Code says 90 days but UI shows "30 days only" - inconsistency
2. **No license deletion**: Only revocation (intentional for audit trail)
3. **Redis deprecated**: Migration complete to Supabase (2026-03-06)
4. **Master tier perpetual**: `expires_at = 0` indicates lifetime access

---

## Unresolved Questions

1. **License validation flow**: How does the frontend actually use `raasGate` - is it in proxy.ts or individual routes?
2. **Tier upgrade/downgrade**: What happens when user upgrades tier - does existing license remain valid?
3. **Multiple licenses per user**: Can one user have multiple licenses? How tracked?
4. **Revocation visibility**: When revoked, is the license immediately invalid or is there cache delay?
5. **Logging integration**: Is `raas-audit.ts` logAuditAction being called from raas-gate.ts validation?

---

*Report generated 2026-03-06 12:16*
