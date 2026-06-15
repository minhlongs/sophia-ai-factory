# Phase 7: Real-time Usage Alerting & Threshold Enforcement

**Date:** 2026-03-09
**Status:** Pending Review
**Priority:** P0 (Production Ready)

---

## Executive Summary

Phase 7 xây dựng hệ thống alert thời gian thực khi usage tiếp cận hoặc vượt quota limits. Hệ thống bao gồm:

1. **Multi-channel alerts** - Email, SMS, Webhook
2. **User-configurable thresholds** - Custom alert rules per license
3. **Real-time triggering** - Tích hợp vào RaaS Gateway quota checks
4. **License Management UI** - Cấu hình alert rules và preferences

---

## Research Findings

### ✅ Existing Components (Phase 6)

| Component | Status | Notes |
|-----------|--------|-------|
| `quota-alert-service.ts` | ✅ Exists | 80/90/100% thresholds, rate limiting |
| `resend-email-service.ts` | ✅ Exists | Email templates for overage/quota events |
| `telegram-notification-adapter.ts` | ✅ Exists | Telegram bot integration |
| `violations` table | ✅ Exists | Compliance tracking |
| `quota_limits` table | ✅ Exists | Custom quota config per license |

### ❌ Missing Components (Phase 7 Gaps)

| Component | Status | Notes |
|-----------|--------|-------|
| `quota_alerts` table migration | ❌ Missing | Referenced in code but no migration file |
| `alert_rules` table | ❌ Missing | User-configurable alert rules |
| `notification_preferences` table | ❌ Missing | User channel preferences |
| Webhook notification channel | ❌ Missing | Only email/SMS currently |
| Alert management API | ❌ Missing | No CRUD endpoints |
| License Management UI | ❌ Missing | No alert configuration interface |
| Real-time integration | ❌ Partial | quota-alert-service exists but not called |

---

## Implementation Plan

### Phase 7.1: Database Migrations (Task #15)

**Files to Create:**
- `supabase/migrations/260309-1730-create-quota-alerts-table.sql`
- `supabase/migrations/260309-1731-create-alert-rules-table.sql`
- `supabase/migrations/260309-1732-create-notification-preferences-table.sql`

**Schema:**

```sql
-- quota_alerts table (already referenced in quota-alert-service.ts)
CREATE TABLE quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  license_nonce TEXT REFERENCES raas_licenses(nonce),
  threshold INTEGER NOT NULL, -- 80, 90, 100
  channel VARCHAR NOT NULL, -- 'email', 'sms', 'webhook'
  recipient VARCHAR, -- email address, phone, or webhook URL
  template_subject VARCHAR,
  template_body TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- alert_rules table (user-configurable)
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  license_nonce TEXT REFERENCES raas_licenses(nonce),
  threshold_percent INTEGER NOT NULL, -- Custom threshold (e.g., 75, 85, 95)
  enabled BOOLEAN DEFAULT true,
  channels TEXT[] DEFAULT ARRAY['email'], -- ['email', 'sms', 'webhook']
  webhook_url TEXT, -- Custom webhook URL
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, license_nonce, threshold_percent)
);

-- notification_preferences table
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  webhook_enabled BOOLEAN DEFAULT false,
  default_webhook_url TEXT,
  language VARCHAR DEFAULT 'en',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Phase 7.2: Webhook Notification Channel (Task #20)

**Files to Create:**
- `src/lib/alerts/webhook-notification-service.ts`

**Implementation:**
```typescript
export interface WebhookPayload {
  event: 'quota_threshold' | 'quota_exceeded' | 'overage_detected';
  userId: string;
  licenseNonce: string;
  threshold: number;
  percentage: number;
  limit: number;
  currentUsage: number;
  tier: Tier;
  timestamp: string;
}

export async function sendWebhookAlert(
  webhookUrl: string,
  payload: WebhookPayload,
  secret?: string
): Promise<boolean> {
  // HMAC-SHA256 signature
  const signature = generateHmacSignature(payload, secret);

  // Retry logic (3 attempts with exponential backoff)
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return true;
    } catch (error) {
      // Wait before retry
      await sleep(Math.pow(2, i) * 1000);
    }
  }

  return false;
}
```

**Update `quota-alert-service.ts`:**
- Add `sendWebhookAlert()` call in `triggerQuotaAlert()`
- Add webhook to alert delivery result tracking

---

### Phase 7.3: Real-time Alert Integration (Task #17)

**Files to Modify:**
- `src/lib/quota/quota-checker.ts`
- `src/lib/raas-gate.ts`

**Integration Points:**

1. **In `quota-checker.ts`** - Add alert triggering after quota check:
```typescript
import { checkAndTriggerAlerts } from '@/lib/alerts/quota-alert-service';

// After calculating usage percentage
const percentage = (currentUsage / limit) * 100;

// Trigger alerts if threshold breached
if (percentage >= 80) {
  await checkAndTriggerAlerts({
    userId,
    licenseNonce,
    tier,
    currentUsage,
    limit,
    exceededType: 'daily_credits',
    polarCustomerId,
    stripeCustomerId,
  }, percentage);
}
```

2. **In `raas-gate.ts`** - Add alert context enrichment:
```typescript
// Before quota check, fetch alert rules
const { data: alertRules } = await supabase
  .from('alert_rules')
  .select('*')
  .eq('license_nonce', license.nonce);

// Pass custom thresholds to quota checker
```

---

### Phase 7.4: Alert Management API (Task #16)

**Endpoints to Create:**

1. **GET /api/alerts/rules** - Get alert rules for license
2. **POST /api/alerts/rules** - Create/update alert rule
3. **DELETE /api/alerts/rules/:id** - Delete alert rule
4. **GET /api/alerts/history** - Get alert history
5. **POST /api/alerts/test** - Send test alert
6. **GET /api/alerts/preferences** - Get user preferences
7. **PUT /api/alerts/preferences** - Update preferences

**File Structure:**
```
src/app/api/alerts/
├── rules/
│   └── route.ts
├── history/
│   └── route.ts
├── test/
│   └── route.ts
└── preferences/
    └── route.ts
```

---

### Phase 7.5: License Management UI (Task #19)

**Components to Create:**

1. **`src/components/alerts/alert-rules-form.tsx`**
   - Threshold slider (0-100%)
   - Channel checkboxes (email, SMS, webhook)
   - Webhook URL input
   - Save/Cancel buttons

2. **`src/components/alerts/alert-history-table.tsx`**
   - Table with columns: Date, Threshold, Channel, Recipient, Status
   - Filter by date range, threshold, channel
   - Pagination

3. **`src/components/alerts/notification-preferences.tsx`**
   - Global channel toggles
   - Language selector
   - Default webhook URL

4. **`src/components/alerts/test-alert-button.tsx`**
   - Send test alert button
   - Success/error toast notifications

**Page Integration:**
- Add alerts tab to `src/app/[locale]/dashboard/license/[nonce]/page.tsx`
- Or create separate `/dashboard/alerts` route

---

### Phase 7.6: Testing & Verification (Task #18)

**Test Cases:**

1. **Database Migration Tests**
   - All tables created successfully
   - Indexes created
   - RLS policies working

2. **Webhook Notification Tests**
   - HMAC signature generation
   - Retry logic (3 attempts)
   - Error handling

3. **Real-time Alert Tests**
   - Alert triggered at 80% threshold
   - Alert triggered at 90% threshold
   - Alert triggered at 100% threshold
   - Rate limiting (max 1 alert/hour/threshold)

4. **API Tests**
   - CRUD operations for alert rules
   - Authentication/authorization
   - Validation errors

5. **UI Tests**
   - Form validation
   - Threshold slider interaction
   - Alert history pagination
   - Test alert functionality

---

## Success Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Database migrations applied | ⬜ Pending | Migration files + Supabase deploy |
| Webhook notifications working | ⬜ Pending | Test alert delivery |
| Real-time alerts triggered | ⬜ Pending | quota-checker integration |
| Alert management API functional | ⬜ Pending | API tests pass |
| License Management UI complete | ⬜ Pending | Screenshot of UI |
| All tests pass | ⬜ Pending | Vitest test results |
| Build passes | ⬜ Pending | `npm run build` success |

---

## Dependencies

- Phase 6 (Overage Billing & Quota Enforcement) ✅ Complete
- RaaS Gateway with quota enforcement ✅ Complete
- Email service (Resend) ✅ Complete
- Telegram notification adapter ✅ Complete

---

## Timeline

| Phase | Estimated Time | Status |
|-------|---------------|--------|
| 7.1 Database Migrations | 30 min | ⬜ Pending |
| 7.2 Webhook Channel | 45 min | ⬜ Pending |
| 7.3 Real-time Integration | 45 min | ⬜ Pending |
| 7.4 Alert Management API | 1 hour | ⬜ Pending |
| 7.5 License Management UI | 1.5 hours | ⬜ Pending |
| 7.6 Testing & Verification | 45 min | ⬜ Pending |

**Total:** ~5 hours

---

## Review Checklist

- [ ] Review database schema design
- [ ] Review webhook security (HMAC signatures)
- [ ] Review rate limiting implementation
- [ ] Review API authentication/authorization
- [ ] Review UI accessibility
- [ ] Test alert delivery end-to-end
- [ ] Test rate limiting behavior
- [ ] Test webhook retry logic

---

**End of Plan**
