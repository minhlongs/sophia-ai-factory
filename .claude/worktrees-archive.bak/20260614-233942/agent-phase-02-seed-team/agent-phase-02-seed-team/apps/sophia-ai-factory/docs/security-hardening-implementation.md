# Security Hardening Implementation

## Tổng quan

Đã thực hiện hardening bảo mật cho Sophia AI Factory với 5 file quan trọng:

1. **CSP Configuration** - Content Security Policy chặt chẽ
2. **CORS Configuration** - Giới hạn origins được phép
3. **Rate Limiting** - Chống abuse và DDoS
4. **Input Sanitization** - Chống XSS và injection attacks
5. **Webhook Verification** - Verify signatures (đã có sẵn, cải thiện)

## File đã tạo/sửa

### 1. CSP Configuration
**File:** `src/lib/security/content-security-policy-configuration.ts`

**Mục đích:** Cấu hình Content Security Policy để chống XSS attacks

**Tính năng:**
- Script sources: self only (unsafe-inline chỉ dev mode)
- Style sources: self + unsafe-inline (Tailwind CSS yêu cầu)
- API connections: chỉ các domains được phê duyệt
- Frame ancestors: none (chống clickjacking)
- Object/embed: none (chống malicious embeds)

**Sử dụng:**
```typescript
import { buildCSPHeader } from '@/lib/security/content-security-policy-configuration';
// Đã tích hợp vào next.config.ts
```

### 2. CORS Configuration
**File:** `src/lib/security/cors-security-configuration.ts`

**Mục đích:** Giới hạn cross-origin requests

**Allowed Origins:**
- Production: `https://sophia-ai-factory.vercel.app`, `https://sophia.agencyos.network`
- Development: `http://localhost:3000`, `http://localhost:3001`

**Sử dụng:**
```typescript
import { applyCorsHeaders, handleCorsPrelight } from '@/lib/security/cors-security-configuration';

// Trong middleware hoặc API route
if (request.method === 'OPTIONS') {
  return handleCorsPrelight(origin);
}

const response = NextResponse.json({ data });
return applyCorsHeaders(response, origin);
```

### 3. Rate Limiting
**File:** `src/lib/security/rate-limiting-middleware.ts`

**Mục đích:** Prevent abuse và DDoS attacks bằng Upstash Redis

**Limits:**
- API routes: 100 req/min
- Webhooks: 1000 req/min
- Auth routes: 10 req/min (chống brute force)
- Admin routes: 50 req/min

**Sử dụng:**
```typescript
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rate-limiting-middleware';

const identifier = getClientIdentifier(request, userId);
const result = await checkRateLimit(identifier, RATE_LIMITS.api);

if (!result.success) {
  return new NextResponse('Too many requests', { status: 429 });
}
```

**Response Headers:**
- `X-RateLimit-Limit`: Tổng số requests cho phép
- `X-RateLimit-Remaining`: Số requests còn lại
- `X-RateLimit-Reset`: Timestamp khi reset
- `Retry-After`: Số giây cần đợi

### 4. Input Sanitization
**File:** `src/lib/security/input-sanitization-utilities.ts`

**Mục đích:** Sanitize user input để chống XSS và injection

**Functions:**
- `sanitizeHtml()`: Remove script tags, event handlers, javascript: protocol
- `escapeHtml()`: Escape HTML special characters
- `sanitizeSql()`: Remove SQL comment markers (extra layer)
- `sanitizeEmail()`: Validate và normalize email
- `sanitizeUrl()`: Validate URL (chỉ http/https)
- `sanitizeFilename()`: Prevent path traversal
- `stripHtmlTags()`: Remove all HTML tags
- `sanitizePhoneNumber()`: Validate phone numbers

**Sử dụng:**
```typescript
import { sanitizeHtml, escapeHtml, sanitizeEmail } from '@/lib/security/input-sanitization-utilities';

const cleanInput = sanitizeHtml(userInput);
const displayText = escapeHtml(userComment);
const validEmail = sanitizeEmail(emailInput);
```

### 5. Webhook Signature Verification
**File:** `src/lib/security/webhook-signature-verification.ts`

**Mục đích:** Verify webhook signatures để ensure authenticity

**Functions:**
- `verifyNowpaymentsWebhookSignature()`: NOWPayments IPN webhooks (HMAC-SHA512)
- `verifyTelegramWebhookSignature()`: Telegram webhooks
- `verifyHmacSignature()`: Generic HMAC verification
- `verifyWebhookTimestamp()`: Prevent replay attacks
- `generateHmacSignature()`: Tạo signatures cho outgoing webhooks

**Sử dụng:**
```typescript
import { verifyNowpaymentsWebhookSignature, verifyWebhookTimestamp } from '@/lib/security/webhook-signature-verification';

const signature = request.headers.get('x-nowpayments-sig');
const rawBody = await request.text();
const isValid = await verifyNowpaymentsWebhookSignature(rawBody, signature, IPN_SECRET);
const isRecent = verifyWebhookTimestamp(timestamp, 300); // 5 minutes max age

if (!isValid || !isRecent) {
  return new NextResponse('Invalid signature', { status: 401 });
}
```

## Thay đổi trong các file hiện có

### next.config.ts
- Import CSP configuration
- Sử dụng `buildCSPHeader()` thay vì hardcoded string
- Security headers vẫn giữ nguyên (HSTS, X-Frame-Options, etc.)

### src/middleware.ts
- Import CORS và rate limiting utilities
- Handle CORS preflight (OPTIONS requests)
- Apply rate limiting cho tất cả API routes
- Apply CORS headers cho mọi responses
- Stricter limits cho auth/admin routes
- Higher limits cho webhooks

### src/app/api/webhooks/polar/route.ts
- Fix TypeScript error (`err` → `firstError`)
- Signature verification đã có sẵn (sử dụng standardwebhooks)

## Environment Variables cần thiết

Các env vars sau đã được validate trong `src/lib/config/environment-config.ts`:

```bash
# Redis (cho rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Webhook secrets
POLAR_WEBHOOK_SECRET=whsec_...
TELEGRAM_WEBHOOK_SECRET=...

# Admin credentials
ADMIN_USER=admin
ADMIN_PASS=...
```

## Testing

### 1. CSP Headers
```bash
curl -I https://sophia-ai-factory.vercel.app
# Check for Content-Security-Policy header
```

### 2. CORS
```bash
# Allowed origin
curl -H "Origin: https://sophia.agencyos.network" https://sophia-ai-factory.vercel.app/api/health

# Blocked origin
curl -H "Origin: https://malicious.com" https://sophia-ai-factory.vercel.app/api/health
```

### 3. Rate Limiting
```bash
# Send 101 requests trong 1 phút
for i in {1..101}; do
  curl https://sophia-ai-factory.vercel.app/api/health
done
# Request thứ 101 sẽ return 429 Too Many Requests
```

### 4. Input Sanitization
```typescript
// Test XSS prevention
const maliciousInput = '<script>alert("XSS")</script>';
const safe = sanitizeHtml(maliciousInput); // Returns empty string
```

### 5. Webhook Verification
```bash
# Invalid signature sẽ bị reject
curl -X POST https://sophia-ai-factory.vercel.app/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -d '{"event": "subscription.created"}'
# Returns 400 Invalid signature
```

## Security Best Practices đã áp dụng

✅ **Content Security Policy** - Chặt chẽ, chỉ cho phép trusted sources
✅ **CORS** - Giới hạn origins, credentials required
✅ **Rate Limiting** - Prevent brute force và DDoS
✅ **Input Sanitization** - Prevent XSS và injection
✅ **Webhook Verification** - HMAC signatures + timestamp checks
✅ **Environment Variables** - Không hardcode secrets
✅ **HTTPS Enforcement** - HSTS header với preload
✅ **Clickjacking Protection** - X-Frame-Options: DENY
✅ **MIME Sniffing Prevention** - X-Content-Type-Options: nosniff

## Lưu ý quan trọng

1. **Rate limiting yêu cầu Upstash Redis** - Đảm bảo env vars đã set
2. **CORS chỉ allow production domains** - Thêm domain mới vào `ALLOWED_ORIGINS`
3. **CSP có thể block third-party scripts** - Kiểm tra kỹ nếu thêm external services
4. **Webhook signatures phải verify** - Reject mọi requests không có valid signature
5. **Development mode** - Một số rules được relax (e.g., unsafe-inline scripts)

## Next Steps (Tùy chọn)

- [ ] Thêm CSRF protection cho forms
- [ ] Implement API key rotation
- [ ] Add security headers audit tool
- [ ] Setup automated security scanning (Snyk, etc.)
- [ ] Implement WAF rules (Cloudflare/Vercel)
- [ ] Add IP whitelist cho admin routes
- [ ] Setup honeypot endpoints để detect scanners

## Báo cáo

**Tổng số file tạo mới:** 5
**Tổng số file sửa:** 2
**TypeScript errors fix:** 2
**Build status:** ✅ Compilable (các lỗi còn lại không liên quan đến security)

---

**Created:** 2026-02-12
**Author:** Fullstack Developer Agent
**Version:** 1.0.0
