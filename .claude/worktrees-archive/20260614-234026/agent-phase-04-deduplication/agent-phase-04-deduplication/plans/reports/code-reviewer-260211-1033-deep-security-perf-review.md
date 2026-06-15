# Code Review: Deep Security & Performance Audit (Pre-Delivery)

**Date:** 2026-02-11
**Reviewer:** code-reviewer agent
**Scope:** 59 files changed, 399+/399- (unstaged changes in sophia-ai-factory)
**Build:** PASS (0 TS errors, compiled in 12.7s)
**Tests:** PASS (241/241, 32 test files, 7.2s)

---

## Tong Ket (Overall Assessment)

Batch thay doi nay la mot **security + performance + a11y refactor dang ke**. Phan lon thay doi deu dung huong, dac biet la cac fix bao mat. Tim thay **1 bug logic**, **1 React lint issue**, va vai **minor concern**.

---

## CRITICAL Issues

### (none)

Khong tim thay loi bao mat nghiem trong nao. Cac thay doi bao mat deu di dung huong.

---

## HIGH Priority Findings

### 1. BUG LOGIC: setup/save/route.ts - Object key mutation truoc Vercel check

**File:** `src/app/api/setup/save/route.ts` (line 56 vs line 83)

**Van de:** `typedConfig` la reference truc tiep toi `config`. Trong block try (line 49-68), cac key da xu ly bi `delete` khoi `typedConfig`. Khi chay tren Vercel (line 81-88), `Object.keys(config)` co the tra ve tap key thieu vi da bi xoa o buoc truoc.

**Tac dong:** Neu Vercel instance co file `.env.local` ton tai (hiem gap nhung co the), response `requiredKeys` se thieu cac key da duoc xu ly. Tren Vercel thuong khong co `.env.local` nen loi nay HIEM KHI xay ra, nhung logic van sai.

**Muc do:** HIGH (logic bug, low probability)

### 2. REACT LINT: filter-panel.tsx - useEffect missing dependencies

**File:** `src/components/discovery/filter-panel.tsx` (line 25)

**Van de:** useEffect dependency array `[localMinSps]` thieu `filters` va `onFilterChange`. Co the gay stale closure — khi `filters` thay doi tu ben ngoai, callback ben trong useEffect van capture gia tri cu.

**Tac dong:** Slider debounce co the ghi de filters moi bang filters cu, gay mat du lieu filter.

**Muc do:** HIGH (functional bug risk)

---

## MEDIUM Priority Findings

### 3. Empty catch block - integrations/page.tsx

**File:** `src/app/[locale]/(admin)/admin/settings/integrations/page.tsx` (line 21-22)

```typescript
} catch (error) {
} finally {
```

Nen dung `} catch {` (khong co bien `error` unused) hoac log loi ra.

### 4. React `selected` attribute warning - settings/page.tsx

**File:** `src/app/[locale]/(admin)/admin/settings/page.tsx` (line 81)

```tsx
<option value="ENTERPRISE" selected>ENTERPRISE</option>
```

React khong ho tro `selected` tren `<option>`. Nen dung `defaultValue="ENTERPRISE"` tren `<select>`.

### 5. Supabase client Proxy - potential debugging difficulty

**File:** `src/lib/supabase/client.ts`

Proxy pattern lam `instanceof` check va `typeof` inspection khong hoat dong dung. Dev tools co the hien thi object la `Proxy` thay vi `SupabaseClient`. Nen migration dan sang `getSupabaseClient()` truc tiep.

### 6. SSRF protection edge cases - validate-link/route.ts

**File:** `src/app/api/discovery/validate-link/route.ts`

`isSafeUrl()` khong chan:
- Octal IP encoding (`0177.0.0.1` = `127.0.0.1`)
- IPv4-mapped IPv6 (`::ffff:127.0.0.1`)
- DNS rebinding attacks

Cho endpoint public validate-link, muc bao ve hien tai la **du tot** cho MVP nhung nen bo sung trong tuong lai.

---

## File-by-File Review

### OK (No Issues)

| File | Nhan xet |
|------|----------|
| `next.config.ts` | X-XSS-Protection=0 (dung per MDN), X-Frame-Options=DENY, CSP connect-src cu the, formats avif+webp |
| `scripts/check-migration.ts` | XOA hardcoded service role key - dung |
| `scripts/run-migration-007.ts` | XOA hardcoded service role key - dung |
| `.gitignore` | `.env*` voi `!.env.example` exception - dung |
| `api/admin/invite/route.ts` | XOA fallback password, require env vars - dung |
| `api/check-access/route.ts` | Dev-only query param fallback - dung |
| `api/check-access/route.test.ts` | Mock Supabase auth, remove userId query param - dung |
| `api/checkout/route.ts` | Dung env var thay vi request origin header - chong open redirect |
| `api/discovery/search/route.ts` | Hide affiliate_link, remove error details - dung |
| `api/discovery/top-50/route.ts` | Remove error details from response - dung |
| `api/discovery/validate-link/route.ts` | SSRF protection, redirect:manual - tot |
| `api/heygen/avatars/route.ts` | Them auth guard - dung |
| `api/heygen/status/[id]/route.ts` | Them auth guard - dung |
| `api/heygen/voices/route.ts` | Them auth guard - dung |
| `api/setup/verify/route.ts` | isConfigured guard, chong probing - dung |
| `supabase/types.ts` | Them `Relationships: []` cho SDK typing - dung |
| `telegram-client.ts` | Env validation, try-catch, HTTP check - dung |
| `telegram-bot.ts` | Xoa comment thua - dung |
| `telegram-command-handlers.ts` | Xoa unused import `getSubscriptionStatus` (van export tu subscription.ts) - dung |
| `polar-client.ts` | Implement real webhook verify voi standardwebhooks - dung |
| `gateway-types.ts` | Them Checkpoint interface - dung |
| `heygen-client.ts` | Xoa verbose comments - dung |
| `clickbank-adapter.ts` | Xoa verbose comments - dung |
| `generate-campaign.ts` | Cap nhat ts-expect-error comment - dung |
| `intelligence/runner.ts` | Xoa verbose comments, logic unchanged - dung |
| `logger-utility.ts` | Fix logger no-op → actual console output - quan trong |
| `validation/services.ts` | Xoa verbose thinking comments, logic unchanged - dung |
| `actions/admin.ts` | Real Supabase auth thay vi mock - dung |
| `actions/campaign-export-actions.ts` | Xoa verbose comments - dung |
| `actions/campaigns.ts` | Xoa verbose comments - dung |
| `actions/settings.ts` | Xoa verbose comments, logic unchanged - dung |
| `actions/templates.ts` | Xoa unused import, eslint-disable - dung |
| `text-to-speech-generator-elevenlabs.ts` | Fix empty catch, them error logging - dung |
| `layout.tsx` | Dynamic import Toaster, FloatingHelpButton - tot cho bundle |
| `campaign-list.tsx` | useMemo cho createBrowserClient - dung |
| `campaign detail page.test.tsx` | Xoa `:any` types - dung |
| `fade-in-view.tsx` | createElement thay vi ts-expect-error - tot |
| `floating-element-background-animation.tsx` | XOA (dead code, khong import nao) - dung |
| `staggered-grid-with-framer-motion.tsx` | XOA (dead code, khong import nao) - dung |
| `video-preview.tsx` | Xoa empty useEffect, them preload/sizes/aria - dung |
| `filter-sidebar.tsx` | Thay motion.div bang FadeInView - dung |
| `program-card.tsx` | Thay motion.div bang FadeInView - dung |
| `program-grid.tsx` | Them aria-labels, aria-hidden - dung |
| `faq.tsx` | Them id cho faq-question button - dung |
| `UpgradeBanner.tsx` | Xoa verbose comments - dung |
| `appearance-section.tsx` | Chuyen div sang button voi role=radio - a11y tot |
| `api-keys-section.tsx` | Them aria-label cho toggle buttons - dung |
| `guide/layout.tsx` | Them role=presentation, aria-hidden cho overlay - dung |
| `admin/affiliates/page.tsx` | Them aria-label, aria-hidden - dung |
| `admin/features/page.tsx` | Them role=switch, aria-checked, aria-label - dung |
| `admin/users/admin-users-client.tsx` | Them htmlFor + id - dung |
| `charts.tsx` | Xoa verbose comment - dung |
| `84tea/contact/page.tsx` | Minor change - dung |
| `84tea/franchise/apply/page.tsx` | Minor change - dung |

### CHU Y (Warnings)

| File | Van de |
|------|--------|
| `filter-panel.tsx` | useEffect missing deps `[localMinSps]` → nen `[localMinSps, filters, onFilterChange]` |
| `integrations/page.tsx` | Empty catch block (line 21-22) |
| `admin/settings/page.tsx` | `selected` attribute tren `<option>` (React warning) |
| `supabase/client.ts` | Proxy pattern can migration dan |
| `api/setup/save/route.ts` | Object key mutation bug (hiem gap) |

### CAN FIX

| File | Van de | Priority |
|------|--------|----------|
| `api/setup/save/route.ts` | Clone `config` truoc khi mutate: `const typedConfig = {...config} as Record<string, string>` | HIGH |
| `filter-panel.tsx` | Them `filters, onFilterChange` vao useEffect deps | HIGH |
| `admin/settings/page.tsx` | Dung `defaultValue="ENTERPRISE"` tren `<select>` thay vi `selected` | MEDIUM |
| `integrations/page.tsx` | Dung `} catch {` (khong co bien unused) | LOW |

---

## Diem Tich Cuc

1. **Bao mat**: Xoa 2 hardcoded credentials (Supabase key + admin password) — critical fix
2. **Bao mat**: SSRF protection cho validate-link endpoint — comprehensive
3. **Bao mat**: Setup endpoint guard (isConfigured) — chong tampering/probing
4. **Bao mat**: Khong tra env content ve client (setup/save) — loai bo leak risk
5. **Bao mat**: Auth guard cho HeyGen API routes — 3 endpoints duoc bao ve
6. **Bao mat**: Dev-only fallback cho check-access — production khong bi bypass
7. **Bao mat**: CSP cau hinh cu the cho tung domain — tot hon wildcard
8. **Performance**: Dynamic imports cho Toaster + FloatingHelpButton — giam initial bundle
9. **Performance**: useMemo cho Supabase client — tranh re-create moi render
10. **Performance**: Lazy singleton Supabase client — khong crash build/test
11. **Performance**: Debounced slider — giam re-render + API calls
12. **A11y**: 30+ aria attributes them vao — radiogroup, switch, labels, aria-hidden
13. **Code quality**: Xoa ~150 dong comment verbose (thinking-out-loud style)
14. **Code quality**: Xoa 2 dead component files, unused imports
15. **Code quality**: Fix logger no-op → actual output
16. **Code quality**: Real webhook verification (polar-client.ts)

---

## Metrics

| Metric | Value |
|--------|-------|
| Build | PASS (12.7s, 0 errors) |
| Tests | 241/241 passed (32 files) |
| TS Errors | 0 |
| Dead Code Removed | 2 files (140 lines) |
| Security Fixes | 8 (2 critical credentials, SSRF, auth guards, CSP, endpoint guards) |
| a11y Improvements | 30+ aria attributes across 12 files |
| Performance Improvements | 4 (dynamic imports, useMemo, lazy init, debounce) |
| Issues Found | 2 HIGH, 4 MEDIUM/LOW |

---

## Ket Luan

Batch nay **san sang de commit** voi **2 fix nho** can xu ly truoc:
1. Clone object `config` trong setup/save/route.ts
2. Them deps vao useEffect trong filter-panel.tsx

Tong the day la mot **security hardening + performance + a11y refactor chat luong cao**, phu hop de giao hang cho khach.
