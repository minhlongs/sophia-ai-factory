---
title: "Phase 2: Type Safety"
description: "Loại bỏ 15+ any types trong production code"
status: pending
priority: P0
effort: 4h
branch: main
tags: [typescript, type-safety, quality]
created: 2026-03-08
---

# Phase 2: Type Safety — Loại Bỏ Any Types

## Mục Tiêu

Loại bỏ **15+ `any` types** trong production code, replace với proper TypeScript interfaces.

## Any Type Hotspots (30 occurrences total)

### Priority P0 — Critical Business Logic (15 any)

| File | Any Count | Impact | Priority |
|------|-----------|--------|----------|
| `src/app/api/admin/usage/reconciliation/route.ts` | 8 | High — Billing logic | P0 |
| `src/lib/analytics/roi-calculator.ts` | 4 | High — ROI calculation | P0 |
| `src/lib/analytics/graphql-resolvers.ts` | 5 | Medium — GraphQL API | P1 |
| `src/lib/analytics/export.ts` | 2 | Medium — CSV export | P1 |

### Priority P1 — Testing & Secondary (15 any)

| File | Any Count | Impact | Priority |
|------|-----------|--------|----------|
| `src/lib/usage-metering/rollup-service.ts` | 2 | Medium | P1 |
| `src/lib/usage-metering/aggregator.ts` | 5 | High — Usage aggregation | P0 |
| `src/lib/usage-metering/export.ts` | 2 | Low | P2 |
| `src/lib/usage-metering/debug-logger.ts` | 3 | Low — Debug only | P2 |
| `src/lib/raas-gateway-client.ts` | 1 | Medium — Cache | P1 |
| Test files | 8+ | Low — Tests only | P2 |

## Steps Thực Hiện

### Step 1: Đọc Files Phân Tích

```bash
# Đọc các file critical trước
Read: src/app/api/admin/usage/reconciliation/route.ts
Read: src/lib/analytics/roi-calculator.ts
Read: src/lib/usage-metering/aggregator.ts
```

### Step 2: Tạo Interfaces Cho Reconciliation Route

**File: `src/app/api/admin/usage/reconciliation/route.ts`**

```typescript
// ❌ TRƯỚC
function determineDeduplicationStatus(event: any): 'success' | 'duplicate' | 'failed'
function buildRawPayload(event: any): Record<string, unknown>

// ✅ SAU
interface UsageEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  credits_used: number;
  timestamp: string;
  // ... thêm fields từ Supabase schema
}

function determineDeduplicationStatus(event: UsageEvent): 'success' | 'duplicate' | 'failed'
function buildRawPayload(event: UsageEvent): Record<string, unknown>
```

### Step 3: Fix ROI Calculator

**File: `src/lib/analytics/roi-calculator.ts`**

```typescript
// ❌ TRƯỚC
const totalCreditsUsed = usageEvents?.reduce((sum: any, e: any) => sum + (e.credits_used || 0), 0) || 0;

// ✅ SAU
interface UsageEvent {
  credits_used: number;
  timestamp: string;
  // ...
}
const totalCreditsUsed = usageEvents?.reduce((sum: number, e: UsageEvent) => sum + e.credits_used, 0) || 0;
```

### Step 4: Fix GraphQL Resolvers

**File: `src/lib/analytics/graphql-resolvers.ts`**

```typescript
// ❌ TRƯỚC
_parent: any,

// ✅ SAU
import { GraphQLResolveInfo } from 'graphql';
_parent: unknown, // hoặc tạo interface cho parent type
```

### Step 5: Fix Usage Metering Aggregator

**File: `src/lib/usage-metering/aggregator.ts`**

```typescript
// ❌ TRƯỚC
const hourlyCredits = (hourlyData as any[])?.reduce((sum: number, r: any) => sum + (r.credits_used || 0), 0);

// ✅ SAU
interface HourlyUsageRecord {
  credits_used: number;
  hour: string;
}
const hourlyCredits = (hourlyData as HourlyUsageRecord[])?.reduce((sum, r) => sum + r.credits_used, 0);
```

### Step 6: Verify

```bash
# Count any types in production code (exclude test files)
grep -r ": any" src --include="*.ts" --exclude="*.test.ts" | wc -l
# Expected: 0

# Check for implicit any
npx tsc --noEmit 2>&1 | grep -i "implicit" | wc -l
# Expected: 0
```

## Success Criteria

- [ ] 0 `: any` trong production code (exclude test files)
- [ ] 0 implicit any errors từ TypeScript compiler
- [ ] `npx tsc --noEmit` pass với 0 errors
- [ ] Interfaces được define rõ ràng cho tất cả business logic
- [ ] `npm run lint` pass

## Estimated Time: 4h

| Task | Time |
|------|------|
| Read & analyze files | 30min |
| Fix reconciliation route (8 any) | 45min |
| Fix ROI calculator (4 any) | 30min |
| Fix GraphQL resolvers (5 any) | 30min |
| Fix usage-metering aggregator (5 any) | 45min |
| Fix remaining files | 30min |
| Verify & TypeScript compile | 30min |

## Dependencies

- Phase 1: Console Cleanup (một số files overlap)

## Blocks

- Phase 3: Test Coverage (cần types đúng để viết tests)
- Phase 6: Final Verification

## Unresolved Questions

1. Có nên enable `noImplicitAny` trong tsconfig.json không?
2. GraphQL `_parent` type nên là `unknown` hay tạo interface riêng?
