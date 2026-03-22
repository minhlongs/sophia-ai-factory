# Code Review — Video AI Integration

**Date:** 2026-03-20
**Reviewer:** code-reviewer agent
**Scope:** Video AI implementation (HeyGen integration)
**Work Context:** `/Users/macbook/mekong-cli/apps/sophia-proposal`

---

## Scope

| Category | Files |
|----------|-------|
| **Core Library** | `lib/video/heygen-client.ts` (247 LOC), `lib/video/video-templates.ts` (230 LOC) |
| **API Routes** | `app/api/video/generate/route.ts` (179 LOC), `app/api/video/webhook/route.ts` (148 LOC), `app/api/video/[id]/route.ts` (222 LOC), `app/api/video/proposal/[proposalId]/route.ts` (118 LOC) |
| **Components** | `components/video/video-player.tsx` (155 LOC), `components/video/video-generator.tsx` (224 LOC), `components/video/video-list.tsx` (342 LOC) |
| **Types** | `types/video.ts` (191 LOC) |
| **Validators** | `lib/validators/video.ts` (114 LOC) |
| **Database** | `lib/supabase/migrations/005_video_tables.sql` (346 LOC) |
| **Tests** | `tests/validators/video.test.ts` (146 LOC, 16 tests) |

**Total:** ~2,200 LOC across 11 files

**Scout Findings:** No additional edge cases found beyond what's documented — video files isolated, no cross-dependencies with critical billing/auth paths.

---

## Overall Assessment

**Score: 7.2/10** — Production-ready with notable gaps

Video AI integration is functionally complete with solid foundation: proper type safety, Zod validation, RLS policies, and MCU billing integration. However, **critical security gaps** (webhook signature optional, no rate limiting) and **code quality issues** (console.log statements, long functions) prevent enterprise-grade rating.

### Score Breakdown

| Category | Score | Summary |
|----------|-------|---------|
| **Security** | 6/10 | Webhook signature optional, no rate limiting, API key exposure risk |
| **Type Safety** | 9/10 | Zero `any` types, comprehensive interfaces, strict mode |
| **Error Handling** | 7/10 | Try/catch present but inconsistent recovery, silent failures |
| **Performance** | 8/10 | Async/await correct, polling could optimize, no N+1 queries |
| **Maintainability** | 7/10 | Console.log pollution, 3 functions >100 LOC, DRY violations |

---

## Critical Issues

### 1. Webhook Signature Verification is Optional [SECURITY — CRITICAL]

**File:** `app/api/video/webhook/route.ts:41-43`

```typescript
if (HEYGEN_WEBHOOK_SECRET) {
  // verify signature
} else {
  console.warn("HEYGEN_WEBHOOK_SECRET not configured - skipping signature verification");
}
```

**Problem:** Webhook signature verification bypassed when secret not configured. Attacker can forge `task.completed` events to trigger unlimited free videos or spam users.

**Impact:** HIGH — Billing fraud, MCU theft, potential DoS via fake webhooks.

**Fix:**

```typescript
// REQUIRED — reject if secret missing
if (!HEYGEN_WEBHOOK_SECRET) {
  return NextResponse.json(
    { error: "Webhook secret not configured" },
    { status: 503 }
  );
}

const isValid = verifyWebhookSignature(rawBody, signature, HEYGEN_WEBHOOK_SECRET);
if (!isValid) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

---

### 2. MCU Deduction Not Atomic with Video Status Update [SECURITY — HIGH]

**File:** `app/api/video/webhook/route.ts:99-109`

```typescript
// Update video status
await serverClient.from("video_assets").update({...}).eq("id", video.id);

// Deduct MCU balance (separate operation)
const { data: deductResult } = await serverClient.rpc("deduct_mcu_for_video", {...});

if (!deductResult) {
  console.error("Failed to deduct MCU for video:", video.id);
  // Don't fail the webhook - video is still ready
}
```

**Problem:** Status update and MCU deduction are two separate transactions. If deduction fails after status update, user gets free video. No rollback mechanism.

**Impact:** MEDIUM-HIGH — Revenue loss from failed deductions on completed videos.

**Fix:** Use database transaction:

```sql
-- In deduct_mcu_for_video function
BEGIN;
  -- Deduct balance
  UPDATE org_balances SET balance = balance - v_mcu_cost WHERE org_id = v_org_id;
  -- Update video status
  UPDATE video_assets SET status = 'ready', ... WHERE id = p_video_id;
  -- Check balance didn't go negative
  IF (SELECT balance FROM org_balances WHERE org_id = v_org_id) < 0 THEN
    ROLLBACK;
    RETURN false;
  END IF;
COMMIT;
```

---

### 3. HeyGen API Key Exposure Risk [SECURITY — MEDIUM]

**File:** `lib/video/heygen-client.ts:19-20`

```typescript
const HEYGEN_BASE_URL = process.env.HEYGEN_API_URL || "https://api.heygen.com/v1";
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
```

**Problem:** API key accessed at module level, not validated before use. If env var missing, warning logged but code continues (line 23).

**Impact:** Runtime failures in production if env misconfigured. Potential key leakage if server logs exposed.

**Fix:**

```typescript
// Validate at startup
if (!process.env.HEYGEN_API_KEY) {
  throw new Error("HEYGEN_API_KEY is required");
}

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
```

---

## High Priority

### 4. No Rate Limiting on Video Generation [PERFORMANCE — HIGH]

**File:** `app/api/video/generate/route.ts`

**Problem:** No rate limiting on `/api/video/generate`. User can spam requests, exhaust MCU balance instantly, or trigger HeyGen API rate limits.

**Fix:** Add rate limiter:

```typescript
import { rateLimit } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const { data: user } = await authClient.auth.getUser();

  // Max 5 video generations per minute per user
  const limited = await rateLimit(user.id, 'video:generate', { limit: 5, window: 60 });
  if (limited) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  // ...
}
```

---

### 5. Console.log Pollution [MAINTAINABILITY — HIGH]

**Files:** 7 files, 18 console statements

| File | Count | Severity |
|------|-------|----------|
| `lib/video/video-templates.ts` | 7 error logs | High |
| `app/api/video/webhook/route.ts` | 6 logs (1 info, 1 warn) | Medium |
| `app/api/video/generate/route.ts` | 3 error logs | High |
| `app/api/video/[id]/route.ts` | 3 error logs | Medium |
| `app/api/video/proposal/[proposalId]/route.ts` | 2 error logs | Low |
| `lib/video/heygen-client.ts` | 1 warn | Low |

**Problem:** Production code should use structured logging, not `console.log`. Violates Binh Pháp Quality Front #1 (0 console.log).

**Fix:** Replace with structured logger:

```typescript
import { logger } from "@/lib/observability/logger";

// Instead of:
console.error("Error fetching templates:", error);

// Use:
logger.error("video.templates.fetch_failed", { error: error.message, orgId });
```

---

### 6. Function Size Violations [MAINTAINABILITY — MEDIUM]

| Function | File | LOC | Target |
|----------|------|-----|--------|
| `POST /api/video/generate` | `generate/route.ts` | ~80 | <50 |
| `POST /api/video/webhook` | `webhook/route.ts` | ~70 | <50 |
| `GET /api/video/[id]` | `[id]/route.ts` | ~90 | <50 |

**Problem:** Functions exceed 50 LOC guideline. Complex error handling mixed with business logic.

**Fix:** Extract helper functions:

```typescript
// Before: 80 LOC in POST handler
async function POST(request: NextRequest) {
  // auth, validation, org lookup, balance check, HeyGen call, DB insert...
}

// After: Split concerns
async function POST(request: NextRequest) {
  const user = await authenticate(request);
  const validated = await validateRequest(request);
  const orgId = await getUserOrg(user.id);
  await checkBalance(orgId, validated.videoType);

  const heygenResult = await createHeygenTask(validated);
  const video = await createVideoAsset(orgId, heygenResult);

  return NextResponse.json({ success: true, videoId: video.id });
}
```

---

## Medium Priority

### 7. Polling Inefficiency [PERFORMANCE — MEDIUM]

**File:** `components/video/video-list.tsx:55-65`

```typescript
if (hasProcessing && !pollingInterval) {
  const interval = setInterval(() => {
    fetchVideos();
  }, 5000);
  setPollingInterval(interval);
}
```

**Problem:** Polls every 5 seconds regardless of video count. 10 videos processing = 2 API calls/second. No exponential backoff.

**Fix:** Implement backoff:

```typescript
const getPollingInterval = (retryCount: number) => {
  const delays = [5000, 10000, 30000, 60000]; // 5s → 10s → 30s → 1m
  return delays[Math.min(retryCount, delays.length - 1)];
};
```

---

### 8. Missing Zod Schema Validation for MCU Costs [SECURITY — MEDIUM]

**File:** `lib/validators/video.ts`

**Problem:** `generateVideoSchema` validates video types but doesn't validate MCU cost calculation. Attacker could manipulate client-side cost if ever sent from client.

**Note:** Currently MCU cost is server-calculated (line 86 in `generate/route.ts`), which is correct. But schema should document expected cost range.

**Fix:** Add cost validation to response schema:

```typescript
export const videoGenerationResponseSchema = z.object({
  success: z.boolean(),
  videoId: z.string().uuid(),
  mcuCost: z.number().min(0).max(1000), // Sanity check
  // ...
});
```

---

### 9. Duplicate Component Definitions [MAINTAINABILITY — LOW]

**Files:** `components/video/video-generator.tsx` vs `components/video/video-list.tsx:306-342`

**Problem:** `VideoGenerator` component defined twice with slight variations. DRY violation.

**Fix:** Export single component from `video-generator.tsx`, import in `video-list.tsx`.

---

### 10. Hardcoded MCU Costs in Component [MAINTAINABILITY — LOW]

**File:** `components/video/video-generator.tsx:26-31`

```typescript
const mcuCosts: Record<string, number> = {
  intro: 100,
  section: 250,
  full_proposal: 500,
  custom: 100,
};
```

**Problem:** Costs hardcoded in UI. Source of truth is `lib/billing/mcu-pricing.ts:19-29`. Risk of drift.

**Fix:** Import from pricing module:

```typescript
import { MCU_COSTS } from "@/lib/billing/mcu-pricing";

// Use MCU_COSTS['video:intro'] etc.
```

---

## Low Priority

### 11. Missing TypeScript JSDoc on Public Functions

**Files:** `lib/video/heygen-client.ts`, `lib/video/video-templates.ts`

**Problem:** Functions like `createVideoTask`, `getAvailableTemplates` lack JSDoc with `@param`, `@returns`, `@throws`.

**Fix:** Add JSDoc:

```typescript
/**
 * Create a new video generation task with HeyGen
 * @param request - Video generation parameters
 * @returns HeyGen task response with video_id
 * @throws HeyGenError if API call fails or credentials invalid
 */
export async function createVideoTask(request: VideoGenerationRequest) {
  // ...
}
```

---

### 12. Avatar Style Mapping Incomplete

**File:** `lib/video/heygen-client.ts:211-218`

```typescript
function mapAvatarStyle(style: string): "formal" | "casual" | "business" {
  if (style.includes("business") || style.includes("formal")) {
    return "business";
  }
  if (style.includes("casual")) {
    return "casual";
  }
  return "formal"; // Default fallback
}
```

**Problem:** Defaults to "formal" for unknown styles. Silent data loss.

**Fix:** Log warning and return explicit "unknown":

```typescript
const validStyles = ["formal", "casual", "business"] as const;
type AvatarStyle = typeof validStyles[number];

function mapAvatarStyle(style: string): AvatarStyle | "unknown" {
  const matched = validStyles.find(s => style.toLowerCase().includes(s));
  if (!matched) {
    logger.warn("Unknown avatar style", { original: style });
    return "unknown";
  }
  return matched;
}
```

---

## Positive Observations

1. **Type Safety Excellent** — Zero `any` types found. All interfaces properly defined in `types/video.ts`.
2. **Zod Validation Comprehensive** — 16 tests pass, covers all edge cases for video types and webhook payloads.
3. **RLS Policies Correct** — Organization isolation enforced at database level. Service role policies properly scoped.
4. **Authentication Flow** — Proper JWT validation on all API routes using `createAuthClient`.
5. **Database Function Design** — `deduct_mcu_for_video` RPC function uses security definer pattern correctly.
6. **Migration Quality** — Comprehensive indexes (6 on video_assets, 3 on video_templates), proper cascade deletes.
7. **Status Mapping** — Clean enum mapping between HeyGen status and internal status.
8. **Error Boundaries** — Try/catch on all async operations, graceful fallbacks.

---

## Recommended Actions

### Immediate (Before Production)

1. **MANDATORY: Enable webhook signature verification** — Reject webhooks without valid signature.
2. **MANDATORY: Add rate limiting** — Prevent abuse on `/api/video/generate`.
3. **HIGH: Remove all console.log statements** — Replace with structured logging or remove entirely.
4. **HIGH: Add transaction for MCU deduction** — Ensure atomic status update + billing.

### Short-term (Next Sprint)

5. **MEDIUM: Refactor long functions** — Extract helper functions for readability.
6. **MEDIUM: Optimize polling** — Add exponential backoff for status checks.
7. **MEDIUM: Deduplicate components** — Consolidate VideoGenerator definitions.
8. **MEDIUM: Remove hardcoded costs** — Import from `mcu-pricing.ts`.

### Long-term (Backlog)

9. **LOW: Add JSDoc** — Complete API documentation for public functions.
10. **LOW: Improve avatar style mapping** — Handle unknown styles gracefully.
11. **LOW: Add E2E tests** — Integration tests for full video generation flow.
12. **LOW: Add metrics** — Track video generation success rate, average duration, MCU revenue.

---

## Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Type Coverage | 100% (0 `any`) | 100% | ✅ Pass |
| Test Coverage (Validators) | 16 tests | 10+ | ✅ Pass |
| TypeScript Errors | 0 | 0 | ✅ Pass |
| Console Statements | 18 | 0 | ❌ Fail |
| Functions >50 LOC | 3 | 0 | ⚠️ Warning |
| Security Headers | Not checked | CSP, HSTS | — |
| RLS Enabled | Yes | Yes | ✅ Pass |

---

## Unresolved Questions

1. **HeyGen webhook retry behavior** — What happens if webhook returns 500? Does HeyGen retry? How many times?
2. **MCU refund policy** — If video fails after MCU deducted, is there a refund mechanism?
3. **Video expiration** — Do HeyGen videos expire? Should we download and store in R2?
4. **Cost validation** — Should we validate MCU_COSTS match HeyGen's actual pricing tiers?
5. **Multi-tenant isolation** — Are video URLs publicly accessible or signed URLs required?

---

## Appendix: File-by-File Summary

### `lib/video/heygen-client.ts` — 7/10
- ✅ Good: Error class, typed responses, duration estimation
- ❌ Bad: Optional API key warning, console.warn, `require("crypto")` dynamic import
- ⚠️ Fix: Move crypto import to top-level, validate env at startup

### `lib/video/video-templates.ts` — 6/10
- ✅ Good: Global + org template separation, soft deletes
- ❌ Bad: 7 console.error statements, repetitive queries
- ⚠️ Fix: Create template repository class, centralize error handling

### `app/api/video/generate/route.ts` — 8/10
- ✅ Good: Auth, validation, balance check, HeyGen integration
- ❌ Bad: 3 console.error, long function
- ⚠️ Fix: Extract business logic to service layer

### `app/api/video/webhook/route.ts` — 5/10
- ✅ Good: Signature verification logic, status handling
- ❌ Bad: **Signature optional**, 6 console statements, non-atomic MCU deduction
- ⚠️ Fix: Make signature mandatory, add transaction

### `app/api/video/[id]/route.ts` — 7/10
- ✅ Good: Auth, org verification, HeyGen status polling
- ❌ Bad: Long function, console.error
- ⚠️ Fix: Split GET/DELETE, extract status polling

### `app/api/video/proposal/[proposalId]/route.ts` — 8/10
- ✅ Good: Clean implementation, proper auth
- ❌ Bad: 2 console.error
- ⚠️ Fix: Remove logs or use structured logging

### `components/video/*.tsx` — 8/10
- ✅ Good: Loading states, error handling, responsive design
- ❌ Bad: Hardcoded costs, duplicate VideoGenerator
- ⚠️ Fix: Import costs, deduplicate

### `types/video.ts` — 9/10
- ✅ Good: Comprehensive interfaces, proper typing
- ❌ Bad: Minor — could add JSDoc
- ⚠️ Fix: Add type-level documentation

### `lib/validators/video.ts` — 9/10
- ✅ Good: Complete schemas, proper error messages
- ❌ Bad: None significant
- ⚠️ Fix: Add cost validation

### `lib/supabase/migrations/005_video_tables.sql` — 9/10
- ✅ Good: RLS policies, indexes, functions, triggers, seed data
- ❌ Bad: None
- ⚠️ Fix: Consider adding check constraint for MCU cost > 0

### `tests/validators/video.test.ts` — 9/10
- ✅ Good: 16 tests, edge cases covered
- ❌ Bad: Only validates schemas, no integration tests
- ⚠️ Fix: Add API route tests, HeyGen mock tests

---

**Report Generated:** 2026-03-20
**Next Review:** After critical fixes (issues 1-4)
