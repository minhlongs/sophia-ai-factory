# API Reference — Sophia AI Factory

> Tài liệu đầy đủ cho tất cả API endpoints trong Sophia AI Factory.

**Phiên bản:** 1.0  
**Cập nhật lần cuối:** 2026-06-25  
**Base URL:** `https://sophia.agencyos.network` (production)

---

## 1. Tổng quan

Sophia AI Factory cung cấp REST API cho:
- **Customer-facing**: Dashboard, video generation, account management
- **Admin-only**: Monitoring, deploy guard, BYOK rotation
- **Webhooks**: NOWPayments IPN, HeyGen status updates, Telegram bot
- **Cron/Inngest**: Background job orchestration

Tất cả API (trừ public endpoints) yêu cầu authentication qua Better Auth session.

---

## 2. Authentication

### Session-based Auth

API sử dụng Better Auth session cookies:
- Cookie name: `__Secure-better-auth.session_token`
- HttpOnly, Secure, SameSite=Lax

Không cần Bearer token — session được xác thực tự động qua cookie.

### Admin Routes

Admin endpoints yêu cầu:
1. User có `role === 'admin'`
2. Hoặc `CRON_SECRET` header cho cron routes

```http
Authorization: Bearer <CRON_SECRET>
```

---

## 3. Public Endpoints

### 3.1. `GET /api/version`

Trả về thông tin version của deployed code.

**Response:**
```json
{
  "sha": "4bca4710",
  "shortSha": "4bca471",
  "timestamp": "2026-06-21T14:30:00Z",
  "builtAt": "2026-06-21T14:28:00Z"
}
```

**Usage:** Deploy verification — so sánh `shortSha` với local commit.

---

### 3.2. `GET /status`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-25T10:00:00Z",
  "uptime": 99.9
}
```

---

### 3.3. `GET /api/check-access`

Kiểm tra user có quyền truy cập feature nào.

**Query params:**
- `feature` — feature name (e.g., "video_generation", "analytics")

**Response:**
```json
{
  "allowed": true,
  "tier": "PREMIUM",
  "reason": "tier_quota"
}
```

---

## 4. Customer-facing Endpoints

### 4.1. Account Management

#### `GET /api/account`

Lấy thông tin account hiện tại.

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "customer@example.com",
    "name": "Customer Name",
    "tier": "PREMIUM",
    "org_id": "org_xxx"
  }
}
```

#### `POST /api/account/change-email`

Yêu cầu thay đổi email.

**Request:**
```json
{
  "newEmail": "newemail@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent to new address"
}
```

Flow: Gửi email verification link với single-use token → user click → email được update.

---

### 4.2. BYOK Management

#### `GET /api/user/byok`

Lấy danh sách BYOK providers đã configure.

**Response:**
```json
{
  "providers": [
    {
      "provider": "openrouter",
      "key_set": true,
      "key_version": 3,
      "last_rotated": "2026-06-15T08:00:00Z"
    },
    {
      "provider": "elevenlabs",
      "key_set": false,
      "key_version": null
    }
  ]
}
```

#### `POST /api/user/byok`

Set hoặc rotate API key cho provider.

**Request:**
```json
{
  "provider": "openrouter",
  "api_key": "sk-or-xxx..." // plaintext, sẽ được mã hóa
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

#### `DELETE /api/user/byok`

Xóa API key.

**Query:**
```
?provider=openrouter
```

**Response:**
```json
{
  "success": true,
  "provider": "openrouter",
  "deleted_at": "2026-06-20T10:40:00Z"
}
```

---

### 4.3. Video Generation

#### `POST /api/videos`

Tạo video mới từ campaign/script.

**Request:**
```json
{
  "campaign_id": "camp_123",
  "template_id": "template_456",
  "voice_id": "voice_789"
}
```

**Response (202 Accepted):**
```json
{
  "video_id": "video_abc",
  "status": "queued",
  "estimated_completion": "2026-06-25T11:00:00Z"
}
```

**Follow-up:** SSE stream at `/api/videos/[id]/progress` để track real-time.

#### `GET /api/videos`

List videos của user hiện tại.

**Query:**
- `limit` (default: 20)
- `offset` (default: 0)
- `status` (filter: "queued" | "processing" | "completed" | "failed")

**Response:**
```json
{
  "videos": [
    {
      "id": "video_abc",
      "campaign_id": "camp_123",
      "status": "completed",
      "r2_url": "https://r2.sophia.agencyos.network/videos/abc.mp4",
      "created_at": "2026-06-25T10:00:00Z",
      "completed_at": "2026-06-25T10:15:00Z"
    }
  ],
  "total": 150
}
```

#### `GET /api/videos/[id]`

Lấy detail của một video.

**Response:**
```json
{
  "id": "video_abc",
  "campaign": { /* campaign object */ },
  "status": "completed",
  "r2_url": "...",
  "duration_seconds": 30,
  "resolution": "1920x1080"
}
```

#### `POST /api/videos/[id]/distribute`

Publish video tới các kênh social.

**Request:**
```json
{
  "channels": ["youtube", "telegram", "tiktok"]
}
```

**Response:**
```json
{
  "job_id": "publish_xyz",
  "status": "queued",
  "channels": ["youtube", "telegram"]
}
```

---

### 4.4. Campaigns

#### `GET /api/campaigns`

List campaigns của user.

**Query:**
- `status` (active | paused | completed)
- `limit`, `offset`

**Response:**
```json
{
  "campaigns": [
    {
      "id": "camp_123",
      "name": "Summer Sale 2026",
      "status": "active",
      "video_count": 12,
      "created_at": "2026-06-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/campaigns`

Tạo campaign mới.

**Request:**
```json
{
  "name": "Campaign Name",
  "description": "Campaign description",
  "niche": "ecommerce"
}
```

**Response:**
```json
{
  "id": "camp_new",
  "name": "Campaign Name",
  "status": "active",
  "created_at": "2026-06-25T10:30:00Z"
}
```

#### `GET /api/campaigns/[id]`

Get campaign detail.

#### `PATCH /api/campaigns/[id]`

Update campaign (name, status).

#### `DELETE /api/campaigns/[id]`

Delete campaign (soft delete).

---

### 4.5. Onboarding

#### `GET /api/onboarding`

Lấy onboarding status và progress.

**Response:**
```json
{
  "completed_steps": ["api_keys", "first_video"],
  "pending_steps": ["publish_channel"],
  "current_step": "publish_channel",
  "is_complete": false
}
```

#### `POST /api/onboarding/advance`

Mark step complete (internal use).

---

### 4.6. Billing & Orders

#### `GET /api/orders`

List orders/transactions của user.

**Response:**
```json
{
  "orders": [
    {
      "id": "order_123",
      "tier": "PREMIUM",
      "amount_usd": 199,
      "status": "completed",
      "created_at": "2026-06-01T00:00:00Z",
      "payment_method": "nowpayments"
    }
  ]
}
```

#### `GET /api/billing/current`

Lấy subscription hiện tại.

**Response:**
```json
{
  "tier": "PREMIUM",
  "status": "active",
  "current_period_start": "2026-06-01",
  "current_period_end": "2026-07-01",
  "features": {
    "videos_per_month": 100,
    "resolution": "1080p"
  }
}
```

---

### 4.7. Analytics (Admin only)

#### `GET /api/analytics/realtime`

SSE stream real-time metrics.

**Headers:**
```
Accept: text/event-stream
```

**Events:**
```
data: {"activeUsers":15,"campaignsLast1h":3,"apiCallsLast1h":450,"errorRateLast1h":0.01}
```

#### `GET /api/analytics/revenue`

Revenue metrics (MRR, ARR, growth).

**Query:**
- `period` — "7d" | "30d" | "90d"

**Response:**
```json
{
  "mrr": 12500,
  "arr": 150000,
  "growth_percent": 12.5,
  "tier_breakdown": {
    "BASIC": 2000,
    "PREMIUM": 6500,
    "ENTERPRISE": 4000
  }
}
```

#### `GET /api/analytics/cohorts`

Cohort analysis (retention, churn, LTV).

**Query:**
- `metric` — "retention" | "churn" | "ltv"

**Response:**
```json
{
  "cohorts": [
    {
      "month": "2026-04",
      "users": 50,
      "retention_d30": 0.65,
      "churn_rate": 0.12,
      "ltv": 450
    }
  ]
}
```

#### `GET /api/analytics/tier-adoption`

Tier adoption over time.

**Response:**
```json
{
  "timeseries": [
    {
      "date": "2026-04-01",
      "BASIC": 20,
      "PREMIUM": 15,
      "ENTERPRISE": 5,
      "MASTER": 1
    }
  ]
}
```

---

## 5. Admin Endpoints

### 5.1. Deploy Guard

#### `GET /api/admin/deploy-guard`

Lấy deploy approvals pending.

**Response:**
```json
{
  "pending": [
    {
      "id": "deploy_123",
      "commit_sha": "abc123",
      "requester": "user@example.com",
      "requested_at": "2026-06-25T09:00:00Z"
    }
  ]
}
```

#### `POST /api/admin/deploy-guard/approve`

Approve deploy (requires 2-of-3).

**Request:**
```json
{
  "deploy_id": "deploy_123"
}
```

**Response:**
```json
{
  "approved": true,
  "approvals_count": 2,
  "can_proceed": true
}
```

---

### 5.2. BYOK Rotation

#### `POST /api/admin/byok-rotation`

Khởi động BYOK key rotation (see docs/byok-rotation-guide.md).

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Request:**
```json
{
  "action": "start_rotation"
}
```

---

### 5.3. Monitoring

#### `GET /api/admin/llm-cache-stats`

LLM cache statistics.

**Response:**
```json
{
  "stats": {
    "total": 15000,
    "hit": 8500,
    "miss": 6500,
    "hit_rate": 0.57
  }
}
```

#### `GET /api/admin/llm-trace-stats`

LLM trace aggregations (24h).

**Response:**
```json
{
  "stats": {
    "total": 2500,
    "success": 2350,
    "failure": 150,
    "success_rate": 0.94,
    "avg_duration_ms": 1250
  },
  "top_providers": [
    {"provider": "openrouter", "count": 2000},
    {"provider": "anthropic", "count": 500}
  ],
  "top_models": [
    {"model": "claude-3.5-sonnet", "count": 1500},
    {"model": "gpt-4", "count": 800}
  ]
}
```

---

## 6. Webhook Endpoints

### 6.1. NOWPayments IPN

#### `POST /api/webhooks/nowpayments`

IPN từ NOWPayments khi payment hoàn tất.

**Headers:**
```
X-Nowpayments-Signature: <hmac_signature>
Content-Type: application/json
```

**Payload:**
```json
{
  "payment_id": "12345",
  "payment_status": "finished",
  "pay_address": "...",
  "price_amount": 199,
  "pay_amount": 0.001,
  "order_id": "order_abc",
  "order_description": "Sophia AI Factory - PREMIUM subscription"
}
```

**Response:** `200 OK` (empty body)

---

### 6.2. HeyGen Webhook

#### `POST /api/webhooks/heygen`

Video generation completion từ HeyGen.

**Headers:**
```
X-Heygen-Signature: <hmac_signature>
```

**Payload:**
```json
{
  "event": "video.completed",
  "video_id": "heygen_123",
  "status": "completed",
  "video_url": "https://...mp4"
}
```

---

### 6.3. Telegram Bot Webhook

#### `POST /api/webhooks/telegram`

Updates từ Telegram Bot API.

**Payload:**
```json
{
  "update_id": 12345,
  "message": {
    "message_id": 1,
    "chat": { "id": 123456, "type": "private", "username": "user" },
    "text": "/campaign start"
  }
}
```

---

## 7. Cron Endpoints

### 7.1. LLM Cache Purge

#### `POST /api/cron/llm-cache-purge`

Purge expired LLM cache entries.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "deleted": 1500,
  "remaining": 50000
}
```

---

### 7.2. Workflow Stepper

#### `POST /api/cron/workflow-stepper`

Inngest replacement — step Supervisor missions.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

---

## 8. SSE Streams

### 8.1. Video Progress

`GET /api/videos/[id]/progress`

Stream real-time progress updates:

```
event: progress
data: {"status":"processing","step":"heygen","progress":45}

event: completed
data: {"status":"completed","r2_url":"https://..."}
```

---

### 8.2. Analytics Realtime

`GET /api/analytics/realtime`

Stream real-time metrics every 10s.

---

## 9. Error Responses

| Code | Meaning | Recovery |
|------|---------|----------|
| 400 | Bad Request (validation error) | Fix request body |
| 401 | Unauthorized (no session) | Login |
| 403 | Forbidden (insufficient tier) | Upgrade tier |
| 404 | Not found | Check resource ID |
| 429 | Rate limited | Retry after `retry-after` seconds |
| 500 | Server error | Retry or contact support |
| 503 | Service unavailable (AI provider down) | Retry later |

**Error format:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid provider name",
  "details": { "field": "provider", "expected": ["openrouter", "elevenlabs"] }
}
```

---

## 10. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Public API routes | 100 req/min | 60s |
| Authenticated user | 1000 req/min | 60s |
| Admin routes | 100 req/min | 60s |

Exceeded → `429 Too Many Requests` with `Retry-After` header.

---

## 11. Code Locations

| Endpoint | Source File |
|----------|-------------|
| `/api/version` | `src/app/api/version/route.ts` |
| `/api/user/byok` | `src/app/api/user/byok/route.ts` |
| `/api/videos` | `src/app/api/videos/route.ts` |
| `/api/campaigns` | `src/app/api/campaigns/route.ts` |
| `/api/admin/*` | `src/app/api/admin/*/route.ts` |
| `/api/webhooks/*` | `src/app/api/webhooks/*/route.ts` |
| `/api/cron/*` | `src/app/api/cron/*/route.ts` |

---

**See also:**
- [Environment Variables Reference](../ENVIRONMENT_VARIABLES.md)
- [Deployment Guide](../deployment-guide.md)
- [BYOK Rotation Guide](byok-rotation-guide.md)
- [Honeycomb Configuration](honeycomb-configuration.md)
