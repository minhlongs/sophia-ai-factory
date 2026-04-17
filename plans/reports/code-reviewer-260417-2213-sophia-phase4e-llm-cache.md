# Code Review — Sophia Phase 4E LLM Semantic Cache MVP

**Commit:** 69fe6a5 | **Scope:** 4 files, ~185 LOC prod + 312 LOC test
**Verdict:** SHIP — **9.7 / 10**, không critical.

## Scoring

| Dimension | Score | Note |
|---|---|---|
| Correctness | 10/10 | Hash determinism + upsert + TTL đều đúng |
| Security | 9/10 | MVP không user-scoped — acceptable vì dark-launched, xem H-1 |
| YAGNI/KISS | 10/10 | Exact-match only, embedding đẩy 4E.2 |
| DRY | 10/10 | Đúng dual của `recordLlmCall`, không duplication |
| Edge cases | 9/10 | Unicode OK (TextEncoder UTF-8), TTL=0 OK. Thiếu rõ ràng ở L-2 |
| Test coverage | 10/10 | 25 tests, phủ happy/miss/expired/throw/upsert semantics |
| Tech debt risk | 9/10 | Hash key không include `max_tokens/temperature` — xem M-1 |

## Findings (severity-ordered)

### 🔴 Critical: none

### 🟠 High

**H-1. Cache không có user/org scoping → cross-tenant leak khi mở rộng khỏi cron.**
Hiện tại chỉ wire vào `weekly-signals-digest` cron (zero user input — chạy bằng `CRON_SECRET`), nên MVP **an toàn** ở điểm sử dụng hiện tại. Nhưng khi Phase 4E.2 hoặc Supervisor stepper dùng cache với prompt có chứa user-data, hai user khác nhau hash cùng prompt sẽ share response. **Fix NOW trước 4E.2:** thêm `orgId?: string` vào `CacheKey`, hash bao gồm nó, và migration thêm column `org_id TEXT` + composite index. Dark-launched nên thay đổi schema rẻ.

### 🟡 Medium

**M-1. Hash key bỏ qua sampling params (`max_tokens`, `temperature`, `top_p`).**
Caller `summarizeWithAI` hardcode `max_tokens: 600` nên MVP OK. Nhưng nếu caller thứ 2 đổi `max_tokens=2000` với cùng prompt → sẽ hit cache response bị cắt ở 600. **Fix trước 4E.2:** mở rộng `CacheKey` thành `{provider, model, messages, params?: {max_tokens?, temperature?, top_p?}}` và hash `params` nếu có.

**M-2. Hit-count không được tăng trên `lookupCache` hit.**
Payload loại `hit_count` khỏi upsert để bảo toàn (đúng), nhưng không có path tăng nó khi hit → metric chết. Hoặc (a) xóa cột khỏi schema (YAGNI), hoặc (b) bắn `UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ?` fire-and-forget sau khi trả entry. Khuyến nghị (a) cho MVP.

### 🟢 Low

**L-1. `isCacheEnabled()` đọc `process.env` mỗi call.** Trong CF Workers `process.env` là proxy vào env binding, không expensive nhưng cache-per-request có thể nhanh hơn. YAGNI — skip.

**L-2. TTL=0 test chỉ verify "rơi về default", không test TTL=1 boundary.** Đã có test TTL=10 (L277) nên acceptable. Có thể add test entry với `expires_at = now` xác nhận `<=` trả null. Skip.

**L-3. Log "cache hit" ở `summarizeWithAI` dùng `logger.info` — đồng nhất pattern. OK.**

### Positive

- `readTtlSeconds` edge-case coverage hoàn hảo (0/negative/NaN/valid)
- Dual-swallow pattern ở caller (`void writeCache(...).catch()`) đúng defensive mặc dù `writeCache` đã nuốt internally
- Message-order-sensitive hash test (L132-148) quan trọng, thường bị bỏ sót
- Migration có index `idx_llm_cache_expires_at` sẵn cho purge job Phase 4E.3
- Dark-launch env gate giống hệt Phase 4D Langfuse pattern — nhất quán

## Recommended Actions trước Phase 4E.2

1. **H-1 fix ngay:** Thêm `orgId` vào `CacheKey` + migration 0009 thêm `org_id` column. 15 phút, dark-launched nên zero risk.
2. **M-1 fix ngay:** Mở rộng `CacheKey` params. 10 phút.
3. **M-2:** Drop `hit_count` column khỏi schema (YAGNI) hoặc giữ + viết updater. 5 phút drop.

Cả 3 fix ~30 phút, block 4E.2 (embedding layer sẽ share `CacheKey` shape).

## Metrics

- Type coverage: 100% (không `:any`)
- Test coverage: 25 tests / 140 LOC = dense
- Lint: clean (đã pass CI Gate)
- LOC: tất cả file < 200 (llm-cache.ts = 140)
- Build: 14.6s, 0 errors
- 1148/1148 tests pass

## Unresolved Questions

1. Có kế hoạch purge job Phase 4E.3 runner schedule cụ thể chưa? Cron hay on-write eviction? Ảnh hưởng tới D1 row-cost sau vài tuần ở mức prod.
2. Có log Prometheus counter `llm_cache_hits_total` / `llm_cache_misses_total` cho observability không? Nếu không, làm sao verify 40-60% token reduction của PDF?
3. `createServerClient()` trong CF Workers có safe khi gọi outside request context (VD: fire-and-forget sau response gửi đi)? Nếu không, `void writeCache()` có thể drop trên CF Workers — cần test e2e.
