# Phase 04 — Admin UI: Bulk Codes + Search/Filter

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §9 Q2 (large 1000+ campaign)
- Phase 03 endpoint: `src/app/api/admin/promo-codes/bulk-generate/route.ts`
- Existing list endpoint: `src/app/api/admin/promo-codes/list/route.ts`
- Existing dashboard structure: `src/app/[locale]/dashboard/`
- i18n protocol: CLAUDE.md Rule 8 (sync vi.ts + en.ts)
- Sophia handover rules: `.claude/rules/sophia-handover-rules.md` (bilingual VI+EN)

## Overview
- **Priority:** P0 (must exist for client to manage 1000-code campaign)
- **Status:** pending
- **Duration:** ~1 day (D4)
- **Brief:** Two new admin pages: `bulk` (generate + CSV) and `list` (search/filter/paginate). Both bilingual (VI primary, EN secondary). Server Actions for mutations per Sophia code standards.

## Key Insights
- Existing admin promo CRUD endpoints already cover create/list/status/redemptions
- This phase only adds UI layer + new `bulk` route + enhanced `list` page
- Client is non-tech CEO → all labels bilingual, emoji-friendly, no jargon
- Rule 8 i18n SYNC: every `t('key')` must exist in BOTH vi.ts and en.ts

## Requirements
**Functional:**
- Page `/dashboard/admin/promo-codes/bulk`: form (count 1-1000, description, expiresAt picker) → submit → table preview + CSV download
- Page `/dashboard/admin/promo-codes/list`: search by code prefix, filter by status (active/expired/used)/tier/redemption count, paginated 50/page, CSV export action
- Both pages admin-gated (server-side redirect non-admin)
- Loading + error states per Sophia Front 5 UX standard

**Non-functional:**
- Bilingual: vi.ts + en.ts keys synced (Rule 8)
- p95 page render < 1s on staging
- CSV download triggers browser file save (no temp file)
- Responsive (mobile-friendly per Sophia handover rules)

## Architecture
```
/dashboard/admin/promo-codes/bulk/
  page.tsx (server component, admin gate)
  bulk-form-client.tsx (client form + fetch)

/dashboard/admin/promo-codes/list/
  page.tsx (server component, fetches initial page)
  list-table-client.tsx (client search/filter/paginate)
```

Server Actions used for any mutation; GET reads via server fetch.

## Related Code Files
**Create:**
- `src/app/[locale]/dashboard/admin/promo-codes/bulk/page.tsx`
- `src/app/[locale]/dashboard/admin/promo-codes/bulk/bulk-form-client.tsx`
- `src/app/[locale]/dashboard/admin/promo-codes/list/page.tsx`
- `src/app/[locale]/dashboard/admin/promo-codes/list/list-table-client.tsx`
- `src/app/[locale]/dashboard/admin/promo-codes/list/csv-export-action.ts` (Server Action)
- `tests/e2e/admin-promo-bulk.spec.ts` (Playwright)

**Modify:**
- `src/locales/vi.ts` (add `admin.promo.bulk.*` + `admin.promo.list.*` keys)
- `src/locales/en.ts` (same keys, English)
- `src/app/[locale]/dashboard/admin/page.tsx` or sidebar component (add nav link to promo bulk/list)

**Delete:** none

## Implementation Steps

### 1. Add i18n keys (Rule 8 SYNC)
```ts
// vi.ts (add under admin)
admin: {
  promo: {
    bulk: {
      title: 'Tạo mã hàng loạt',
      countLabel: 'Số lượng mã (1-1000)',
      descriptionLabel: 'Mô tả chiến dịch',
      expiresLabel: 'Ngày hết hạn',
      submit: 'Tạo mã',
      successCount: 'Đã tạo {count} mã thành công',
      downloadCsv: 'Tải xuống CSV',
    },
    list: {
      title: 'Quản lý mã khuyến mãi',
      searchPlaceholder: 'Tìm theo mã...',
      filterStatus: 'Trạng thái',
      filterTier: 'Gói',
      filterRedeemed: 'Đã sử dụng',
      exportCsv: 'Xuất CSV',
      page: 'Trang',
      noResults: 'Không tìm thấy mã nào',
    },
  },
},
```
Mirror in `en.ts` with English text. Verify with grep both files have same key paths.

### 2. Bulk page (server component)
```tsx
// src/app/[locale]/dashboard/admin/promo-codes/bulk/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/better-auth-session';
import { requireAdminOrRedirect } from '@/seed/auth/require-admin';
import BulkFormClient from './bulk-form-client';

export default async function BulkPage() {
  const user = await getCurrentUser();
  await requireAdminOrRedirect(user, '/dashboard');
  return <BulkFormClient />;
}
```

### 3. Bulk form client
```tsx
// bulk-form-client.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function BulkFormClient() {
  const t = useTranslations('admin.promo.bulk');
  const [count, setCount] = useState(10);
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [result, setResult] = useState<{codes: string[]; csv: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/promo-codes/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCode: 'FREE100', count, tier: 'master',
          description, expiresAt: expiresAt ? Date.parse(expiresAt) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function downloadCsv() {
    if (!result) return;
    const blob = new Blob([result.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `free100-codes-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // … render form + table + download button
}
```

### 4. List page + search/filter client
- Server fetches initial page 1 (limit 50)
- Client component receives initial data + URL search params for state
- On filter change → update URL params + refetch via Server Action or client fetch
- Pagination: prev/next buttons + page number
- CSV export action: Server Action that streams all matching rows (use cursor pagination internally)

### 5. CSV export Server Action
```ts
// csv-export-action.ts
'use server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { requireAdmin } from '@/seed/auth/require-admin';
import { listPromoCodes } from '@/land/promo/promo-repo';

export async function exportPromoCsv(filters: {status?: string; tier?: string; codePrefix?: string}) {
  const user = await getCurrentUser();
  await requireAdmin(user);
  const all = await listPromoCodes({ ...filters, limit: 10000 });
  const csv = ['code,tier,status,maxUses,redeemedCount,createdAt'].concat(
    all.map(c => `${c.code},${c.appliesToTier},${c.status},${c.maxUses},${c.redeemedCount ?? 0},${c.createdAt}`)
  ).join('\n');
  return { csv, count: all.length };
}
```

### 6. Update sidebar nav
Add links to bulk + list pages under admin section.

### 7. Playwright E2E test
```ts
// tests/e2e/admin-promo-bulk.spec.ts
test('admin can bulk-generate 10 FREE100 codes and download CSV', async ({ page }) => {
  await page.goto('/en/sign-in'); /* admin login */
  await page.goto('/en/dashboard/admin/promo-codes/bulk');
  await page.fill('input[name=count]', '10');
  await page.fill('input[name=description]', 'e2e test');
  await page.click('button[type=submit]');
  await expect(page.getByText(/Generated 10/)).toBeVisible({ timeout: 5000 });
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=Download CSV');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/free100-codes-\d+\.csv/);
});
```

### 8. Build + test
```bash
pnpm build && pnpm lint && pnpm test
npx playwright test tests/e2e/admin-promo-bulk.spec.ts
```

### 9. Deploy staging + smoke
```bash
npm run deploy:staging
# Browser: log in as admin on staging, generate 5 codes, download CSV, verify content
```

## Todo List (Phase 04a — MVP shipped 2026-05-18)
- [x] Add `admin.promoCodes.bulk.*` keys to messages/vi.json + en.json (both files, 21 keys each)
- [x] Grep both locale files to confirm key parity (`Symmetric diff: NONE`)
- [x] Implement bulk page + client form (BulkFormClient)
- [x] Implement CSV download in browser (Blob + a[download])
- [x] Add bulk-generate link to existing promo-codes page header (lucide Layers icon, data-testid)
- [x] Write Playwright E2E test (contract-level: anon 401, page redirect, 400 invalid body)
- [x] TS check 0 errors, lint 0 errors, i18n validate 0 missing (1,097 keys total)
- [~] Deploy staging + manual smoke — deferred (blocked on user Phase 02 secrets + deploy:staging)

## Todo List (Phase 04b — follow-up, deferred)
- [ ] List page enhanced search by code prefix
- [ ] List page filter by status/tier/redemption count
- [ ] List page pagination (50/page)
- [ ] CSV export Server Action for filtered list (full export, not just current page)
- [ ] Add `admin.promoCodes.list.*` i18n keys
- [ ] Full authenticated Playwright flow (login → bulk → CSV download → reset)

## Success Criteria
- Bulk page generates N codes and downloads valid CSV
- List page searches by prefix and filters by status/tier
- Pagination works at 50/page
- Both pages render bilingual based on `[locale]` segment
- No i18n raw key visible in browser (Rule 8)
- Playwright test passes on staging

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| i18n key mismatch vi.ts vs en.ts | High | Med | Run grep diff after edits; CI script could enforce |
| List endpoint too slow at 10k rows | Med | Med | Add D1 index on `(status, applies_to_tier, created_at)` if missing |
| CSV download large (1000 rows) freezes browser | Low | Low | Stream via Server Action; 1000 rows = ~80KB, no issue |
| Search SQL injection via codePrefix | Low | High | Parameterize all D1 queries; never string-concat |

## Security Considerations
- Both pages server-guarded `requireAdminOrRedirect`
- Server Actions re-check admin (defense in depth)
- All filters parameterized via D1 `.bind()`
- CSV export limited 10k rows (DoS prevention)
- No client-side trust: count clamped server-side too
- Audit log entries already written by Phase 03 endpoint

## Next Steps
- Phase 05 pen test will attempt to bypass admin gate on these pages
- Phase 08 Playwright E2E will chain bulk → redeem → handover
- Phase 10 training video records this UI for client walkthrough
