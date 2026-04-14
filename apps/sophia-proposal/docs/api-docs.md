# Sophia AI Factory — API Documentation

**Version:** 2.0.0 (Sprint 3)
**Last Updated:** 2026-03-20
**Base URL:** `https://sophia.agencyos.network/api`

---

## Authentication

All API routes (except public webhooks) require authentication via JWT token.

### Session Management

Sessions are managed through cookies:

- `auth-token` — JWT session token (signed with HS256)
- Middleware validates JWT signature and extracts `user_id` from `sub` claim
- JWT token includes: `{ sub: userId, email, iat, exp }`
- Token TTL: 7 days

### Organization Context

**SECURITY NOTE (April 2026):** Organization ID is now derived server-side from the authenticated user's JWT token, NOT from user-controllable headers.

**Deprecated Pattern:**
```
x-org-id: <uuid>  ← NEVER trust this header for authorization
```

**Secure Pattern:**
1. Client sends JWT in `Authorization: Bearer <token>` header or via cookies
2. Server extracts `user_id` from verified JWT payload
3. Server queries database to find user's primary organization
4. All operations scoped to that organization (database-enforced)

Example secure endpoint:
```typescript
const authClient = createAuthClient(await resolveToken(request));
const { data: { user }, error } = await authClient.auth.getUser();
const orgId = await getOrgId(user.id, db);  // Organization derived from JWT, not header
```

---

## Billing API (Sprint 3)

### POST `/api/billing/checkout`

Create a Polar checkout session for subscription upgrade.

**Request:**
```typescript
POST /api/billing/checkout
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body:
{
  "tier": "starter" | "growth" | "premium" | "master",
  "successUrl": "https://sophia.agencyos.network/billing/success",
  "embedOrigin": "https://sophia.agencyos.network" // optional
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "url": "https://checkout.nowpayments.io/..."
}

// 400 Bad Request
{
  "error": "Invalid tier specified"
}

// 402 Payment Required
{
  "error": "Existing subscription required"
}
```

**Implementation:** `app/api/billing/checkout/route.ts`

---

### POST `/api/billing/portal`

Create a Polar customer portal session for subscription management.

**Request:**
```typescript
POST /api/billing/portal
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body:
{
  "returnUrl": "https://sophia.agencyos.network/billing" // optional
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "url": "https://portal.nowpayments.io/..."
}

// 404 Not Found
{
  "error": "No Polar customer found"
}
```

**Implementation:** `app/api/billing/portal/route.ts`

---

### POST `/api/billing/subscription`

Get or update current organization subscription.

**Request:**
```typescript
POST /api/billing/subscription
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body (for update):
{
  "cancelAtPeriodEnd": true
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "subscription": {
    "id": "uuid",
    "tierName": "growth",
    "status": "active",
    "mcuMonthly": 2000,
    "mcuOverageRate": 0.08,
    "currentPeriodEnd": "2026-04-20T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}

// 404 Not Found
{
  "error": "No subscription found"
}
```

**Implementation:** `app/api/billing/subscription/route.ts`

---

### POST `/api/webhooks/polar`

Handle NOWPayments webhook events (public endpoint, no auth).

**Headers:**
```
x-polar-signature: t=<timestamp>,v1=<hmac-sha256>
Content-Type: application/json
```

**Events:**
| Event Type | Handler | Action |
|------------|---------|--------|
| `subscription.created` | `handleSubscriptionCreated` | Create subscription record |
| `subscription.updated` | `handleSubscriptionUpdated` | Update status |
| `subscription.deleted` | `handleSubscriptionDeleted` | Mark cancelled |
| `order.paid` | `handleOrderPaid` | Credit MCU balance |
| `order.refunded` | `handleOrderRefunded` | Deduct MCU balance |

**Security:**
1. HMAC signature verification (5-minute window)
2. Event deduplication (24h in-memory store)
3. Idempotency via `polar_order_id` constraint
4. Amount validation (> 0)
5. Product validation (known tiers only)

**Response:**
```typescript
// 200 OK
{ "received": true }

// 200 OK (duplicate)
{ "received": true, "duplicate": true }

// 400 Bad Request
{ "error": "Invalid JSON payload" }

// 401 Unauthorized
{ "error": "Invalid signature" }

// 500 Internal Server Error (Polar will retry)
{ "error": "Internal server error" }
```

**Implementation:** `app/api/webhooks/polar/route.ts`

---

## Usage API (Sprint 3)

### GET `/api/usage`

Get usage history and summary for organization.

**Request:**
```typescript
GET /api/usage?days=30&page=1&limit=50
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token. Query scoped to user's primary organization.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | 30 | Days of history |
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Results per page |

**Response:**
```typescript
// 200 OK
{
  "summary": {
    "totalMcuUsed": 1250,
    "totalCost": 1250,
    "byFeature": [
      { "feature": "proposal:text:basic", "count": 50, "mcuUsed": 500 },
      { "feature": "proposal:text:advanced", "count": 20, "mcuUsed": 500 },
      { "feature": "video:short", "count": 2, "mcuUsed": 200 }
    ],
    "dailyUsage": [
      { "date": "2026-03-19", "mcuUsed": 450 },
      { "date": "2026-03-20", "mcuUsed": 800 }
    ]
  },
  "logs": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "feature": "proposal:text:basic",
      "mcu_cost": 10,
      "metadata": { "proposal_id": "uuid" },
      "created_at": "2026-03-20T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125
  }
}

// 400 Bad Request
{ "error": "Organization ID required" }

// 404 Not Found
{ "error": "Organization not found" }
```

**Implementation:** `app/api/usage/route.ts`

---

### GET `/api/usage/summary`

Get aggregated usage statistics (shortcut for dashboard).

**Request:**
```typescript
GET /api/usage/summary?days=7
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "totalMcuUsed": 450,
  "totalCost": 450,
  "dailyAverage": 64,
  "projectedMonthly": 1950
}
```

---

## Proposals API (Sprint 2)

### GET `/api/proposals`

List all proposals for organization.

**Request:**
```typescript
GET /api/proposals?status=draft&page=1&limit=20
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "proposals": [
    {
      "id": "uuid",
      "title": "Q2 Marketing Campaign",
      "status": "draft",
      "created_at": "2026-03-20T10:00:00Z",
      "updated_at": "2026-03-20T11:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

**Implementation:** `app/api/proposals/route.ts`

---

### POST `/api/proposals`

Create a new proposal.

**Request:**
```typescript
POST /api/proposals
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body:
{
  "title": "Q2 Marketing Campaign",
  "templateId": "uuid", // optional
  "content": { ... }
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 201 Created
{
  "proposal": {
    "id": "uuid",
    "title": "Q2 Marketing Campaign",
    "status": "draft",
    "created_at": "2026-03-20T12:00:00Z"
  }
}
```

**Implementation:** `app/api/proposals/route.ts`

---

### GET `/api/proposals/[id]`

Get a specific proposal by ID.

**Request:**
```typescript
GET /api/proposals/[id]
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "proposal": {
    "id": "uuid",
    "title": "Q2 Marketing Campaign",
    "content": { ... },
    "status": "draft",
    "created_at": "2026-03-20T10:00:00Z"
  }
}

// 404 Not Found
{ "error": "Proposal not found" }
```

**Implementation:** `app/api/proposals/[id]/route.ts`

---

### DELETE `/api/proposals/[id]`

Delete a proposal.

**Request:**
```typescript
DELETE /api/proposals/[id]
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 204 No Content

// 404 Not Found
{ "error": "Proposal not found" }
```

**Implementation:** `app/api/proposals/[id]/route.ts`

---

### POST `/api/proposals/generate`

Generate AI-powered proposal using Claude.

**Request:**
```typescript
POST /api/proposals/generate
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body:
{
  "templateId": "uuid", // optional
  "inputs": {
    "clientName": "Acme Corp",
    "projectScope": "Marketing video series",
    "budget": "$50,000",
    "timeline": "Q2 2026"
  },
  "tier": "growth" // for cost calculation
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token. MCU balance checked before generation.

**Response:**
```typescript
// 200 OK
{
  "proposal": {
    "id": "uuid",
    "title": "Acme Corp - Marketing Video Series",
    "content": "...",
    "status": "draft"
  },
  "mcuCost": 25
}

// 402 Payment Required
{ "error": "Insufficient MCU balance" }

// 400 Bad Request
{ "error": "Invalid input data" }
```

**Implementation:** `app/api/proposals/generate/route.ts`

---

## Onboarding API (Sprint 3)

### GET `/api/onboarding/status`

Get pilot onboarding status and checklist.

**Request:**
```typescript
GET /api/onboarding/status
Headers:
  Authorization: Bearer <jwt>
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 200 OK
{
  "isPilot": true,
  "status": "active",
  "daysSinceStart": 5,
  "npsDue": false,
  "checklist": {
    "signup": true,
    "org": true,
    "subscription": true,
    "payment": true,
    "onboarding": false,
    "firstProposal": false,
    "feedback": false
  }
}

// 404 Not Found
{ "error": "No active subscription" }
```

**Implementation:** `app/api/onboarding/status/route.ts`

---

### POST `/api/feedback`

Submit customer feedback (NPS survey).

**Request:**
```typescript
POST /api/feedback
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json

Body:
{
  "surveyType": "nps",
  "score": 9, // 0-10
  "feedback": "Great product! Easy to use." // optional
}
```

**Note:** Organization ID is derived server-side from the authenticated JWT token.

**Response:**
```typescript
// 201 Created
{ "success": true }

// 400 Bad Request
{
  "success": false,
  "error": "Invalid NPS score (must be 0-10)"
}
```

**Implementation:** `app/api/feedback/route.ts`

---

## Authentication API (Sprint 1)

### POST `/api/auth/signup`

Create new user account.

**Request:**
```typescript
POST /api/auth/signup
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "securepassword123",
  "organizationName": "Acme Corp" // optional, creates org
}
```

**Response:**
```typescript
// 201 Created
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "organization": {
    "id": "uuid",
    "name": "Acme Corp"
  }
}

// 400 Bad Request
{ "error": "Email already registered" }
```

**Implementation:** `app/api/auth/signup/route.ts`

---

### POST `/api/auth/login`

User login.

**Request:**
```typescript
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```typescript
// 200 OK
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "organizations": [
    { "id": "uuid", "name": "Acme Corp", "role": "admin" }
  ]
}

// 401 Unauthorized
{ "error": "Invalid credentials" }
```

**Implementation:** `app/api/auth/login/route.ts`

---

### POST `/api/auth/logout`

User logout.

**Request:**
```typescript
POST /api/auth/logout
```

**Response:**
```typescript
// 200 OK
{ "success": true }
```

**Implementation:** `app/api/auth/logout/route.ts`

---

## Error Handling

### Standard Error Response Format

```typescript
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE" // optional, for programmatic handling
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 204 | No Content | Successful delete |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 402 | Payment Required | Insufficient MCU balance |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

Current implementation: No rate limiting (pilot phase).

Future implementation planned:
- 100 requests/minute per organization
- 1000 requests/hour per organization
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Webhook Configuration (NOWPayments Setup)

### Configure Webhook in Polar Dashboard

1. Go to https://nowpayments.io/dashboard/settings/webhooks
2. Click "Add Endpoint"
3. Enter URL: `https://sophia.agencyos.network/api/webhooks/polar`
4. Select events:
   - ☑️ `subscription.created`
   - ☑️ `subscription.updated`
   - ☑️ `subscription.deleted`
   - ☑️ `order.paid`
   - ☑️ `order.refunded`
5. Copy the webhook secret
6. Add to `.env`:
   ```
   NOWPAYMENTS_WEBHOOK_SECRET=whsec_...
   ```

### Test Webhook Locally

Use Polar's "Send Test Event" feature or use Stripe CLI-like tools:

```bash
# Example test payload
curl -X POST http://localhost:3000/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "x-polar-signature: t=1234567890,v1=abc123..." \
  -d '{
    "type": "order.paid",
    "data": {
      "id": "test_123",
      "type": "order",
      "attributes": {
        "id": "order_123",
        "customer_id": "cust_123",
        "amount": 4900,
        "product_id": "prod_starter"
      }
    }
  }'
```

---

## CORS Configuration

**Updated April 2026 for security:**

The API now enforces strict CORS origin validation:

```
Access-Control-Allow-Origin: https://sophia.agencyos.network
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Previous Configuration (Deprecated):**
- Wildcard origin (`*`) removed — was security risk
- `X-Org-Id` header removed from allowed headers — orgId now server-derived only

**Client Impact:**
Frontend requests must originate from `https://sophia.agencyos.network`. No other origins are permitted. No `X-Org-Id` header should be sent by clients.

---

## Related Documentation

- [System Architecture](./system-architecture.md)
- [Deployment Guide](./deployment-guide.md)
- [Code Standards](./code-standards.md)
