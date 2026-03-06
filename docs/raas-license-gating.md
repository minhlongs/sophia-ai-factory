# ROIaaS License Key Gating / Guardian Khóa License ROIaaS

## Overview / Tổng quan

### What is RaaS Licensing?

RaaS (ROI-as-a-Service) License Key Gating protects API routes by validating encrypted license keys. Each key contains:

- **Tier** - Subscription level (basic, premium, enterprise, master)
- **Timestamp** - Expiration date
- **Nonce** - Unique random value to prevent replay attacks
- **HMAC** - Cryptographic signature for authenticity

### Why HMAC-SHA256?

1. **Tamper-proof** - Cannot modify key without detection
2. **Timing-safe** - Protects against timing attacks
3. **Cryptographic** - Industry-standard algorithm

---

## Architecture

### Phase 1: Redis-Based (Legacy)
```
Client ──X-RaaS-License-Key──> Middleware ──> raas-service.ts
                                          ├─ parseLicenseKey()
                                          ├─ verifyHmac()
                                          ├─ checkExpiration()
                                          ├─ checkNonce() (Redis)
                                          └─ checkRevocation() (Redis)
```

### Phase 2: Supabase-Based (Current - Since 2026-03-06)
```
Client ──X-RaaS-License-Key──> Middleware ──> raas-gate.ts
                                          └─ raas-service.ts
                                                ├─ parseLicenseKey()
                                                ├─ verifyHmac()
                                                ├─ checkExpiration()
                                                └─ checkRevocation() (Supabase)

Admin UI ──> API Routes ──> raas-audit.ts ──> Supabase
                                        ├─ raas_licenses table
                                        └─ raas_audit_logs table
```

**Storage Migration Summary:**
| Component | Phase 1 (Redis) | Phase 2 (Supabase) |
|-----------|-----------------|-------------------|
| License data | `raas:license:{nonce}` | `raas_licenses` table |
| Revocation | `raas:revoked:{key}` | `raas_licenses.is_revoked` |
| Nonces | `raas:nonce:{nonce}` | In-memory (TTL) + DB |
| Audit logs | `raas:audit:*` | `raas_audit_logs` table |

**Migration Details:**
- **Database:** Supabase with `raas_licenses` and `raas_audit_logs` tables
- **Schema:** See `docs/migrations/raas-licenses-schema.sql`
- **Service Layer:** `src/lib/raas-audit.ts` replaces direct Redis calls
- **API Changes:** All admin routes require Basic Auth

---

## License Key Format

```
Format: raas_{tier}_{timestamp}_{nonce}_{hmac}
Example:  raas_premium_1735689600_a1b2c3d4e5f6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2
```

| Part | Length | Description |
|------|--------|-------------|
| `raas_` | 5 | Fixed prefix |
| `{tier}` | 5-8 | basic | premium | enterprise | master |
| `{timestamp}` | 10 | Unix seconds (expiration) |
| `{nonce}` | 32 | 16-byte hex (replay prevention) |
| `{hmac}` | 64 | SHA256 signature |

### Example Keys

```
Basic:    raas_basic_1798761600_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
Premium:  raas_premium_1814275200_abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345
Enterprise: raas_enterprise_1830518400_fedcba9876543210fedcba9876543210fedcba9876543210fedcba987654
Master:   raas_master_0_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  # perpetual
```

---

## Environment Setup

### Required Variables (Phase 2)

| Variable | Required | Description |
|----------|----------|-------------|
| `RAAS_LICENSE_SECRET` | YES (prod) | 32+ char secret for HMAC |
| `SUPABASE_SERVICE_ROLE_KEY` | YES (prod) | Supabase service role for admin operations |

**Redis (Optional - Phase 1 backward compatibility)**
| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | NO | Redis URL (legacy) |
| `UPSTASH_REDIS_REST_TOKEN` | NO | Redis token (legacy) |

### Development Mode
```bash
RAAS_BYPASS_DEV=true  # Skip validation
```

### Production Mode
```bash
RAAS_LICENSE_SECRET=your-32-char-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Generate Secure Secret
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## Admin Guide

### Generate License Key (CLI)
```bash
cd apps/sophia-ai-factory && node
> import { createHmac, randomBytes } from 'crypto';
> const tier = 'premium';
> const expiresAt = Math.floor((Date.now() + 365*24*60*60) / 1000);
> const nonce = randomBytes(16).toString('hex');
> const secret = process.env.RAAS_LICENSE_SECRET;
> const hmac = createHmac('sha256', secret).update(`${tier}:${expiresAt}:${nonce}`).digest('hex');
> console.log(`raas_${tier}_${expiresAt}_${nonce}_${hmac}`);
```

### Generate License via API (Phase 2)
```bash
curl -X POST https://sophia-ai-factory.vercel.app/api/admin/licenses/create \
  -H "Authorization: Basic $ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium", "expiresAt": 1893456000, "metadata": {"notes": "Custom license"}}'
```

**Note:** Response includes full license key - copy immediately, it won't be shown again.

### Revoke Key
```typescript
// Phase 1 (Legacy - via Redis)
import { redis } from '@/lib/redis';
await redis.set(`raas:revoked:${key}`, '1', { ex: 31536000 });

// Phase 2 (Current - via API)
curl -X POST https://sophia-ai-factory.vercel.app/api/admin/licenses/[nonce]/revoke \
  -H "Authorization: Basic $ADMIN_AUTH"
```

### Monitor
```bash
# Phase 1: Redis monitoring
redis-cli KEYS "raas:revoked:*"
redis-cli KEYS "raas:nonce:*"

# Phase 2: Supabase monitoring
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_licenses WHERE is_revoked = true"
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_audit_logs WHERE created_at > extract(epoch from now())::bigint - 86400"
```

---

## Developer Guide

### Middleware (Auto for /api/*)
```typescript
// src/proxy.ts - already integrated
export async function middleware(request: NextRequest) {
  if (!shouldApplyRaasGate(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const result = await raasGate(request);
  if (!result.valid) return result.response!;
  return NextResponse.next();
}
```

### Direct Protection
```typescript
import { raasGate } from '@/lib/raas-gate';

export async function POST(request: NextRequest) {
  const result = await raasGate(request);
  if (!result.valid) return result.response!;
  // Use result.tier
  return NextResponse.json({ success: true });
}
```

### Test with curl
```bash
curl -X POST http://localhost:3000/api/test \
  -H "X-RaaS-License-Key: raas_premium_1735689600_abc123_..."
```

### API Routes (Phase 2)

| Endpoint | Method | Description | Storage |
|----------|--------|-------------|---------|
| `/api/admin/licenses` | GET | List all licenses | `raas_licenses` |
| `/api/admin/licenses/create` | POST | Create new license | `raas_licenses` + `raas_audit_logs` |
| `/api/admin/licenses/[nonce]` | GET | Get license details | `raas_licenses` |
| `/api/admin/licenses/[nonce]/revoke` | POST | Revoke license | `raas_licenses` + `raas_audit_logs` |
| `/api/admin/licenses/audit` | GET | Query audit logs | `raas_audit_logs` |

**Authentication:** All admin routes require Basic Auth with admin role.

---

## Troubleshooting

| Error | Status | Cause | Fix |
|-------|--------|-------|-----|
| `missing-key` | 403 | No license key | Add `X-RaaS-License-Key` header |
| `invalid-format` | 403 | Wrong format | Use `raas_{tier}_{ts}_{nonce}_{hmac}` |
| `expired` | 403 | Key expired | Generate new key |
| `invalid-signature` | 403 | Wrong secret | Use correct `RAAS_LICENSE_SECRET` |
| `replay-attack` | 403 | Nonce reused | Use new nonce |
| `revoked` | 403 | Key revoked | Contact admin |
| `missing-secret` | 500 | Config missing | Set `RAAS_LICENSE_SECRET` |
| `config-error` | 500 | Supabase not configured | Set `SUPABASE_SERVICE_ROLE_KEY` |

### Debug
```bash
RAAS_BYPASS_DEV=true
node -e "const {getRaaSConfig}=require('./src/lib/raas-gate'); console.log(getRaaSConfig())"
```

---

## Security Best Practices

### Key Rotation
1. Generate new secret
2. Keep old in `RAAS_LICENSE_SECRET_OLD`
3. Generate new keys with new secret
4. Remove old after transition

### Timing Attack Prevention
Uses `crypto.timingSafeEqual()` for constant-time comparison.

### Replay Prevention
- Phase 1: Nonce stored in Redis with TTL (default 1 hour)
- Phase 2: License metadata tracks validateCount

### Secret Storage
**DO:** Environment variables, secret managers, rotate periodically
**DON'T:** Git, frontend code, plain text logs

---

## Migration Phase 2 (2026-03-06)

### What Changed

1. **Storage Layer:** Redis → Supabase Database
2. **Service Layer:** Direct Redis calls → `raas-audit.ts` service
3. **Admin UI:** New API routes with authentication

### Breaking Changes

| Change | Impact |
|--------|--------|
| Full license keys not stored | Cannot recover original keys from DB |
| `raas_service.ts` Redis dependencies removed | API routes no longer use Redis |
| All admin routes require auth | Anonymous access blocked |
| `key_hash` instead of `key` | Lookup uses SHA256 hash |

### Data Migration Checklist

- [ ] SQL migration executed: `docs/migrations/raas-licenses-schema.sql`
- [ ] Supabase tables created: `raas_licenses`, `raas_audit_logs`
- [ ] RLS policies configured (admin-only access)
- [ ] Data migrated from Redis (if applicable)
- [ ] Indexes created for performance
- [ ] Admin API routes tested

### Migration Resources

- **SQL Schema:** `docs/migrations/raas-licenses-schema.sql`
- **Migration Script:** `scripts/migrate-redis-to-supabase.ts`
- **TypeScript Types:** `src/lib/raas-schema.ts`
- **Audit Service:** `src/lib/raas-audit.ts`
- **Plan:** `plans/260306-0952-raas-redis-supabase-migration/plan.md`

---

## References

### Files
- `src/lib/raas-service.ts` - Core validation
- `src/lib/raas-key-generator.ts` - Key generation
- `src/lib/raas-gate.ts` - Middleware
- `src/lib/raas-audit.ts` - Audit service layer (Phase 2)
- `src/lib/raas-schema.ts` - TypeScript interfaces (Phase 2)
- `src/proxy.ts` - API middleware

### Documentation
- **Plan:** `plans/260306-0901-raas-license-gate/plan.md`
- **Migration Plan:** `plans/260306-0952-raas-redis-supabase-migration/plan.md`
- **Research:** `plans/reports/research-260306-0859-raas-license-gating.md`
- **SQL Schema:** `docs/migrations/raas-licenses-schema.sql`
- **Migration Guide:** `docs/migrations/REDIS_TO_SUPABASE.md`

### Commands
```bash
npm test -- raas-service.test.ts
npm run build
npx tsc --noEmit
```

---

## Quick Reference

### Key Format
```
raas_{tier}_{timestamp}_{nonce}_{hmac}
  │    │      │          │         └─ 64 hex (HMAC)
  │    │      │          └─ 32 hex (nonce)
  │    │      └─ 10 digits (timestamp)
  │    └─ tier
  └─ prefix
```

### Phase 2 Validation Checklist
- [ ] `RAAS_LICENSE_SECRET` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] Supabase connection working
- [ ] Key format matches
- [ ] HMAC valid
- [ ] Timestamp not expired
- [ ] Nonce not reused
- [ ] Key not revoked

### Phase 2 Tables
- `raas_licenses` - License metadata (key_hash, tier, nonce, expires_at, is_revoked)
- `raas_audit_logs` - Audit trail (action, license_id, user_id, ip_address, details)

*Last updated: 2026-03-06 | ROIaaS PHASE 2 - Supabase Migration*
