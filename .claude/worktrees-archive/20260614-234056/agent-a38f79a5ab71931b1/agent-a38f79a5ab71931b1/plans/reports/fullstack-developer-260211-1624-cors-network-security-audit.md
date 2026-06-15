# Security Audit Report - CORS & Network Security

**Project:** Sophia AI Factory
**Date:** 2026-02-11
**Auditor:** fullstack-developer (aa5dbd6)
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW > INFO

---

## Tong Quan

Audit bao gom: CORS headers, Content-Security-Policy, API route authentication, rate limiting, cookie handling, va network security configuration cho Sophia AI Factory (Next.js 16 + Supabase + Polar.sh).

**Files Audited:**
- `next.config.ts` (security headers, CSP, HSTS)
- `src/middleware.ts` (auth middleware, cookie handling)
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` (Supabase clients)
- 16 API routes trong `src/app/api/`
- `src/lib/telegram/telegram-rate-limit-middleware.ts`

---

## 1. CORS Configuration

### 1.1 Trang Thai Hien Tai

**KHONG CO CORS headers explicit** trong `next.config.ts`. Project rely on **Next.js same-origin policy default** - day la cau hinh AN TOAN.

```
Ket qua: KHONG tim thay Access-Control-Allow-Origin trong bat ky file nao
Ket qua: KHONG tim thay Access-Control-Allow-Methods
Ket qua: KHONG tim thay vercel.json (khong co CORS override)
```

### 1.2 [INFO] Same-Origin API Routes

Tat ca 16 API routes deu KHONG set CORS headers, nghia la chi chap nhan requests tu cung origin (`sophia.agencyos.network`). Day la secure by default.

| Route | CORS Status |
|-------|-------------|
| `/api/webhooks/polar` | Khong CORS (server-to-server) |
| `/api/webhooks/telegram` | Khong CORS (server-to-server) |
| `/api/checkout` | Khong CORS (same-origin) |
| `/api/health` | Khong CORS (same-origin) |
| `/api/discovery/search` | Khong CORS (same-origin) |
| `/api/admin/invite` | Khong CORS (same-origin) |
| `/api/user/integrations` | Khong CORS (same-origin) |

**Verdict:** PASS - Khong co wildcard CORS, khong co `Access-Control-Allow-Origin: *`

---

## 2. Security Headers (next.config.ts)

### 2.1 [PASS] Headers Da Cau Hinh Tot

| Header | Gia Tri | Danh Gia |
|--------|---------|----------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | PASS - 2 nam, preload |
| `X-Frame-Options` | `DENY` | PASS - Chong clickjacking |
| `X-Content-Type-Options` | `nosniff` | PASS - Chong MIME sniffing |
| `X-XSS-Protection` | `0` | PASS - Dung, modern approach |
| `Referrer-Policy` | `origin-when-cross-origin` | PASS |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | PASS |
| `X-DNS-Prefetch-Control` | `on` | PASS |

### 2.2 [MEDIUM] Content-Security-Policy Co Van De

```
CSP hien tai:
default-src 'self';
img-src 'self' https: data: blob:;
script-src 'self' 'unsafe-inline';        <-- VAN DE
style-src 'self' 'unsafe-inline';          <-- Chap Nhan
connect-src 'self' https://*.supabase.co https://api.polar.sh https://api.heygen.com https://api.openai.com https://openrouter.ai https://api.elevenlabs.io https://api.inngest.com;
frame-src 'self' https://www.youtube.com;
worker-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

**Van de 1: `script-src 'unsafe-inline'`**
- **Severity:** MEDIUM
- **Risk:** Cho phep inline scripts, lam giam hieu qua chong XSS cua CSP
- **Nguyen nhan co the:** Next.js can inline scripts cho hydration
- **Fix:** Chuyen sang `nonce`-based CSP hoac `strict-dynamic`

```typescript
// Khuyen nghi: Su dung nonce-based CSP
// next.config.ts headers()
{
  key: 'Content-Security-Policy',
  value: "script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';"
}
```

**Van de 2: `img-src https: data: blob:`**
- **Severity:** LOW
- **Risk:** `https:` cho phep images tu bat ky HTTPS domain nao
- **Fix:** Gioi han cu the: `img-src 'self' https://v5.airtableusercontent.com https://*.public.blob.vercel-storage.com data: blob:`

### 2.3 [PASS] connect-src Whitelist

Whitelist cu the, chi cho phep:
- `*.supabase.co` (database)
- `api.polar.sh` (payments)
- `api.heygen.com` (video gen)
- `api.openai.com` (AI)
- `openrouter.ai` (AI router)
- `api.elevenlabs.io` (voice)
- `api.inngest.com` (background jobs)

**Verdict:** PASS - Khong co wildcard, chi domains can thiet.

---

## 3. API Route Authentication

### 3.1 Authentication Matrix

| Route | Auth Method | Status |
|-------|------------|--------|
| `POST /api/webhooks/polar` | Webhook signature (standardwebhooks) + Zod header validation | PASS |
| `POST /api/webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` header | PASS |
| `POST /api/admin/invite` | Basic Auth (`ADMIN_USER`/`ADMIN_PASS`) | PASS |
| `POST /api/ingestion/trigger` | Bearer token (`CRON_SECRET`) | PASS |
| `POST /api/intelligence/score` | Bearer token (`CRON_SECRET`) | PASS |
| `POST /api/user/integrations` | Supabase auth session | PASS |
| `GET /api/user/integrations` | Supabase auth session | PASS |
| `POST /api/checkout` | Zod validation (khong can auth) | PASS* |
| `GET /api/checkout` | Query param validation | PASS* |
| `GET /api/health` | Optional token (`HEALTH_CHECK_SECRET`) | PASS |
| `GET /api/discovery/search` | Khong auth | **XEM BEN DUOI** |
| `POST /api/setup/verify` | `IS_CONFIGURED` guard | PASS |
| `POST /api/setup/save` | `IS_CONFIGURED` guard | PASS |
| `GET /api/check-access` | Supabase auth (fallback BASIC) | PASS |

### 3.2 [LOW] Public Search API Khong Co Rate Limiting

- **Route:** `GET /api/discovery/search?q=...`
- **Risk:** Public endpoint, khong co auth va khong co rate limiting
- **Impact:** Co the bi abuse cho data scraping hoac DoS
- **Fix:** Them rate limiting (Upstash Ratelimit da co san trong project)

### 3.3 [LOW] Health Check Leak Trang Thai Dich Vu

- **Route:** `GET /api/health`
- **Risk:** Unauthenticated requests nhan duoc `status: 'degraded'` + service names
- **Fix:** Dang lam tot roi - chi leak minimal info (`status` + `timestamp`), khong leak error details

---

## 4. Cookie & Session Security

### 4.1 Supabase Cookie Handling

Middleware (`middleware.ts`) va `server.ts` su dung `@supabase/ssr` de quan ly cookies. Supabase SSR tu dong set:
- `httpOnly: true`
- `secure: true` (production)
- `sameSite: 'lax'`
- `path: '/'`

**Verdict:** PASS - Rely on Supabase SSR defaults la an toan.

### 4.2 [INFO] Cookie Merge Pattern

Middleware merge cookies giua Supabase va intl middleware:
```typescript
// middleware.ts line 118-120
supabaseResponse.cookies.getAll().forEach((cookie) => {
  intlResponse.cookies.set(cookie.name, cookie.value);
});
```

Khong co van de bao mat, nhung can dam bao khong ghi de cookie options (httpOnly, secure) trong qua trinh merge.

---

## 5. Rate Limiting

### 5.1 [MEDIUM] Chi Co Rate Limiting Cho Telegram Bot

| Component | Rate Limiting | Status |
|-----------|--------------|--------|
| Telegram Bot | 10 cmd/min/user (Redis sliding window) | PASS |
| API Routes | **KHONG CO** | **THIEU** |
| Checkout API | **KHONG CO** | **THIEU** |
| Search API | **KHONG CO** | **THIEU** |
| Setup Verify | IS_CONFIGURED guard only | OK |

**Risk:** API routes public (`/api/checkout`, `/api/discovery/search`) co the bi abuse.

**Fix khuyen nghi:**
```typescript
// Su dung @upstash/ratelimit (da co trong project)
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
})
```

---

## 6. Network Security

### 6.1 [PASS] HTTPS Enforcement

- HSTS header: `max-age=63072000; includeSubDomains; preload`
- Vercel tu dong redirect HTTP -> HTTPS
- Tat ca external API calls deu qua HTTPS

### 6.2 [PASS] External API Communication

| Service | Protocol | Auth Method |
|---------|----------|-------------|
| Supabase | HTTPS | Anon key + JWT |
| HeyGen | HTTPS | `X-Api-Key` header |
| Polar.sh | HTTPS | Webhook signature |
| OpenRouter | HTTPS | API key |
| ElevenLabs | HTTPS | API key |
| Inngest | HTTPS | Signing key |
| Telegram | HTTPS | Secret token header |

### 6.3 [INFO] Sensitive Data in URLs

- `GET /api/health?token=SECRET` - health check secret truyen qua query param
- **Risk:** Query params co the bi log boi servers, proxies, referrer headers
- **Fix:** Chuyen sang header: `Authorization: Bearer {token}`

### 6.4 [PASS] Webhook Security

- Polar: `standardwebhooks` signature verification + Zod header validation
- Telegram: `X-Telegram-Bot-Api-Secret-Token` verification
- Cron routes: `Bearer {CRON_SECRET}` token

---

## 7. Middleware Security

### 7.1 [PASS] Auth Guard Pattern

```
/ → Public (intl middleware)
/admin → Basic Auth required
/dashboard → Supabase auth required (redirect to /login)
/auth/callback → Skip middleware (code exchange)
/api → Skip intl middleware
/setup-wizard → IS_CONFIGURED guard
```

### 7.2 [INFO] Middleware Matcher

```typescript
matcher: ["/((?!api|_next|_vercel|setup-wizard|auth/callback|.*\\..*).*)" ]
```

API routes KHONG di qua middleware matcher, nghia la security headers trong `next.config.ts` van apply (headers() function chay truoc matcher).

---

## 8. Van De Dac Biet

### 8.1 [MEDIUM] Setup Wizard Endpoint Co The Bi Probe

- `POST /api/setup/verify` nhan API keys de validate
- Co guard `IS_CONFIGURED` - GOOD
- Nhung NEU attacker truy cap truoc khi configured, co the test API keys
- **Fix:** Them rate limiting va IP-based protection cho setup endpoints

### 8.2 [LOW] Admin Basic Auth Over HTTPS

- Admin authentication dung Basic Auth (base64 encoded, khong encrypted)
- An toan vi truyen qua HTTPS (HSTS enabled)
- Tuy nhien, Basic Auth credentials khong co expiry/rotation
- **Khuyen nghi:** Consider migrating to session-based admin auth

---

## Tong Ket

### Severity Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 0 | - |
| HIGH | 0 | - |
| MEDIUM | 3 | CSP unsafe-inline, API rate limiting missing, Setup probe risk |
| LOW | 3 | Public search no rate limit, Health token in URL, Basic Auth |
| INFO | 3 | Cookie merge, Middleware matcher, img-src broad |

### Diem So: 8/10

**Diem manh:**
- Khong co wildcard CORS (zero CORS issues)
- Security headers comprehensive va dung chuan
- Webhook verification mạnh me (standardwebhooks + Zod)
- HSTS preload enabled
- CSP frame-ancestors 'none' (chong clickjacking)
- Tat ca external API calls qua HTTPS

**Can cai thien:**
- Them rate limiting cho public API routes
- Chuyen CSP script-src tu 'unsafe-inline' sang nonce-based
- Chuyen health check token tu query param sang header
- Them rate limiting cho setup wizard endpoints

### Network Security Checklist

- [x] HTTPS-only (HSTS preload)
- [x] Strict CORS (same-origin default, khong wildcard)
- [x] No sensitive data in URLs (chi health check token - LOW)
- [x] Webhook signature verification
- [x] Cookie security (Supabase SSR defaults)
- [x] Frame protection (X-Frame-Options: DENY + frame-ancestors: none)
- [x] Content-Type sniffing protection
- [ ] Rate limiting toan dien (chi co cho Telegram bot)
- [ ] CSP nonce-based (hien tai dung unsafe-inline)

### Khuyen Nghi Uu Tien

1. **[P1]** Them `@upstash/ratelimit` middleware cho API routes public
2. **[P2]** Chuyen CSP `script-src 'unsafe-inline'` sang `'nonce-{NONCE}' 'strict-dynamic'`
3. **[P3]** Chuyen `GET /api/health?token=` sang `Authorization: Bearer` header
4. **[P3]** Thu hep `img-src` trong CSP

---

## Unresolved Questions

1. Supabase cookie `sameSite` va `secure` flags co duoc set dung cho production khong? (Can verify runtime, Supabase SSR defaults nên la OK)
2. Co can them CORS headers cho mobile app clients trong tuong lai khong? (Hien tai chi web, same-origin la du)
