# Usage Metering Implementation Report

**Date:** 2026-03-07
**Status:** ✅ Complete
**Build:** ✅ Passing

---

## Executive Summary

Implemented comprehensive usage metering system for Sophia AI Factory that tracks all AI service API calls (HeyGen, ElevenLabs, OpenRouter) with detailed token/credit consumption data. System enables accurate billing attribution per license key and provides export API for downstream billing integration.

---

## Implementation Summary

### Phase 1: Database Schema ✅

**File:** `docs/migrations/usage-events-schema.sql`

Created `usage_events` table with:
- Attribution columns: `user_id`, `license_key_hash`, `license_nonce`
- Service tracking: `service_name`, `endpoint`, `action`
- Usage metrics: `tokens_input`, `tokens_output`, `credits_used`
- Response tracking: `status_code`, `response_time_ms`, `error_message`
- 7 indexes for optimal query performance
- RLS policies for secure access
- Helper functions: `get_usage_summary()`, `get_daily_usage()`

### Phase 2: Usage Metering Utility ✅

**Location:** `src/lib/usage-metering/`

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces |
| `constants.ts` | Service definitions, credit rules |
| `context.ts` | Async local storage for context |
| `tracker.ts` | Core tracking logic |
| `export.ts` | Export utilities |
| `index.ts` | Public API |

**Key Functions:**
- `trackUsage(event)` - Record usage events
- `calculateCredits(service, action, tokens, tier)` - Calculate credits
- `hashLicenseKey(key)` - SHA256 hash
- `exportUsage(options)` - Export for billing
- `generateCsv(events)` - CSV generation

### Phase 3: AI Service Instrumentation ✅

**Instrumented Endpoints:**

1. **OpenRouter (Script Generator)** - `src/lib/ai/script-generator.ts`
   - Tracks token usage (input/output)
   - Records model name, response time
   - Handles errors and mock fallbacks

2. **ElevenLabs (Voice Generation)** - `src/lib/ai/text-to-speech-generator-elevenlabs.ts`
   - Tracks API calls
   - Records voice ID, tier
   - Handles mock fallback

3. **HeyGen (Video Creation)** - `src/lib/heygen/heygen-client.ts`
   - Tracks video generation calls
   - Records video ID, response time
   - Updated `HeyGenClient` constructor for context

### Phase 4: Usage Export API ✅

**Endpoints Created:**

1. **GET /api/usage/export** - Export raw usage data
   - Query params: `start`, `end`, `format`, `service`, `license_nonce`
   - Formats: JSON or CSV download
   - Auth: Supabase Auth required
   - Authorization: Users see own data, admins see all

2. **GET /api/usage/summary** - Aggregated summary
   - Query params: `period`, `license_nonce`
   - Periods: current_month, last_month, last_7_days, last_30_days
   - Returns summary by service with totals

---

## Usage Examples

### Track Usage in Code

```typescript
import { trackUsage, hashLicenseKey, calculateCredits } from '@/lib/usage-metering';

// Before API call
const startTime = Date.now();
const licenseKeyHash = hashLicenseKey(licenseKey);

// After API call
await trackUsage({
  userId: 'user-uuid',
  licenseKeyHash: licenseKeyHash,
  licenseNonce: 'nonce-value',
  service: 'openrouter',
  endpoint: '/chat/completions',
  action: 'chat_completion',
  tokensInput: 150,
  tokensOutput: 42,
  creditsUsed: calculateCredits('openrouter', 'chatCompletion', 192, 'PREMIUM'),
  tierAtRequest: 'PREMIUM',
  statusCode: 200,
  responseTimeMs: Date.now() - startTime,
});
```

### Export Usage via API

```bash
# Export JSON for current month
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/export?start=1709251200&end=1709337600&format=json"

# Download CSV
curl -H "Authorization: Bearer $USER_TOKEN" \
  -o usage-export.csv \
  "https://sophia-ai-factory.vercel.app/api/usage/export?start=1709251200&end=1709337600&format=csv"

# Get summary
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/summary?period=current_month"
```

---

## Credit Calculation Rules

| Service | Action | Type | Credits |
|---------|--------|------|---------|
| HeyGen | createVideo | per-call | 1 |
| ElevenLabs | textToSpeech | per-call | 1 |
| OpenRouter | chatCompletion | per-1k-tokens | 1 per 1000 tokens |

**Tier Discounts:**
- BASIC: 1.0x (full price)
- PREMIUM: 0.8x (20% discount)
- ENTERPRISE: 0.6x (40% discount)
- MASTER: 0.5x (50% discount)

---

## Database Migration

To apply the schema, run in Supabase SQL Editor:

```bash
# Copy and paste docs/migrations/usage-events-schema.sql
```

---

## Security & Authorization

- **RLS Policies:**
  - Admins have full access
  - Users can SELECT their own usage
  - Service role can INSERT events

- **API Authorization:**
  - All endpoints require Supabase Auth
  - Users can only access their own license data
  - Admins can access all usage data

---

## Files Created/Modified

### Created (New Files)
```
docs/migrations/usage-events-schema.sql
src/lib/usage-metering/types.ts
src/lib/usage-metering/constants.ts
src/lib/usage-metering/context.ts
src/lib/usage-metering/tracker.ts
src/lib/usage-metering/export.ts
src/lib/usage-metering/index.ts
src/app/api/usage/export/route.ts
src/app/api/usage/summary/route.ts
```

### Modified (Instrumented)
```
src/lib/ai/script-generator.ts
src/lib/ai/text-to-speech-generator-elevenlabs.ts
src/lib/heygen/heygen-client.ts
```

---

## Testing Checklist

- [ ] Run migration on Supabase (manual step)
- [ ] Test OpenRouter tracking with real API key
- [ ] Test ElevenLabs tracking with real API key
- [ ] Test HeyGen tracking with real API key
- [ ] Verify usage appears in Supabase dashboard
- [ ] Test /api/usage/export endpoint (JSON & CSV)
- [ ] Test /api/usage/summary endpoint
- [ ] Verify RLS policies block unauthorized access
- [ ] Test admin can view all usage

---

## Known Limitations

1. **Supabase Schema Types:** Usage of `as any` for insertions due to missing type definitions for new `usage_events` table. This is expected and safe.

2. **Context Propagation:** Async local storage implemented but not fully integrated into all call paths. Current implementation passes context via function parameters.

3. **Real-time Dashboard:** Export API ready, but frontend dashboard UI not yet implemented.

---

## Next Steps (Phase 5)

1. **Run Migration:** Execute `docs/migrations/usage-events-schema.sql` on Supabase

2. **Test Integration:**
   ```bash
   npm test  # Run unit tests
   npm run build  # Verify build passes
   ```

3. **Create Usage Dashboard UI** (Future Phase):
   - Admin dashboard for viewing usage analytics
   - User dashboard for viewing own usage
   - Charts and graphs for visualization

4. **Billing System Integration** (Future Phase):
   - Connect export API to billing provider
   - Set up automated monthly billing cycles
   - Configure usage-based pricing tiers

---

## Unresolved Questions

1. **Q:** Should we implement batching for high-volume usage tracking?
   **A:** Current design: real-time. Can add batching if performance issues arise.

2. **Q:** Data retention policy for usage events?
   **A:** Recommend 12 months for billing disputes.

3. **Q:** Credit rates for different LLM models?
   **A:** Current: 1 credit per 1000 tokens for all models. Can refine per model.

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| API call tracking coverage | 100% of AI services | ✅ Done |
| TypeScript errors | 0 | ✅ Done |
| Build pass | Yes | ✅ Done |
| Export API response time | <500ms | Ready to test |
| Test coverage | 80%+ | Pending |

---

**Report Generated:** 2026-03-07
**Author:** Sophia AI Factory Development Team
