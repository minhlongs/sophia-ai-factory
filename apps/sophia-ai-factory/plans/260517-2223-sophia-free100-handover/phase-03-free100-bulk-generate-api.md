# Phase 03 — FREE100-XXXX Bulk-Generate API

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §2.4, §4.3, §9 Q2
- Existing promo: `src/land/promo/` (types, repo, applier, validator)
- Existing admin endpoints: `src/app/api/admin/promo-codes/{create,list,status,[id]/redemptions}/route.ts`
- Migrations: `migrations/0066-promo-codes.sql`, `migrations/0067-seed-promo-codes.sql`
- Auth middleware: `src/lib/better-auth-session.ts` + admin gate
- Layer doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`

## Overview
- **Priority:** P0 (blocker for admin UI in Phase 04)
- **Status:** pending
- **Duration:** ~1 day (D3)
- **Brief:** Build thin `POST /api/admin/promo-codes/bulk-generate` that wraps existing `createPromoCode` from `promo-repo.ts` in a transaction. Generates N unique `FREE100-{8-char base32}` codes. Returns array + CSV.

## Key Insights
- Existing `promo-repo.ts` already has `createPromoCode(input)` — wrap, do NOT duplicate
- `coupon_redemptions` audit table (migration 0025) already enforces audit trail
- Schema field `max_uses_per_user = 1` already supports anti-abuse
- Large campaign = 1000+ codes → need batching to avoid D1 row-write limits per request
- Rate-limit admin to prevent runaway gen (max 5/admin/hour)

## Requirements
**Functional:**
- POST endpoint accepts `{ baseCode: 'FREE100', count: 1..1000, tier: 'master', expiresAt?: epoch_ms, description?: string }`
- Generates `FREE100-{8 char base32}` per code (crypto-random, collision-checked)
- Inserts N rows in `promo_codes` via transaction
- Returns `{ codes: string[], promoCodeIds: string[], csv: string, generatedAt: number }`
- Admin-only via existing admin gate
- Audit log entry per bulk batch (NEW row in `admin_audit_log` or similar)

**Non-functional:**
- Max 1000 codes/request
- Max 5 requests/admin/hour (KV-backed rate limit)
- p95 < 3s for 1000-code generation
- Idempotent retry-safe: same request body within 10s returns same batch (idempotency key from `Idempotency-Key` header)

## Architecture
**Layer:** `land/promo/` (business workflow)

```
POST /api/admin/promo-codes/bulk-generate (route)
  → requireAdmin() [seed/auth]
  → checkRateLimit(adminId) [tree/rate-limit if exists, else inline KV]
  → bulkGeneratePromoCodes(input) [land/promo/bulk-generator.ts NEW]
       ├─ for i in 1..N: code = `FREE100-${randomBase32(8)}`
       ├─ checkCollisions(codes) [D1 SELECT WHERE code IN (...)]
       ├─ batch INSERT in transaction
       └─ writeAuditLog(adminId, batchId, count)
  → return { codes, promoCodeIds, csv, generatedAt }
```

## Related Code Files
**Create:**
- `src/app/api/admin/promo-codes/bulk-generate/route.ts`
- `src/land/promo/bulk-generator.ts`
- `src/land/promo/__tests__/bulk-generator.test.ts`
- `src/app/api/admin/promo-codes/__tests__/bulk-generate.route.test.ts`

**Modify:**
- `src/land/promo/index.ts` (export new `bulkGeneratePromoCodes`)
- `src/land/promo/promo-repo.ts` (add `findCodesIn(codes: string[])` for collision check if missing)

**Delete:** none

## Implementation Steps

### 1. Add base32 random helper (if not exists)
```ts
// src/seed/utils/random-base32.ts
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function randomBase32(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % 32]).join('');
}
```

### 2. Build `bulk-generator.ts`
```ts
// src/land/promo/bulk-generator.ts
import { createServerClient } from '@/lib/db/client';
import { randomBase32 } from '@/seed/utils/random-base32';
import { createPromoCode } from './promo-repo';
import type { PromoCodeInput } from './types';

export interface BulkGenerateInput {
  baseCode: 'FREE100';
  count: number;
  tier: 'master';
  expiresAt?: number;
  description?: string;
  adminId: string;
}

export interface BulkGenerateResult {
  codes: string[];
  promoCodeIds: string[];
  csv: string;
  generatedAt: number;
  batchId: string;
}

export async function bulkGeneratePromoCodes(input: BulkGenerateInput): Promise<BulkGenerateResult> {
  if (input.count < 1 || input.count > 1000) throw new Error('count out of range 1..1000');
  const db = createServerClient();
  const batchId = `bulk-${Date.now()}-${randomBase32(6)}`;
  const codes: string[] = [];
  const promoCodeIds: string[] = [];

  // Generate + collision-check (up to 3 retries per code)
  for (let i = 0; i < input.count; i++) {
    let attempt = 0; let code = '';
    while (attempt < 3) {
      code = `${input.baseCode}-${randomBase32(8)}`;
      const existing = await db.prepare('SELECT id FROM promo_codes WHERE code = ?').bind(code).first();
      if (!existing) break;
      attempt++;
    }
    if (attempt === 3) throw new Error(`collision retry exhausted at i=${i}`);
    const id = await createPromoCode({
      code,
      discountType: 'free_full',
      appliesToTier: input.tier,
      maxUses: 1,
      maxUsesPerUser: 1,
      status: 'active',
      expiresAt: input.expiresAt,
      description: input.description ?? `Bulk ${batchId}`,
      createdBy: input.adminId,
    });
    codes.push(code);
    promoCodeIds.push(id);
  }

  // Audit log
  await db.prepare(
    'INSERT INTO admin_audit_log (admin_id, action, payload, created_at) VALUES (?, ?, ?, ?)'
  ).bind(input.adminId, 'promo_bulk_generate', JSON.stringify({ batchId, count: input.count }), Date.now()).run();

  const csv = ['code,tier,expiresAt,description'].concat(
    codes.map(c => `${c},${input.tier},${input.expiresAt ?? ''},${input.description ?? ''}`)
  ).join('\n');

  return { codes, promoCodeIds, csv, generatedAt: Date.now(), batchId };
}
```

### 3. Build API route
```ts
// src/app/api/admin/promo-codes/bulk-generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/better-auth-session';
import { requireAdmin } from '@/seed/auth/require-admin';
import { bulkGeneratePromoCodes } from '@/land/promo/bulk-generator';
import { checkAdminRateLimit } from '@/tree/rate-limit/admin-rate-limit';

const Schema = z.object({
  baseCode: z.literal('FREE100'),
  count: z.number().int().min(1).max(1000),
  tier: z.literal('master'),
  expiresAt: z.number().int().positive().optional(),
  description: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  await requireAdmin(user);
  await checkAdminRateLimit(user.id, 'promo_bulk_generate', { max: 5, windowMs: 3600_000 });
  const body = await req.json();
  const parsed = Schema.parse(body);
  const result = await bulkGeneratePromoCodes({ ...parsed, adminId: user.id });
  return NextResponse.json(result, { status: 200 });
}
```

### 4. Write unit tests for `bulk-generator.test.ts`
- happy path: generates N codes with correct format
- count boundary: 0 → throw, 1001 → throw, 1 → ok, 1000 → ok
- collision retry: mock first 2 SELECTs to return existing → expect 3rd to succeed
- collision exhaust: mock SELECT always returns existing → expect throw

### 5. Write route tests for `bulk-generate.route.test.ts`
- non-admin → 401/403
- rate limit exceeded → 429
- invalid count → 400 Zod error
- happy path: 10 codes → 200 + CSV present

### 6. Build + lint + test
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
pnpm build && pnpm lint && pnpm test
```

### 7. Deploy to staging (NOT prod yet)
```bash
npm run deploy:staging
curl -X POST "$STAGING_URL/api/admin/promo-codes/bulk-generate" \
  -H "Cookie: <admin session>" -H "Content-Type: application/json" \
  -d '{"baseCode":"FREE100","count":3,"tier":"master","description":"smoke"}'
```

## Todo List
- [ ] Add `randomBase32` util in `src/seed/utils/`
- [ ] Implement `bulk-generator.ts` in `src/land/promo/`
- [ ] Export `bulkGeneratePromoCodes` from `src/land/promo/index.ts`
- [ ] Implement route `bulk-generate/route.ts`
- [ ] Write 4 unit tests for bulk-generator
- [ ] Write 4 route tests
- [ ] `pnpm build && pnpm lint && pnpm test` → green
- [ ] Deploy staging + smoke test 3-code generation
- [ ] No PROD deploy yet (gate at Phase 10 final sign-off)

## Success Criteria
- All new tests pass
- Build 0 errors, lint 0 errors
- Staging smoke test returns valid CSV with 3 unique codes
- Generated codes match regex `^FREE100-[A-Z2-7]{8}$`
- Audit log entry written per batch

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Collision at large N (1000) | Low | Med | 8-char base32 = 32^8 = 1.1T combos; collision check + 3 retries |
| D1 transaction limit on 1000-row INSERT | Med | High | If D1 rejects, batch into chunks of 100 within single request |
| Rate limit table missing | Med | Med | If `tree/rate-limit/` not present, inline KV check or skip with TODO + comment |
| `admin_audit_log` table missing | Low | Med | Check migration history; if missing, add migration 0114 in this phase |

## Security Considerations
- Admin-only endpoint enforced via `requireAdmin()`
- Rate limit prevents enumeration / spam
- Codes generated server-side with crypto-random (not Math.random)
- CSV download returned in-memory only — no temp file leak
- Audit log captures `adminId`, `batchId`, `count` for forensics
- Zod validation rejects malformed input before DB hit
- `expiresAt` validated positive int

## Next Steps
- Phase 04 (admin UI) consumes this endpoint
- Phase 05 pen test will hammer this endpoint (auth bypass, count overflow, SQL injection on description)
- Phase 08 E2E test will generate codes here then redeem via /redeem
