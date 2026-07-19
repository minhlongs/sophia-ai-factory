---
title: "Phase 1: Console Cleanup"
description: "Loại bỏ 27 console.log statements, replace với logger utility"
status: pending
priority: P0
effort: 2h
branch: main
tags: [tech-debt, cleanup, logging]
created: 2026-03-08
---

# Phase 1: Console Cleanup — Dọn Dẹp console.log

## Mục Tiêu

Loại bỏ **27 console.log statements** khỏi production code, replace với logger utility chuẩn.

## Files Cần Sửa (10 files)

| File | console.log Count | Action |
|------|-------------------|--------|
| `src/lib/utils/logger-utility.ts` | N/A | KEEP — Đây là logger utility |
| `src/lib/usage-metering/debug-logger.ts` | N/A | REFACTOR — Chuyển sang dùng logger-utility |
| `src/lib/raas-gateway-client.ts` | 3 | REPLACE |
| `src/hooks/use-analytics-data.ts` | 2 | REPLACE |
| `src/components/analytics/customer-search.tsx` | 4 | REMOVE |
| `src/components/analytics/service-breakdown.tsx` | 2 | REMOVE |
| `src/components/analytics/license-utilization.tsx` | 3 | REMOVE |
| `src/components/analytics/usage-chart.tsx` | 2 | REMOVE |
| `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx` | 5 | REMOVE |
| `src/components/admin/licenses/license-list.tsx` | 2 | REPLACE |
| `src/app/[locale]/(admin)/admin/licenses/page.tsx` | 2 | REPLACE |
| `src/components/admin/licenses/audit-log-table.tsx` | 2 | REMOVE |

## Steps Thực Hiện

### Step 1: Đọc và Understand Logger Utility

```bash
# Đọc logger utility hiện tại
Read: src/lib/utils/logger-utility.ts
```

### Step 2: Replace console.log trong Lib Files

**Files ưu tiên (lib/):**
1. `src/lib/raas-gateway-client.ts` — Replace với logger utility
2. `src/lib/usage-metering/debug-logger.ts` — Refactor để dùng logger-utility

**Pattern thay thế:**
```typescript
// ❌ TRƯỚC
console.log('Debug info:', data);
console.error('Error:', error);

// ✅ SAU
import { logger } from '@/lib/utils/logger-utility';
logger.debug('Debug info:', { data });
logger.error('Error:', error);
```

### Step 3: Remove console.log trong Components

**Components analytics (8 console.log):**
- Customer tìm kiếm, service breakdown, license utilization, usage chart
- Đa số là debug code trong development → **REMOVE HOÀN TOÀN**

**Pattern:**
```typescript
// ❌ XÓA
console.log('Chart data:', payload);

// ✅ HOẶC GIỮ LẠI (nếu cần debug production)
// logger.debug('Chart data:', { payload }); // Tạm thời comment
```

### Step 4: Remove console.log trong Admin Pages

**Admin license pages (4 console.log):**
- License list, audit log table
- Replace với logger utility hoặc remove

### Step 5: Verify

```bash
# Verify chỉ còn logger-utility.ts có console.log
grep -r "console\." src --include="*.ts" --include="*.tsx" | grep -v "logger-utility.ts" | wc -l
# Expected: 0
```

## Success Criteria

- [ ] 0 console.log statements (trừ `logger-utility.ts`)
- [ ] 0 console.warn statements
- [ ] 0 console.error statements (trừ error boundaries)
- [ ] Logger utility được sử dụng nhất quán
- [ ] `npm run lint` pass

## Estimated Time: 2h

| Task | Time |
|------|------|
| Read & understand logger utility | 15min |
| Replace in lib files (2 files) | 30min |
| Remove in components (4 files) | 30min |
| Remove in admin pages (3 files) | 30min |
| Verify & lint | 15min |

## Dependencies

- none

## Blocked By

- none

## Blocks

- Phase 2: Type Safety (một số files overlap)
- Phase 6: Final Verification
