# Security Audit: .env.example Completeness + Hardcoded Secrets

**Agent:** code-reviewer | **Date:** 2026-02-11 | **Project:** Sophia AI Factory

---

## Code Review Summary

### Scope
- Files reviewed: 4 `.env*` files, `verify-env.js`, `environment-config.ts`, `defaults.ts`, `flags.ts`, `next.config.ts`, 14 scripts, ~80 source files via grep
- Review focus: Environment variable completeness, hardcoded secrets scan
- CWD: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory`
- Source: `apps/sophia-ai-factory/src/`

### Overall Assessment
**CRITICAL** -- Root `.env.example` hoan toan loi thoi (PayPal/Stripe/Gumroad). Inner `.env.example` tot hon nhung van thieu nhieu env vars. Khong tim thay hardcoded secrets that su trong production code, nhung co dummy fallback tokens co the an loi cau hinh.

---

## TASK 1: .ENV.EXAMPLE COMPLETENESS

### 1.1 ROOT `.env.example` -- CRITICAL: HOAC TOAN LOI THOI

**File:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/.env.example`

**Env vars TRONG file nhung KHONG CON DUNG trong code:**

| Env Var | Dong | Ly do |
|---------|------|-------|
| `PAYPAL_CLIENT_ID` | 2 | Project dung Polar.sh, khong PayPal |
| `PAYPAL_CLIENT_SECRET` | 3 | Khong con dung |
| `PAYPAL_MODE` | 4 | Khong con dung |
| `PAYPAL_WEBHOOK_ID` | 5 | Khong con dung |
| `STRIPE_SECRET_KEY` | 7 | Khong con dung |
| `STRIPE_PUBLISHABLE_KEY` | 8 | Khong con dung |
| `STRIPE_WEBHOOK_SECRET` | 9 | Khong con dung |
| `GUMROAD_ACCESS_TOKEN` | 11 | Khong con dung |
| `API_BASE_URL` | 14 | Khong reference trong src/ |
| `FRONTEND_URL` | 15 | Project dung NEXT_PUBLIC_APP_URL |
| `DATABASE_URL` | 18 | Project dung Supabase URL |
| `SMTP_HOST` | 21 | Khong reference trong src/ |
| `SMTP_PORT` | 22 | Khong reference trong src/ |
| `SMTP_USER` | 23 | Khong reference trong src/ |
| `SMTP_PASS` | 24 | Khong reference trong src/ |
| `LICENSE_SECRET_KEY` | 27 | Khong reference trong src/ |
| `PYTHON_ENV` | 31 | Khong reference trong src/ |

**Ket luan:** 17/18 bien trong root `.env.example` KHONG CON DUNG. Chi con `NODE_ENV`.

### 1.2 INNER `.env.example` -- THIEU NHIEU VARS

**File:** `apps/sophia-ai-factory/.env.example`

**Env vars DUNG trong code nhung THIEU trong inner `.env.example`:**

| Env Var | File su dung | Muc do |
|---------|-------------|--------|
| `OPENROUTER_API_KEY` | `script-generator.ts:26`, `affiliate-openrouter-niche-enhancer.ts:24` | **HIGH** - Core AI service |
| `ELEVENLABS_API_KEY` | `text-to-speech-generator-elevenlabs.ts:33` | **HIGH** - Core AI service |
| `ELEVENLABS_VOICE_ID` | `text-to-speech-generator-elevenlabs.ts:133` | LOW - co default |
| `API_ENCRYPTION_KEY` | `encryption.ts:6` | **CRITICAL** - Can cho encrypt API keys |
| `ADMIN_USER` | `middleware.ts:30`, `admin/invite/route.ts:19` | **HIGH** - Auth |
| `ADMIN_PASS` | `middleware.ts:31`, `admin/invite/route.ts:20` | **HIGH** - Auth |
| `AIRTABLE_API_KEY` | `airtable.ts:12` | MEDIUM |
| `AIRTABLE_BASE_ID` | `airtable.ts:13` | MEDIUM |
| `N8N_WEBHOOK_GENERATE_SCRIPT` | `automation.ts:36` | MEDIUM |
| `N8N_WEBHOOK_RENDER_VIDEO` | `automation.ts:75` | MEDIUM |
| `SHAREASALE_API_TOKEN` | `shareasale-adapter.ts:19` | LOW |
| `SHAREASALE_API_SECRET` | `shareasale-adapter.ts:20` | LOW |
| `SHAREASALE_AFFILIATE_ID` | `shareasale-adapter.ts:21` | LOW |
| `HEALTH_CHECK_SECRET` | `health/route.ts:12` | MEDIUM |
| `CRON_SECRET` | `ingestion/trigger/route.ts:9`, `intelligence/score/route.ts:9` | **HIGH** - API auth |
| `TIKTOK_API_KEY` | `tiktok-channel-adapter.ts:18` | LOW - optional |
| `YOUTUBE_API_KEY` | `youtube-channel-adapter.ts:18` | LOW - optional |
| `NEXT_PUBLIC_IS_CONFIGURED` | `middleware.ts:41`, `setup routes` | MEDIUM |
| `IS_CONFIGURED` | `middleware.ts:42`, `setup routes` | MEDIUM |
| `TELEGRAM_ADMIN_CHAT_ID` | `auto-discover-affiliates.ts:158`, `telegram-notification-adapter.ts:57` | MEDIUM |
| `POLAR_PRODUCT_ID_MASTER` | `tiers.ts:78` | **HIGH** - Missing tier |
| `POLAR_PRODUCT_ID_STARTER_MONTHLY` | `environment-config.ts:32` | MEDIUM |
| `POLAR_PRODUCT_ID_GROWTH_MONTHLY` | `environment-config.ts:33` | MEDIUM |
| `POLAR_PRODUCT_ID_PREMIUM_MONTHLY` | `environment-config.ts:34` | MEDIUM |
| `NEXT_PUBLIC_ADMIN_USER` | `admin/settings/page.tsx:70` | LOW |
| `POLAR_ORGANIZATION_ID` | `polar-client.ts:66` | MEDIUM - co trong `.env.example` nhung thieu trong verify-env.js |

### 1.3 INNER `.env.local.example` -- INCONSISTENCIES

**File:** `apps/sophia-ai-factory/.env.local.example`

| Van de | Dong | Chi tiet |
|--------|------|----------|
| `OPENAI_API_KEY` (dong 33) | SAI | Code dung `OPENROUTER_API_KEY`, khong `OPENAI_API_KEY` |
| `NEXT_PUBLIC_POLAR_PRODUCT_STARTER` (dong 21) | SAI | Code dung `POLAR_PRODUCT_ID_STARTER` |
| `NEXT_PUBLIC_POLAR_PRODUCT_GROWTH` (dong 22) | SAI | Code dung `POLAR_PRODUCT_ID_GROWTH` |
| `NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM` (dong 23) | SAI | Code dung `POLAR_PRODUCT_ID_PREMIUM` |
| Thieu `POLAR_PRODUCT_ID_MASTER` | -- | Master tier khong co product ID |
| Thieu `TELEGRAM_WEBHOOK_SECRET` | -- | Can cho webhook security |
| Thieu `UPSTASH_REDIS_*` | -- | Can cho session management |

### 1.4 `verify-env.js` -- LECH VOI CODE

**File:** `apps/sophia-ai-factory/verify-env.js`

Required vars trong verify-env.js:
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET
```

Optional vars trong verify-env.js:
```
OPENROUTER_API_KEY, ELEVENLABS_API_KEY, HEYGEN_API_KEY,
TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_APP_URL,
POLAR_PRODUCT_BASIC_ID, POLAR_PRODUCT_PREMIUM_ID, POLAR_PRODUCT_ENTERPRISE_ID
```

**Van de:**
- `POLAR_PRODUCT_BASIC_ID` -- Code dung `POLAR_PRODUCT_ID_STARTER`, khong `BASIC`
- `POLAR_PRODUCT_PREMIUM_ID` -- Code dung `POLAR_PRODUCT_ID_PREMIUM`
- `POLAR_PRODUCT_ENTERPRISE_ID` -- Tier khong con la ENTERPRISE, la MASTER
- Thieu: `API_ENCRYPTION_KEY`, `ADMIN_USER`, `ADMIN_PASS`, `CRON_SECRET`, `UPSTASH_REDIS_*`, `INNGEST_*`, `HEALTH_CHECK_SECRET`

---

## TASK 2: HARDCODED SECRETS SCAN

### 2.1 KET QUA: Khong co hardcoded secrets thuc su

**KHONG TIM THAY:**
- Khong co `sk_live_*`, `sk_test_*`, `pk_live_*`, `pk_test_*`
- Khong co base64-encoded JWT tokens (eyJ...)
- Khong co Bearer tokens hardcoded
- Khong co passwords/API keys plaintext

### 2.2 DUMMY FALLBACK TOKENS -- MEDIUM RISK

| File | Dong | Gia tri | Rui ro |
|------|------|---------|--------|
| `src/lib/redis.ts` | 13-14 | `'https://dummy-url.upstash.io'`, `'dummy_token'` | MEDIUM - An missing config in prod |
| `src/lib/clients/upstash-redis-client.ts` | 16-17 | `'https://dummy-url.upstash.io'`, `'dummy_token'` | MEDIUM - Duplicate dummy fallback |
| `src/lib/telegram/telegram-bot-instance.ts` | 3 | `'dummy_token_for_build'` | MEDIUM - Cho phep build khong co token |

**Van de:** Dummy fallback token lam build PASS nhung runtime se FAIL silently hoac throw error khong ro rang. Production co the chay voi dummy values ma khong ai biet.

**Khuyen nghi:** Thay fallback bang `throw new Error('Missing UPSTASH_REDIS_REST_URL')` trong production, chi dung dummy trong test/dev.

### 2.3 HARDCODED DEFAULT VALUES -- LOW RISK

| File | Dong | Gia tri | Ghi chu |
|------|------|---------|---------|
| `src/config/defaults.ts` | 3 | `"21m00Tcm4TlvDq8ikWAM"` | ElevenLabs public voice ID (Rachel) - Khong phai secret |
| `src/config/defaults.ts` | 20 | `"https://airtable.com/appDUMMY/shrDUMMY"` | Placeholder URL - Can thay the |
| `src/config/defaults.ts` | 21 | `"https://n8n.io/workflows/dummy"` | Placeholder URL - Can thay the |
| `src/app/[locale]/(admin)/admin/settings/page.tsx` | 70 | `"admin"` default username | LOW - Default username expose trong client code |

### 2.4 TEST FILES -- ACCEPTABLE

| File | Dong | Gia tri |
|------|------|---------|
| `src/utils/encryption.test.ts` | 15, 42 | `'sk-1234567890abcdef'` -- Test data, khong phai real key |

### 2.5 SCRIPTS -- CLEAN

Tat ca scripts deu doc env vars tu `process.env`, khong hardcode secrets.

---

## TONG KET SEVERITY

### Critical Issues
1. **Root `.env.example` HOAN TOAN LOI THOI** -- Tham chieu PayPal/Stripe/Gumroad nhung project dung Polar.sh/Supabase/OpenRouter
2. **`API_ENCRYPTION_KEY` thieu trong moi `.env.example`** -- Bien nay can thiet de encrypt API keys, thieu se crash runtime
3. **`CRON_SECRET` thieu trong moi `.env.example`** -- 2 API routes (`/api/ingestion/trigger`, `/api/intelligence/score`) se bi unauthorized ma khong biet tai sao

### High Priority
4. **`verify-env.js` dung WRONG env var names** -- `POLAR_PRODUCT_BASIC_ID` thay vi `POLAR_PRODUCT_ID_STARTER`
5. **`.env.local.example` dung `OPENAI_API_KEY`** thay vi `OPENROUTER_API_KEY`
6. **`.env.local.example` dung `NEXT_PUBLIC_POLAR_PRODUCT_*`** thay vi `POLAR_PRODUCT_ID_*`
7. **`ADMIN_USER`/`ADMIN_PASS` thieu** -- Admin invite endpoint va middleware auth se fail
8. **`POLAR_PRODUCT_ID_MASTER` thieu trong moi example** -- Master tier se khong co product ID

### Medium Priority
9. **Dummy Redis tokens** co the an loi cau hinh trong production
10. **`UPSTASH_REDIS_*` thieu trong `.env.local.example`** -- Session management se dung dummy fallback
11. **Nhieu `.env.example` files** confusing (root, inner, .local.example, .production.example) -- Can consolidate

### Positive Observations
- `environment-config.ts` su dung Zod validation -- Cach lam dung
- `next.config.ts` co day du security headers (HSTS, CSP, X-Frame-Options, etc.)
- Khong co actual hardcoded secrets trong production code
- Scripts deu dung `process.env` dung cach

---

## RECOMMENDED ACTIONS (uu tien)

1. **[CRITICAL] Xoa hoac viet lai root `.env.example`** -- Thay the toan bo PayPal/Stripe/Gumroad bang Polar/Supabase/OpenRouter
2. **[CRITICAL] Them `API_ENCRYPTION_KEY` va `CRON_SECRET`** vao tat ca `.env.example` files
3. **[HIGH] Fix `verify-env.js`** -- Doi `POLAR_PRODUCT_BASIC_ID` -> `POLAR_PRODUCT_ID_STARTER`, etc.
4. **[HIGH] Fix `.env.local.example`** -- Doi `OPENAI_API_KEY` -> `OPENROUTER_API_KEY`, fix Polar product ID names
5. **[HIGH] Them `ADMIN_USER`/`ADMIN_PASS`** vao required vars trong verify-env.js
6. **[MEDIUM] Thay dummy fallback** bang throw Error trong production mode cho Redis va Telegram
7. **[MEDIUM] Consolidate** thanh 1 `.env.example` duy nhat voi comments ro rang

---

## UNRESOLVED QUESTIONS

1. `IS_CONFIGURED` va `NEXT_PUBLIC_IS_CONFIGURED` -- Co can document trong `.env.example`? Hien tai chi duoc set runtime boi setup wizard.
2. `VERCEL` env var -- Vercel tu dong set, co can document?
3. `DID_API_KEY` -- Co trong setup wizard nhung khong trong environment-config.ts. Con dung khong?
4. Project co 2 Redis client files (`redis.ts` va `upstash-redis-client.ts`) -- Can consolidate?
