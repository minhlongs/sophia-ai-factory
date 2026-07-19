---
phase: 1
title: "Foundation"
status: in-progress
effort: "3h"
---

# Phase 1: Foundation

## Overview

Core foundation for white-label: agency tier config, DB types, API key generator, and slug validator. No new tables yet (Phase 2 handles migrations).

## Requirements

- Functional: AGENCY_TIERS config exists, agency API key generation works, slug validation enforces uniqueness
- Non-functional: API keys are 32-byte base64url, slugs are lowercase alphanumeric + hyphen, no `:any` types

## Architecture

### Agency Type (shared with Social RNN)
```typescript
// AGENCY_TIERS record added to tier-configs.ts
export type AgencyTier = 'STARTER' | 'GROWTH' | 'PROFESSIONAL' | 'MASTER';
export const AGENCY_TIERS: Record<AgencyTier, { name: string; maxSubTenants: number; monthlyCredits: number; price: number }>;
```

**NOTE**: These are DISPLAY tier names for the agency module — separate from the consumer `UNIFIED_TIERS` keys (BASIC/PREMIUM/ENTERPRISE/MASTER).

### DB Types
```typescript
// seed/types/index.ts (new records)
export type Agency = { id: string; name: string; slug: string; tier: AgencyTier; apiKeyHash: string; brandingJson: string | null; isActive: number; created_at: number; updated_at: number };
export type SubTenant = { id: string; agencyId: string; name: string; email: string; role: string; created_at: number };
```

### API Key Generator
- 32 bytes → base64url → URL-safe, no padding
- Stored as SHA-256 hash (never plaintext)
- Used as `Authorization: Bearer <agency_api_key>` header for brand tunnel

### Slug Validator
- Pattern: `/^[a-z0-9]+(-[a-z0-9]+)*$/`
- Max 32 chars
- Check uniqueness against `agency` table
- Reserved slugs: `www`, `api`, `admin`, `dashboard`

## Related Code Files

- Modify: `src/seed/config/tiers/tier-configs.ts` — add AGENCY_TIERS + AgencyTier type
- Modify: `src/seed/types/index.ts` — add Agency, SubTenant records
- Create: `src/seed/db/agency-api-key.ts` — generateApiKey(), hashApiKey()
- Create: `src/seed/validators/agency-slug.validator.ts` — validateAgencySlug()
- Create: `src/seed/validators/__tests__/agency-slug.validator.test.ts`

## Implementation Steps

1. Add `AgencyTier` type + `AGENCY_TIERS` config to `tier-configs.ts`
2. Add `Agency` and `SubTenant` records to `src/seed/types/index.ts`
3. Create `agency-api-key.ts`: generateApiKey() returns `{ key, hash }`, hashApiKey() for auth lookup
4. Create `agency-slug.validator.ts`: validateAgencySlug(slug, reservedSet) returns `{ valid, error? }`
5. Write unit tests for slug validator (valid slugs, invalid chars, reserved words, uniqueness)
6. Write unit tests for API key generator (length, format, hash different from plaintext)

## Success Criteria

- [ ] AGENCY_TIERS config exists in `tier-configs.ts`
- [ ] `Agency` and `SubTenant` types exported from `@/seed/types`
- [ ] `generateApiKey()` produces 32-byte base64url keys
- [ ] `hashApiKey()` stores SHA-256, never returns plaintext
- [ ] `validateAgencySlug()` rejects reserved words + invalid chars
- [ ] All unit tests pass, 0 TypeScript errors

## Risk Assessment

- Key storage: must hash before DB insert. Treat as atomic primitive.
- No migrations in this phase (Phase 2 handles schema).
