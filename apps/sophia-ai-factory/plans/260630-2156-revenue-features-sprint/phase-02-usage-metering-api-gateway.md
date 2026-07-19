---
title: "Phase 02 — Usage Metering API Gateway Instrumentation"
description: "Gắn usage tracking vào API gateway — phase cuối của usage metering production readiness"
status: completed
priority: P1
effort: 4h
phase: 02
depends_on: []
blocks: []
---

# Phase 02: Usage Metering API Gateway Instrumentation

## Overview

Phase 3 của plan `260307-usage-metering-production` — phase implementation cuối cùng còn pending. Gắn `emitUsageEvent()` vào API gateway middleware để mọi request qua `/api/*` đều được track usage.

## Key Insights

- **API Gateway đã có middleware pipeline** (`src/middleware/api-pipeline.ts`) — chỉ cần thêm emit
- **`emitUsageEvent()` đã có sẵn** ở `src/forest/usage-metering/` — đã import trong `api-pipeline.ts:10`
- **Idempotency key đã có** (Phase 1 completed) — không lo double-count
- **HOT PATH** — API gateway xử lý mọi request, instrumentation phải nhẹ
- **Fire-and-forget** — emit không block response (đã có `.catch()` pattern trong code hiện tại)
- **Phase 6 Verification** — cần verify toàn bộ pipeline hoạt động end-to-end

## Files to Modify

| File | Action |
|------|--------|
| `src/middleware/api-pipeline.ts` | Verify emit đã được gọi đúng; thêm nếu thiếu |
| `src/forest/usage-metering/` | Verify emitUsageEvent idempotency + error handling |
| `src/forest/usage-metering/__tests__/` | Add integration test cho API gateway → usage event flow |

## Architecture

```
API Request → api-pipeline.ts → handleApiRoute (rate limit, quota)
                              → emitUsageEvent(request, response, { tier })
                                → usage_meters INSERT (idempotency key)
                                → fire-and-forget (không block response)
                              → response
```

## Implementation Steps

### Step 1: Audit Current State
- Check `api-pipeline.ts` — `emitUsageEvent` đã được gọi ở line 80
- Verify nó emit đủ thông tin: request path, response status, tier, usage amount
- Check xem có path nào bị bỏ sót không (public API routes, cron routes)

### Step 2: Add Missing Instrumentation
- Nếu có API path nào chưa emit → thêm
- Đảm bảo emit cho: success requests (2xx), rate-limited (429), blocked (403)
- Tier info: lấy từ `x-raas-tier` header hoặc default 'BASIC'

### Step 3: Idempotency Verification
- Verify `emitUsageEvent` dùng idempotency key (request_id hoặc hash)
- D1 INSERT ON CONFLICT DO NOTHING pattern
- Test: gửi 2 request giống nhau → chỉ 1 usage record

### Step 4: Error Handling
- emitUsageEvent fire-and-forget — không throw, không block response
- Log error nếu emit fail (đã có logger.error trong api-pipeline.ts:80-83)
- Verify circuit breaker pattern (nếu usage metering table down → không crash API)

### Step 5: Integration Test
- Tạo test: simulate API request → verify usage_meters có record mới
- Test idempotency: duplicate request → 1 record
- Test non-blocking: emit fail → response vẫn 200

### Step 6: Phase 6 Verification (from original plan)
- Run full test suite
- Verify usage metering score: 5.5/10 → 9/10 (target của plan gốc)
- Update `plans/260307-usage-metering-production/plan.md` status → completed

## Todo List

- [x] Audit `api-pipeline.ts` — verify tất cả API paths được emit
- [x] Add missing emitUsageEvent calls (nếu có)
- [x] Verify idempotency key logic
- [x] Verify fire-and-forget error handling
- [x] Write integration test: API request → usage record
- [x] Write integration test: idempotency (duplicate → 1 record)
- [x] Write integration test: emit fail → response still 200
- [x] Run `npm test` — all pass
- [x] Run `npm run build` — 0 errors
- [x] Mark usage-metering-production plan as completed

## Success Criteria

- Mọi API request qua middleware đều emit usage event
- Idempotency key prevents double-count
- emitUsageEvent failure không block API response
- Integration tests pass
- Usage metering production readiness score: 9/10

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Instrumentation làm chậm API response | Low | High | Fire-and-forget, async, non-blocking |
| Double-count usage | Low | High | Idempotency key (Phase 1 already done) |
| Missing API paths | Medium | Medium | Audit toàn bộ api-pipeline |
| Usage table growth | Medium | Low | TTL cleanup (Phase 5 already done) |

## Security Considerations

- Không emit PII trong usage event (chỉ tier, path, status)
- Usage data accessible chỉ qua admin endpoints
- Không expose usage data trong response headers (trừ rate limit headers đã có)

## Next Steps

- Track 01 (Wave 20) — independent, parallel
- Track 03 (Campaign Analytics) — independent, parallel
