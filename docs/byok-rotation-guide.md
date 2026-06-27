# BYOK Key Rotation Guide — Sophia AI Factory

> Hướng dẫn vận hành và kỹ thuật cho việc xoay vòng API keys của khách hàng (Bring Your Own Key).

**Phiên bản:** 1.0  
**Cập nhật lần cuối:** 2026-06-20  
**Trạng thái:** Production Ready (Staging Test Pending)

---

## 1. Tổng quan

BYOK (Bring Your Own Key) cho phép khách hàng tự mang API keys của các nhà cung cấp AI (OpenRouter, ElevenLabs, HeyGen, etc.) thay vì platform phải trả phí. Để bảo mật, các keys này được mã hóa AES-GCM và lưu trữ trong D1.

**Key Rotation** là quy trình định kỳ xoay vòng các keys đã mã hóa để:
- Giảm rủi ro nếu key bị leak
- Tuân thủ chính sách bảo mật enterprise
- Cho phép customers cập nhật/revoke keys của họ

---

## 2. Kiến trúc

### 2.1. Lưu trữ BYOK keys

```
Bảng: user_api_keys
├── user_id (TEXT, FK to users.id)
├── provider (TEXT) — "openrouter", "elevenlabs", "heygen", etc.
├── encrypted_key (TEXT) — AES-GCM encrypted
├── key_version (INTEGER) — phiên bản key, dùng cho rotation
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

**Master Key:** `BYOK_MASTER_KEY` (base64, 32 bytes) — dùng cho AES-GCM encryption/decryption.

### 2.2. Quy trình Rotation

1. **Admin khởi động rotation** qua `/api/admin/byok-rotation` (2-of-3 deploy guard approval)
2. **Tạo phiên bản mới** — increment `key_version` toàn bộ organization
3. **Re-encrypt background job** — chạy async, xử lý từng user
4. **Customers có thể rotate** — thông qua `/dashboard/byok` UI

---

## 3. API Endpoints

### 3.1. Admin API (CRON_SECRET protected)

#### `POST /api/admin/byok-rotation`

**Mục đích:** Khởi động quy trình rotation toàn hệ thống.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "start_rotation",
  "target_org_id": "org_xxx" // optional — nếu empty, áp dụng tất cả orgs
}
```

**Response (200):**
```json
{
  "success": true,
  "job_id": "rotation_job_12345",
  "affected_users": 150,
  "started_at": "2026-06-20T10:30:00Z"
}
```

**Response (409):** Nếu rotation đang chạy
```json
{
  "error": "RotationAlreadyInProgress",
  "current_job_id": "rotation_job_12345"
}
```

---

### 3.2. User API (Auth protected)

#### `GET /api/user/byok`

Lấy danh sách providers đã configure.

**Response:**
```json
{
  "providers": [
    {
      "provider": "openrouter",
      "key_set": true,
      "key_version": 3,
      "last_rotated": "2026-06-15T08:00:00Z"
    }
  ]
}
```

#### `POST /api/user/byok`

Set hoặc rotate key cho một provider.

**Request Body:**
```json
{
  "provider": "openrouter",
  "api_key": "sk-or-xxx..." // plaintext, sẽ được mã hóa trước khi lưu
}
```

**Response:**
```json
{
  "success": true,
  "provider": "openrouter",
  "key_version": 4,
  "rotated_at": "2026-06-20T10:35:00Z"
}
```

#### `DELETE /api/user/byok?provider=openrouter`

Xóa key của provider.

**Response:**
```json
{
  "success": true,
  "provider": "openrouter",
  "deleted_at": "2026-06-20T10:40:00Z"
}
```

---

## 4. Background Job: Re-encrypt Keys

### 4.1. Job Design

**Job Type:** `byok_reencrypt_batch`

**Batch Size:** 50 users per batch (để tránh memory overflow)

**Retry Policy:** Exponential backoff, max 5 attempts

**Idempotency:** Job có thể chạy lại an toàn — kiểm tra `key_version` trước khi re-encrypt.

### 4.2. Flow

```typescript
// Pseudocode
for each user in users_to_rotate:
  old_key = get_encrypted_key(user.id, old_version)
  plaintext = decrypt(old_key, BYOK_MASTER_KEY)

  new_key = encrypt(plaintext, BYOK_MASTER_KEY)
  save_key(user.id, new_key, new_version)

  emit signal BYOK_KEY_ROTATED(user.id, provider)
```

**Signals:**
- `BYOK_ROTATION_STARTED`
- `BYOK_KEY_ROTATED`
- `BYOK_ROTATION_COMPLETED`
- `BYOK_ROTATION_FAILED`

---

## 5. Deployment Checklist

### Pre-rotation

- [ ] Backup D1 database: `npx wrangler d1 export sophia-raas-db --output backup.json`
- [ ] Verify `BYOK_MASTER_KEY` set in production: `wrangler secret get BYOK_MASTER_KEY`
- [ ] Set `BYOK_ROTATION_ENABLED=1` (feature flag)
- [ ] Staging test complete (see below)

### Rotation Execution

- [ ] Start rotation via admin API or cron
- [ ] Monitor job progress: `SELECT * FROM byok_rotation_jobs WHERE status='running'`
- [ ] Check logs: `npx wrangler tail --name sophia-ai-factory`
- [ ] Verify signals in D1 `signals` table

### Post-rotation

- [ ] All users rotated? Count: `SELECT COUNT(*) FROM user_api_keys WHERE key_version = NEW_VERSION`
- [ ] Old versions cleaned? (tùy chọn, giữ lại 1 version backup)
- [ ] Test với real user: login, generate video — phải hoạt động
- [ ] Rollback plan sẵn sàng: restore backup + `BYOK_MASTER_KEY` cũ

---

## 6. Staging Test Plan

### Test 1: Single User Rotation

```bash
# 1. Tạo test user và set key
curl -X POST https://staging.sophia.agencyos.network/api/user/byok \
  -H "Authorization: Bearer <user_token>" \
  -d '{"provider":"openrouter","api_key":"sk-test-xxx"}'

# 2. Admin trigger rotation cho user này
curl -X POST https://staging.sophia.agencyos.network/api/admin/byok-rotation \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -d '{"action":"start_rotation","target_org_id":"test_org"}'

# 3. Verify key_version tăng
curl https://staging.sophia.agencyos.network/api/user/byok \
  -H "Authorization: Bearer <user_token>"
```

**Expected:** `key_version` tăng lên 1, video generation vẫn hoạt động.

---

### Test 2: Bulk Rotation (100 users)

- [ ] Job xử lý đủ 100 users
- [ ] Không có duplicate key_version
- [ ] Error handling: 5 users fails → retry 3 lần → mark failed, continue

---

### Test 3: Rollback

- [ ] Restore backup D1
- [ ] Reset `BYOK_MASTER_KEY` về cũ
- [ ] Verify users vẫn decrypt được keys cũ

---

## 7. Monitoring & Alerts

### 7.1. Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Rotation job duration | < 2h for 10k users | > 4h |
| Rotation failure rate | < 1% | > 5% |
| Decryption error rate post-rotation | 0% | > 0.1% |

### 7.2. Honeycomb Queries

```
# Rotation job duration
AVG(duration_ms) WHERE span.name = "byok_reencrypt_batch"

# Key lookup errors
COUNT(where: error = true) WHERE span.name LIKE "resolveUserApiKey%"
```

---

## 8. Troubleshooting

### Issue: Rotation job hangs

**Symptoms:** Job status = "running" nhưng không có log mới.

**Debug:**
1. Check Inngest dashboard: `https://ui.inngest.com/...`
2. Throttle batch size xuống 10
3. Restart job với `job_id` mới

---

### Issue: Keys fail to decrypt after rotation

**Symptoms:** Users unable to generate videos, error "Failed to decrypt API key".

**Debug:**
1. Check `BYOK_MASTER_KEY` có đúng không
2. Verify key_version đã được update đúng
3. Manual decrypt test:
```bash
curl -X POST https://api/debug/decrypt-test \
  -H "Authorization: Bearer <admin>"
```

**Fix:** Rollback to backup + `BYOK_MASTER_KEY` cũ.

---

### Issue: Duplicate key_version

**Symptoms:** Một user có 2 keys với cùng `key_version`.

**Cause:** Race condition khi user rotate key trong lúc batch job chạy.

**Fix:** Idempotent job design — job phải skip nếu `current_version >= target_version`.

---

## 9. Security Considerations

- **BYOK_MASTER_KEY** phải là 32-byte base64, stored as CF Worker secret
- Rotation cron access phải có 2-of-3 deploy guard approval
- Tất cả API calls đến `/api/admin/byok-rotation` phải qua `CRON_SECRET`
- Không log plaintext keys — redact trong logger
- Audit trail: tất cả rotation events phải có `admin_user_id` (nếu từ admin UI)

---

## 10. Rollback Procedure

Nếu rotation gây lỗi production-wide:

```bash
# 1. Dừng rotation job (Inngest UI hoặc database)
UPDATE byok_rotation_jobs SET status='cancelled' WHERE job_id='xxx';

# 2. Restore D1 backup
npx wrangler d1 restore sophia-raas-db --from backup.json --remote

# 3. Reset BYOK_MASTER_KEY về cũ
wrangler secret put BYOK_MASTER_KEY --value "<old_base64_key>"

# 4. Verify
curl https://sophia.agencyos.network/api/health
```

---

## 11. Reference

### 11.1. Code Locations

| Component | Path |
|-----------|------|
| Admin API | `apps/sophia-ai-factory/src/app/api/admin/byok-rotation/route.ts` |
| User API | `apps/sophia-ai-factory/src/app/api/user/byok/route.ts` |
| Crypto utils | `apps/sophia-ai-factory/src/lib/byok/byok-crypto.ts` |
| DB schema | `apps/sophia-ai-factory/migrations/0011-user-api-keys.sql` |
| Signals | `apps/sophia-ai-factory/src/lib/signals/byok-events.ts` |

### 11.2. Database Schema

```sql
-- user_api_keys table
CREATE TABLE user_api_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, provider)
);

-- byok_rotation_jobs table
CREATE TABLE byok_rotation_jobs (
  job_id TEXT PRIMARY KEY,
  target_version INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'cancelled'
  total_users INTEGER,
  processed_users INTEGER DEFAULT 0,
  failed_users INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);
```

---

**Next:** SOC2 Compliance Guide (docs/soc2-compliance.md) đang được soạn thảo.
