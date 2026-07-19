# Phase 1: Architecture Cleanup

## Overview

- **Priority:** P0
- **Status:** pending
- **Ngày:** 2026-05-31
- **Mục tiêu:** Consolidate legacy `lib/` vào 4-layer architecture, enforce barrel exports, clean imports

## Requirements

### Functional
- Tất cả imports trong `src/` phải đi qua canonical paths (`@/seed/*`, `@/tree/*`, `@/forest/*`, `@/land/*`)
- Barrel exports (`index.ts`) cho mỗi domain folder
- Không còn `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`

### Non-functional
- `npm run build` → 0 errors
- `npm test` → pass all
- Không thay đổi behavior — chỉ refactor import paths

## Architecture

```
src/
├── seed/          # Foundational primitives (types, config, db, auth)
│   └── index.ts   # Barrel export
├── tree/          # Domain reusable (byok, handover, audit, telegram)
│   └── index.ts
├── forest/        # Orchestrators (inngest, raas, quota, usage-metering)
│   └── index.ts
└── land/          # Business workflows (billing, payouts, affiliates)
    └── index.ts
```

## Related Code Files

| Action | Path |
|--------|------|
| Audit imports | `src/**/*.ts`, `src/**/*.tsx` (grep `from '@/lib/`) |
| Cleanup | `src/lib/` — move remaining logic to appropriate layer |
| Barrel exports | `seed/index.ts`, `tree/index.ts`, `forest/index.ts`, `land/index.ts` |

## Implementation Steps

1. **Scan** — grep toàn bộ `src/` tìm `from '@/lib/` imports
2. **Classify** — mỗi import → xác định layer phù hợp (seed/tree/forest/land)
3. **Barrel** — tạo/update `index.ts` cho mỗi domain folder
4. **Migrate** — move code từ `lib/` sang layer phù hợp, update imports
5. **Verify** — build + test pass

## Todo List

- [ ] Grep `from '@/lib/` across entire src/
- [ ] Map each import to target layer
- [ ] Create/update barrel exports (index.ts) per domain
- [ ] Migrate remaining lib/ modules to correct layers
- [ ] Update all import statements
- [ ] Run build + test

## Success Criteria

- Zero `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate` imports
- `npm run build` → 0 TypeScript errors
- `npm test` → all pass
- Each domain folder has `index.ts` barrel

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking import during migration | HIGH | Change one domain at a time, test after each |
| Circular dependencies after reorg | MEDIUM | Follow 4-layer import rules strictly |
| Legacy `lib/` has hidden cross-cutting code | LOW | Audit thoroughly before moving |

## Security Considerations

- Auth imports (`getCurrentUser`) must go through `@/seed/auth/better-auth-session`
- DB client must use sync `createServerClient()` from `@/seed/db/client`
- No auth/secret leakage in moved modules
