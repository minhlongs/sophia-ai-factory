# Creative Cell V1 — Sophia AI Factory

> Khả năng sáng tạo nội dung (image.generate) — Phase 1.
> / Creative capability (image.generate) — Phase 1.

---

## Kiến trúc / Architecture

Creative Cell là **execution plane** (bộ phận thực thi) trong kiến trúc Sophia.

Sophia (control plane) sở hữu: mission lifecycle, workflow orchestration, state, events, billing, user identity, budgets, quality gates.

Creative providers (execution plane) chỉ thực thi: gọi API tạo ảnh, trả về kết quả.

```
Sophia Mission → Inngest Job → Provider Adapter → Image Result → Result Gate → Event Bus
```

**Quy tắc:** Không tạo hệ thống mission engine, queue, hay event bus song song.

**Rules:** No parallel mission engine, queue, or event bus.

---

## Khả năng / Capability: `image.generate`

### Input

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `prompt` | string | ✅ | Prompt mô tả ảnh cần tạo |
| `negativePrompt` | string | ❌ | Prompt loại trừ |
| `aspectRatio` | `'1:1' \| '16:9' \| '9:16' \| '4:3'` | ❌ | Tỷ lệ khung hình (default: `16:9`) |
| `style` | string | ❌ | Phong cách ảnh |
| `seed` | number | ❌ | Số seed cho deterministic output |
| `idempotencyKey` | string | ❌ | Key chống trùng lặp |
| `constraints` | `CreativeConstraints` | ❌ | Ràng buộc tùy chỉnh |

### Output

`CreativeAsset` — bao gồm: id, jobId, url, mime, size, provider, promptHash, generatedAt.

### Flow

1. Kiểm tra idempotency (dùng `idempotencyKey` hoặc `jobId` làm key)
2. Kiểm tra circuit breaker (`shouldAllowRequest`)
3. Gọi provider adapter (`mock-image` trong V1)
4. Validate kết quả qua result gate
5. Lưu asset vào D1 database (`media_jobs` table)
6. Emit event `creative/image.completed` hoặc `creative/image.failed`

---

## Giao diện Provider Adapter / Provider Adapter Interface

```typescript
// src/seed/ai/image-generation-provider.ts
interface ImageGenerationProvider {
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
  capabilities(): ProviderCapabilities;
  health(): Promise<HealthStatus>;
}
```

V1 chỉ implement `MockImageGenerationProvider`. Không có provider thật.

V1 only implements `MockImageGenerationProvider`. No real providers.

### Thêm provider mới / Adding a new provider

1. Implement interface `ImageGenerationProvider`
2. Register vào `src/seed/ai/provider-registry.ts`
3. Circuit breaker tự động áp dụng

---

## Provider mô phỏng / Mock Provider

`MockImageGenerationProvider` hỗ trợ 3 chế độ:

| Mode | Behavior |
|---|---|
| `success` | Trả về ảnh mock (default) |
| `failure` | Throw lỗi `PROVIDER_ERROR` |
| `timeout` | Throw lỗi `PROVIDER_TIMEOUT` |

Không cần API key, OAuth, hay credentials bên ngoài.

No API keys, OAuth, or external credentials needed.

---

## Events

| Event | Khi nào |
|---|---|
| `creative/image.requested` | Khi job được tạo |
| `creative/image.completed` | Ảnh tạo thành công |
| `creative/image.failed` | Ảnh tạo thất bại |

---

## Kết quả / Result Gate

Kiểm tra tự động (deterministic, không AI scoring):

1. Kết quả tồn tại
2. Asset reference hợp lệ
3. MIME type là `image/*`
4. Size > 0
5. Provider status thành công

---

## Xử lý lỗi / Failure Handling

- Circuit breaker: `shouldAllowRequest` / `recordSuccess` / `recordFailure`
- Classification: `AUTH_FAILURE` → open ngay, `RATE_LIMIT` → cooldown, `SERVER_ERROR` → retry with backoff
- Max retries: 3
- Backoff: exponential (500ms base, jitter ±100ms)

---

## Idempotency

Yêu cầu có `idempotencyKey` hoặc `jobId`. Nếu asset đã tồn tại → trả về kết quả cũ, không tạo lại.

Duplicate requests return existing asset without regenerating.

---

## Testing

Tất cả test dùng Mock provider. Không credentials trong CI.

All tests use Mock provider. No credentials in CI.

| Loại test | Số lượng |
|---|---|
| Unit tests | 6 |
| Integration tests | 14 |
| **Tổng** | **20** |

---

## Hermes — KHÔNG tích hợp trong Phase 1

**Hermes is NOT integrated in Phase 1.**

Creative Cell V1 chỉ hoạt động với Mock provider. Hermes (OAuth-based provider) sẽ được tích hợp ở Phase 2 sau khi:
- OAuth flow được thiết kế
- Security audit hoàn tất
- Provider adapter được test với real API

---

## Mở rộng / Extension Points

- **Provider registry:** Thêm provider mới bằng cách implement `ImageGenerationProvider`
- **Result gate:** Có thể mở rộng với AI aesthetic scoring trong tương lai
- **Constraints:** Có thể thêm timeout, max cost, allowed MIME types tùy chỉnh
- **Events:** Có thể thêm `creative/image.updated` cho streaming progress

---

## Liên kết / Links

- Source: `src/forest/inngest/functions/creative-image-generate.ts`
- Provider interface: `src/seed/ai/image-generation-provider.ts`
- Mock provider: `src/seed/ai/providers/mock-image-generation-provider.ts`
- Types: `src/seed/types/creative-asset.ts`, `creative-constraints.ts`, `creative-job.ts`
- Tests: `src/forest/inngest/functions/__tests__/creative-image-generate*.test.ts`
