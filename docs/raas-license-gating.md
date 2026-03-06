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

```
Client ──X-RaaS-License-Key──> Middleware ──> raas-service.ts
                                          ├─ parseLicenseKey()
                                          ├─ verifyHmac()
                                          ├─ checkExpiration()
                                          ├─ checkNonce() (Redis)
                                          └─ checkRevocation() (Redis)
```

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

### Required Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RAAS_LICENSE_SECRET` | YES (prod) | 32+ char secret for HMAC |
| `UPSTASH_REDIS_REST_URL` | YES (prod) | Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | YES (prod) | Redis token |

### Development Mode
```bash
RAAS_BYPASS_DEV=true  # Skip validation
```

### Production Mode
```bash
RAAS_LICENSE_SECRET=your-32-char-secret
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### Generate Secure Secret
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## Admin Guide

### Generate License Key

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

### Revoke Key
```typescript
import { redis } from '@/lib/redis';
await redis.set(`raas:revoked:${key}`, '1', { ex: 31536000 });
```

### Monitor
```bash
redis-cli KEYS "raas:revoked:*"
redis-cli KEYS "raas:nonce:*"
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
- Nonce stored in Redis with TTL (default 1 hour)
- Redis auto-cleans expired nonces

### Secret Storage
**DO:** Environment variables, secret managers, rotate periodically
**DON'T:** Git, frontend code, plain text logs

---

## References

### Files
- `src/lib/raas-service.ts` - Core validation
- `src/lib/raas-key-generator.ts` - Key generation
- `src/lib/raas-gate.ts` - Middleware
- `src/proxy.ts` - API middleware

### Docs
- **Plan:** `plans/260306-0901-raas-license-gate/plan.md`
- **Research:** `plans/reports/research-260306-0859-raas-license-gating.md`

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

### Validation Checklist
- [ ] `RAAS_LICENSE_SECRET` set
- [ ] Redis connection working
- [ ] Key format matches
- [ ] HMAC valid
- [ ] Timestamp not expired
- [ ] Nonce not reused
- [ ] Key not revoked

*Last updated: 2026-03-06 | ROIaaS PHASE 1*
