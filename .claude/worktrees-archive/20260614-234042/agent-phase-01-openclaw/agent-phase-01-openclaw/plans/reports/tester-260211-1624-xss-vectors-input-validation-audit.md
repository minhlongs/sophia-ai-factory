# Security Audit Report - XSS Vectors & Input Validation

**Project:** Sophia AI Factory
**Date:** 2026-02-11
**Auditor:** tester (subagent a7fa6da)
**Scope:** src/ directory - XSS vectors, input sanitization, URL parameter injection

---

## Tong Quan (Executive Summary)

Codebase co bao mat XSS **TOT**. Khong su dung `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, hay `document.write()`. React auto-escaping bao ve hau het cac rendering path. CSP headers day du trong `next.config.ts`. Tim thay 2 van de MEDIUM va 3 van de LOW.

**Tong diem dai: 8.5/10**

---

## Ket Qua Kiem Tra (Test Results)

| Metric | Ket qua |
|--------|---------|
| Tong diem input/endpoint da kiem tra | 15 |
| Vulnerable (CRITICAL) | 0 |
| Vulnerable (MEDIUM) | 2 |
| Vulnerable (LOW) | 3 |
| Protected | 10 |

---

## Vulnerable Patterns Found

### [MEDIUM] M-01: ENV Injection via Setup Wizard

- **File:** `/apps/sophia-ai-factory/src/app/api/setup/save/route.ts:57-65`
- **Vector:** Arbitrary key-value injection vao `.env.local`
- **Chi tiet:** `setupConfigSchema` chi validate la `z.record(z.string(), z.string())` - bat ky key-value nao cung duoc chap nhan. Attacker co the inject `ADMIN_USER`, `ADMIN_PASS`, hoac cac env var khac de escalate privileges.
- **Dieu kien:** Chi khi app chua configured (`IS_CONFIGURED !== "true"`) va chay local (khong tren Vercel)
- **Muc do anh huong:** Privilege escalation tren local dev environment
- **Fix:**
  1. Whitelist cac key duoc phep trong Zod schema
  2. Them allow-list: `z.record(z.enum(["OPENROUTER_API_KEY", "ELEVENLABS_API_KEY", "DID_API_KEY", "AIRTABLE_ACCESS_TOKEN", "AIRTABLE_BASE_ID"]), z.string())`
  3. Validate key name regex (chi cho phep uppercase + underscore)

### [MEDIUM] M-02: Open Redirect via Checkout URL

- **File:** `/apps/sophia-ai-factory/src/components/pricing-section.tsx:187`
- **Vector:** `window.location.href = data.url;`
- **Chi tiet:** URL tu API response (`/api/checkout` POST) duoc gan truc tiep vao `window.location.href`. Neu Polar API bi compromise hoac server bi MITM, co the redirect user den `javascript:` hoac phishing URL.
- **Muc do anh huong:** Open redirect -> phishing, session theft
- **Fix:**
  1. Validate URL truoc khi redirect: kiem tra `data.url.startsWith('https://')`
  2. Whitelist domain: chi cho phep `polar.sh`, `checkout.polar.sh`
  3. Su dung `URL` constructor de validate protocol

### [LOW] L-01: CSP `script-src 'unsafe-inline'`

- **File:** `/apps/sophia-ai-factory/next.config.ts:65`
- **Vector:** Cho phep inline scripts, giam hieu qua CSP chong XSS
- **Chi tiet:** `'unsafe-inline'` trong `script-src` la yeu diem. Neu co XSS vector khac, CSP se khong chan duoc.
- **Fix:** Su dung nonce-based CSP voi Next.js CSP nonce feature (Next.js 14+)

### [LOW] L-02: Admin Invite Khong Co Zod Validation

- **File:** `/apps/sophia-ai-factory/src/app/api/admin/invite/route.ts:42-43`
- **Vector:** `const { email, tier } = body as { email?: string; tier?: string };`
- **Chi tiet:** Type assertion thay vi Zod validation. Email duoc truyen truc tiep vao Supabase admin API. Mang lai risk injection vao Supabase auth system.
- **Muc do anh huong:** Thap - endpoint da duoc Basic Auth protect, nhung vi pham defense-in-depth
- **Fix:** Them Zod schema: `z.object({ email: z.string().email(), tier: z.enum(VALID_TIERS) })`

### [LOW] L-03: Setup Verify Khong Co Zod Validation

- **File:** `/apps/sophia-ai-factory/src/app/api/setup/verify/route.ts:22-23`
- **Vector:** `const { service, key, params } = body;` - destructure truc tiep tu `request.json()`
- **Chi tiet:** Khong co Zod validation cho body. Service duoc check qua switch-case (implicit whitelist), nhung `key` va `params` duoc truyen truc tiep vao validation functions.
- **Fix:** Them Zod schema validate service, key length, va params structure

---

## Protected Patterns (Diem Manh)

### P-01: KHONG co `dangerouslySetInnerHTML`
- Zero usage trong toan bo codebase
- React auto-escaping bao ve tat ca JSX rendering

### P-02: KHONG co `innerHTML` / `outerHTML` / `eval()` / `document.write()`
- Zero usage - khong co DOM manipulation bypass React

### P-03: Zod Validation cho cac API critical
- `checkoutSchema` - validate tier enum
- `webhookHeaderSchema` - validate Polar webhook headers
- `integrationSchema` - validate network/api_key
- `setupConfigSchema` - validate config structure
- `campaignSchema` - validate campaign fields voi length limits

### P-04: Security Headers Day Du (next.config.ts)
```
HSTS:           max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
CSP:            default-src 'self'; frame-ancestors 'none'; object-src 'none'
Permissions-Policy: camera=(), microphone=(), geolocation=()
Referrer-Policy: origin-when-cross-origin
```

### P-05: SSRF Protection Tren Validate-Link
- `isSafeUrl()` block internal IPs, localhost, metadata endpoints
- Chi cho phep HTTPS
- `redirect: 'manual'` prevent redirect-based SSRF
- 5s timeout

### P-06: Webhook Signature Verification
- Polar webhook: standardwebhooks signature verification
- Telegram webhook: secret token header verification

### P-07: CSV Formula Injection Protection
- `export-utils.ts` strip formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`)
- Double quotes escaped per RFC 4180

### P-08: Auth Callback An Toan
- `code` param chi duoc pass vao `supabase.auth.exchangeCodeForSession()`
- Khong reflect vao response hoac HTML

### P-09: URL Parameters Qua Whitelist/Enum
- Checkout GET: `tier` mapped qua whitelist object, khong reflect truc tiep
- Check-access: `feature`, `limit` cast thanh TypeScript enums
- Discovery search: `q` passed vao Supabase parameterized query

### P-10: Middleware Auth Guards
- Dashboard routes: Supabase auth check
- Admin routes: Basic Auth verification
- Setup wizard: `IS_CONFIGURED` guard

---

## XSS Test Vector Results

| Vector | Ket qua |
|--------|---------|
| `<script>alert('XSS')</script>` | **BLOCKED** - React auto-escaping, CSP `script-src 'self'` |
| `<img src=x onerror=alert('XSS')>` | **BLOCKED** - React khong render raw HTML, CSP `img-src 'self' https: data:` |
| `javascript:alert('XSS')` | **PARTIAL** - M-02 open redirect co the bypass neu URL khong validate |
| `<svg onload=alert('XSS')>` | **BLOCKED** - React auto-escaping, SVGs su dung JSX syntax |

---

## Recommendations (Uu Tien)

### P0 - Khac Phuc Ngay

1. **M-01 Fix:** Whitelist env key names trong `setupConfigSchema`:
```typescript
export const setupConfigSchema = z.object({
  config: z.record(
    z.enum(["OPENROUTER_API_KEY", "ELEVENLABS_API_KEY", "DID_API_KEY",
            "AIRTABLE_ACCESS_TOKEN", "AIRTABLE_BASE_ID"]),
    z.string().min(1)
  ),
});
```

2. **M-02 Fix:** Validate checkout redirect URL:
```typescript
if (data.url && data.url.startsWith('https://')) {
  window.location.href = data.url;
}
```

### P1 - Khac Phuc Tuan Nay

3. **L-02 Fix:** Them Zod schema cho admin invite endpoint
4. **L-03 Fix:** Them Zod schema cho setup verify endpoint

### P2 - Backlog

5. **L-01:** Migrate tu `'unsafe-inline'` sang nonce-based CSP
6. Replace `alert()` calls voi proper toast UI (da co `useToast` hook)
7. Them rate limiting cho public API endpoints (`/api/discovery/*`)

---

## Cau Hoi Chua Giai Quyet

1. `setupConfigSchema` cho phep arbitrary keys -- day la intentional hay bug? Nen co whitelist.
2. CSP `'unsafe-inline'` cho `script-src` co the duoc thay the bang nonce khong? Can kiem tra Next.js 16 support.
3. Cac Supabase RLS policies da duoc kiem tra chua? Khong nam trong scope audit nay nhung anh huong den data injection.
