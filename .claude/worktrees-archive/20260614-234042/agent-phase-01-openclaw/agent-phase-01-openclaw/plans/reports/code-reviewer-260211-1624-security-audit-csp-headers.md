# Security Audit Report - CSP & Headers

**Project:** Sophia AI Factory (Next.js 16 / React 19)
**Date:** 2026-02-11
**Auditor:** code-reviewer agent
**Scope:** CSP headers, security headers, secrets exposure, CORS, XSS protection

---

## Files Reviewed

1. `/apps/sophia-ai-factory/next.config.ts` (security headers + CSP)
2. `/apps/sophia-ai-factory/src/middleware.ts` (auth middleware)
3. `/apps/sophia-ai-factory/src/app/[locale]/layout.tsx` (meta tags)
4. `/apps/sophia-ai-factory/public/manifest.json` (exposed configs)
5. `/apps/sophia-ai-factory/package.json` (dependencies)
6. `/apps/sophia-ai-factory/src/app/api/webhooks/polar/route.ts` (webhook security)
7. `/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts` (webhook security)
8. `/apps/sophia-ai-factory/.gitignore` (secrets exclusion)
9. `/apps/sophia-ai-factory/.env.example` (secrets template)

---

## Findings

### [HIGH] H-01: CSP `script-src 'unsafe-inline'` cho phep XSS
- **Location:** `next.config.ts:65`
- **Risk:** `'unsafe-inline'` trong `script-src` vo hieu hoa mot phan lon bao ve XSS cua CSP. Attacker co the inject inline `<script>` tags va chung se duoc thuc thi.
- **Context:** Next.js SSR can inline scripts, nen day la trade-off pho bien. Tuy nhien, giai phap tot hon la su dung nonce-based CSP.
- **Fix:** Chuyen sang nonce-based CSP voi `next/headers` va middleware. Next.js 16 ho tro `experimental.serverActions.allowedOrigins` va nonce generation. Xem: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

### [HIGH] H-02: Thieu `upgrade-insecure-requests` trong CSP
- **Location:** `next.config.ts:65`
- **Risk:** Khong co directive nay, trình duyet khong tu dong chuyen HTTP -> HTTPS cho cac sub-resources. Mixed content co the xay ra.
- **Fix:** Them `upgrade-insecure-requests;` vao CSP string.

### [MEDIUM] M-01: CSP `style-src 'unsafe-inline'`
- **Location:** `next.config.ts:65`
- **Risk:** Cho phep inline styles, co the bi loi dung cho CSS injection (data exfiltration via CSS selectors). Tailwind CSS + SSR can dieu nay, nhung van la weakness.
- **Fix:** Khi co the, su dung nonce cho styles. Hien tai chap nhan duoc vi Tailwind CSS can `unsafe-inline`.

### [MEDIUM] M-02: Thieu Cross-Origin headers (COEP, COOP, CORP)
- **Location:** `next.config.ts:34-73`
- **Risk:** Khong co:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - Dieu nay co the cho phep Spectre-type attacks va cross-origin data leakage.
- **Fix:** Them 3 headers vao `next.config.ts headers()`. Luu y: COEP co the break third-party resources (YouTube embeds, Polar checkout). Can test ky.

### [MEDIUM] M-03: Admin Basic Auth qua middleware
- **Location:** `middleware.ts:23-37`
- **Risk:** Basic Auth gui credentials trong moi request (base64, khong encrypted). Tuy HTTPS bao ve trong transit, nhung:
  - Credentials cached trong browser history
  - Khong co session timeout
  - Khong co rate limiting cho login attempts
- **Fix:** Chuyen admin auth sang Supabase RLS/session hoac them rate limiting cho admin routes.

### [MEDIUM] M-04: `img-src https: data: blob:` qua rong
- **Location:** `next.config.ts:65`
- **Risk:** Cho phep load images tu BAT KY domain HTTPS nao. Co the bi loi dung cho tracking pixels hoac data exfiltration via image URLs.
- **Fix:** Thu hep `img-src` chi bao gom cac domains can thiet: `'self' https://*.supabase.co https://v5.airtableusercontent.com data: blob:`

### [LOW] L-01: Thieu `report-uri` / `report-to` trong CSP
- **Location:** `next.config.ts:65`
- **Risk:** Khong biet khi nao CSP bi vi pham. Khong co monitoring cho CSP violations.
- **Fix:** Them `report-uri /api/csp-report;` hoac su dung Report API voi `report-to` directive. Co the su dung Sentry CSP reporting.

### [LOW] L-02: Permissions-Policy chua bao gom het
- **Location:** `next.config.ts:68-69`
- **Current:** `camera=(), microphone=(), geolocation=()`
- **Missing:** `payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=()`
- **Fix:** Mo rong Permissions-Policy bao gom cac APIs khong su dung.

---

## Positive Observations (Diem tot)

### Security Headers da implement tot:
- **HSTS**: `max-age=63072000; includeSubDomains; preload` (2 nam, preload-ready)
- **X-Frame-Options**: `DENY` (chong clickjacking)
- **X-Content-Type-Options**: `nosniff` (chong MIME sniffing)
- **Referrer-Policy**: `origin-when-cross-origin` (can bang privacy/functionality)
- **X-XSS-Protection**: `0` (DUNG - modern best practice, de CSP xu ly)
- **frame-ancestors**: `'none'` (CSP-level clickjacking protection)
- **base-uri**: `'self'` (chong base tag injection)
- **form-action**: `'self'` (chong form hijacking)
- **object-src**: `'none'` (chong Flash/plugin exploits)

### Webhook Security xuat sac:
- **Polar**: Dung `standardwebhooks` + Zod validation + signature verification (double fallback)
- **Telegram**: Secret token verification qua `X-Telegram-Bot-Api-Secret-Token` header

### Secrets Management dung chuan:
- Tat ca API keys truy cap qua `process.env.*` (OPENROUTER_API_KEY, HEYGEN_API_KEY, v.v.)
- `.gitignore` exclude tat ca `.env*` files
- Khong co hardcoded secrets trong source code
- `.env.example` chi chua placeholder values

### XSS Prevention tot:
- Khong su dung `dangerouslySetInnerHTML` trong toan bo codebase
- Khong co `eval()` hoac `Function()` calls
- React 19 auto-escaping

### Public Directory sach:
- Chi chua PWA manifest va SVG icons
- Khong co exposed config files hay sensitive data

---

## Summary

| Severity | So luong |
|----------|----------|
| Critical | 0        |
| High     | 2        |
| Medium   | 4        |
| Low      | 2        |
| **Total**| **8**    |

---

## Recommended Actions (Uu tien)

1. **[HIGH]** Implement nonce-based CSP thay vi `'unsafe-inline'` cho `script-src`
2. **[HIGH]** Them `upgrade-insecure-requests` vao CSP
3. **[MEDIUM]** Them Cross-Origin headers (COEP/COOP/CORP) voi testing ky luong
4. **[MEDIUM]** Thu hep `img-src` chi bao gom domains can thiet
5. **[MEDIUM]** Them rate limiting cho admin auth routes
6. **[LOW]** Them CSP violation reporting (`report-uri` / `report-to`)
7. **[LOW]** Mo rong Permissions-Policy

---

## CSP Hien Tai vs Khuyen Nghi

### Hien tai:
```
default-src 'self';
img-src 'self' https: data: blob:;
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.polar.sh https://api.heygen.com https://api.openai.com https://openrouter.ai https://api.elevenlabs.io https://api.inngest.com;
frame-src 'self' https://www.youtube.com;
worker-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

### Khuyen nghi (nonce-based):
```
default-src 'self';
img-src 'self' https://*.supabase.co https://v5.airtableusercontent.com data: blob:;
script-src 'self' 'nonce-{GENERATED}' 'strict-dynamic';
style-src 'self' 'nonce-{GENERATED}';
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.polar.sh https://api.heygen.com https://api.openai.com https://openrouter.ai https://api.elevenlabs.io https://api.inngest.com;
frame-src 'self' https://www.youtube.com;
worker-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests;
```

**Luu y:** Nonce-based CSP yeu cau middleware generate nonce moi request va inject vao response headers + `<script>` tags. Next.js 16 ho tro nay qua `experimental.serverActions` config.

---

## Security Score

| Front | Diem | Max | Ghi chu |
|-------|------|-----|---------|
| CSP Headers | 6 | 10 | `unsafe-inline` lam giam diem |
| Security Headers | 8 | 10 | Thieu COEP/COOP/CORP |
| Secrets Management | 10 | 10 | Xuat sac |
| Webhook Security | 10 | 10 | Xuat sac |
| XSS Protection | 9 | 10 | Tot nhung CSP yeu |
| CORS Config | 7 | 10 | Khong co explicit CORS config |

**Tong: 50/60 (83%)** - Production Ready, can cai thien CSP

---

## Unresolved Questions

1. Vercel co tu dong them security headers nao khong? Can verify production headers thuc te qua `curl -I https://sophia-ai-factory.vercel.app`
2. Next.js 16 da ho tro nonce-based CSP stable chua, hay van la experimental? Can kiem tra docs moi nhat.
3. COEP `require-corp` co the break YouTube iframes va Polar checkout - can test truoc khi deploy.
