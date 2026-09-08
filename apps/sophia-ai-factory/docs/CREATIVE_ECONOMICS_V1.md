# Creative Economics V1 — Bilingual Reference

> SUPREME COMMAND #9 — Phase 13
> Bilingual: Vietnamese + English

## English

### Overview

Creative Economics V1 is the **minimum economic control loop** for Sophia's creative machine. It enables Sophia to answer 7 operational questions:

1. Is the provider working reliably?
2. How long does each creative job take?
3. How much does each job cost?
4. How much revenue is associated with usage?
5. What is the gross margin?
6. Which failures are operationally important?
7. When should Sophia stop routing traffic to a provider?

### Architecture

```
                SOPHIA CONTROL PLANE
                        │
              ┌─────────┴─────────┐
              │                   │
       CREATIVE MACHINE       ECONOMIC LOOP
              │                   │
            Fal.ai          Reliability
              │             Latency
              └──────┬──────┘
                     │
                     ▼
              JOB ECONOMICS
                     │
                     ▼
             Provider Health
           (OBSERVE → CLASSIFY → REPORT)
```

### Layer Map

| Layer | Files | Role |
|-------|-------|------|
| **seed** | `seed/types/creative-job-economics.ts` | Cost classification + error taxonomy + pure functions |
| **tree** | `tree/media-jobs/media-job-economics-query.ts` | Provider reliability metrics |
| **tree** | `tree/media-jobs/media-job-economics-aggregate.ts` | Provider economic aggregation |
| **tree** | `tree/media-jobs/provider-health-policy.ts` | Health classification (HEALTHY/DEGRADED/UNHEALTHY/INSUFFICIENT_DATA) |
| **tree** | `tree/media-jobs/error-category-mapper.ts` | FailureKind → ErrorCategory mapping |
| **tree** | `tree/media-jobs/economic-decision-formatter.ts` | Human-readable decision output |
| **land** | `app/api/v1/creative-studio/economics/route.ts` | GET endpoint (auth required, no secrets) |

### Cost Classification

| Classification | Meaning | Storage |
|----------------|---------|---------|
| `METERED` | Provider bills per job — cost is known | Numeric cost value |
| `UNMETERED` | Provider has no per-job meter (e.g. included in subscription) | `NULL` (not 0) |
| `UNKNOWN` | Cost cannot be reliably determined | `NULL` (not 0) |

**Critical rule:** `UNKNOWN` is stored as `NULL`, **never** as numeric zero. A zero implies a known free service — an unknown cost is different.

### Error Taxonomy

| Category | Meaning |
|----------|---------|
| `AUTH` | API key invalid, expired, or missing |
| `RATE_LIMIT` | Provider throttled the request |
| `TIMEOUT` | Request exceeded time limit |
| `PROVIDER` | Provider-side error (server crash, model unavailable) |
| `VALIDATION` | Input rejected by provider schema |
| `NETWORK` | Connection failed, DNS error |
| `INTERNAL` | Sophia-side bug |
| `UNKNOWN` | Failure type cannot be classified |

### Provider Health Policy

Health status is determined by reliability metrics over a time window:

| Status | Meaning |
|--------|---------|
| `HEALTHY` | Success rate ≥ 90%, failure rate ≤ 5%, p95 ≤ 15s |
| `DEGRADED` | Success rate < 90% OR failure rate > 5% OR p95 > 15s |
| `UNHEALTHY` | Success rate < 70% OR (success rate < 85% AND p95 > 30s) |
| `INSUFFICIENT_DATA` | Fewer than 10 jobs in window |

**Default thresholds** (configurable per-assessment):

```typescript
DEFAULT_HEALTH_POLICY = {
  minSampleSize: 10,
  unhealthySuccessRate: 70,
  unhealthyP95LatencyMs: 30000,
  degradedSuccessRate: 90,
  degradedP95LatencyMs: 15000,
  degradedFailureRate: 5,
}
```

### API Endpoint

**GET `/api/v1/creative-studio/economics`**

- Requires authentication (401 if not logged in)
- Read-only — no mutations
- Returns aggregated metrics per provider

Response shape:

```json
{
  "providers": [
    {
      "provider": "flux",
      "health": {
        "provider": "flux",
        "status": "HEALTHY",
        "reasons": ["All metrics within healthy thresholds"],
        "metrics": { "successRate": 95.0, "p95LatencyMs": 4200, ... },
        "assessedAt": 1725000000
      },
      "reliability": { "totalJobs": 150, "successRate": 95.0, ... },
      "economics": { "knownCostJobs": 140, "totalKnownProviderCost": 2800, ... }
    }
  ],
  "generatedAt": 1725000000
}
```

### Economic Truth Model

Sophia follows strict rules when computing financial metrics:

- **Gross margin is only calculated when BOTH cost AND revenue are known.**
- If cost is `NULL` (unknown/unmetered), gross margin is `NULL` — not a number.
- If revenue is `NULL`, gross margin is `NULL`.
- Data confidence levels guide interpretation:
  - `HIGH`: ≥ 100 jobs AND ≥ 80% of jobs have known cost
  - `MEDIUM`: ≥ 50 jobs
  - `LOW`: fewer than 50 jobs

### Data Retention & Privacy

See `creative-economics-data-retention.md` for full policy.

Key points:
- Telemetry stores **operational metrics only** (jobId, provider, status, latency, cost classification, error category).
- **Never stored**: full prompts, API keys, OAuth tokens, Authorization headers, personal data.
- Customer owns their job data. Sophia aggregates anonymized metrics only.

### Test Coverage

54 dedicated tests cover all phases:

| Test File | Coverage |
|-----------|----------|
| `seed/types/__tests__/creative-job-economics.test.ts` | Cost classification, gross margin, NULL handling |
| `tree/media-jobs/__tests__/media-job-economics-query.test.ts` | Success/failure rates, P50/P95, retry rate |
| `tree/media-jobs/__tests__/media-job-economics-aggregate.test.ts` | Economic aggregation, cost classification |
| `tree/media-jobs/__tests__/provider-health-policy.test.ts` | Health classification rules |
| `tree/media-jobs/__tests__/error-category-mapper.test.ts` | FailureKind → ErrorCategory mapping |
| `tree/media-jobs/__tests__/economic-decision-formatter.test.ts` | Output formatting, data confidence |

---

## Tiếng Việt

### Tổng quan

Creative Economics V1 là **vòng lặp kiểm soát kinh tế tối thiểu** cho máy sáng tạo của Sophia. Hệ thống giúp Sophia trả lời 7 câu hỏi vận hành:

1. Nhà cung cấp có đang hoạt động đáng tin không?
2. Mỗi job sáng tạo mất bao lâu?
3. Mỗi job tốn bao nhiêu chi phí?
4. Doanh thu liên quan đến việc sử dụng là bao nhiêu?
5. Biên lợi nhuận gộp là bao nhiêu?
6. Những lỗi nào quan trọng về mặt vận hành?
7. Khi nào Sophia nên ngừng điều hướng traffic đến nhà cung cấp?

### Kiến trúc

```
                MẶT PHẳNG KIỂM SOÁT SOPHIA
                        │
              ┌─────────┴─────────┐
              │                   │
       MÁY SÁNG TẠO         VÒNG LẶP KINH TẾ
              │                   │
            Fal.ai          Độ tin cậy
              │             Độ trễ
              └──────┬──────┘
                     │
                     ▼
              KINH TẾ JOB
                     │
                     ▼
             SỨC KHỎE NHÀ CUNG CẤP
           (QUAN SÁT → PHÂN LOẠI → BÁO CÁO)
```

### Bản đồ Layer

| Layer | File | Vai trò |
|-------|------|---------|
| **seed** | `seed/types/creative-job-economics.ts` | Phân loại chi phí + phân loại lỗi + hàm thuần |
| **tree** | `tree/media-jobs/media-job-economics-query.ts` | Chỉ số độ tin cậy nhà cung cấp |
| **tree** | `tree/media-jobs/media-job-economics-aggregate.ts` | Tổng hợp chỉ số kinh tế |
| **tree** | `tree/media-jobs/provider-health-policy.ts` | Phân loại sức khỏe (HEALTHY/DEGRADED/UNHEALTHY/INSUFFICIENT_DATA) |
| **tree** | `tree/media-jobs/error-category-mapper.ts` | Ánh xạ FailureKind → ErrorCategory |
| **tree** | `tree/media-jobs/economic-decision-formatter.ts` | Đầu ra quyết định dễ đọc |
| **land** | `app/api/v1/creative-studio/economics/route.ts` | Endpoint GET (cần auth, không lộ secret) |

### Phân loại Chi phí

| Phân loại | Ý nghĩa | Lưu trữ |
|-----------|---------|---------|
| `METERED` | Nhà cung cấp tính phí mỗi job — chi phí biết rõ | Giá trị số |
| `UNMETERED` | Nhà cung cấp không tính phí mỗi job (VD: trong gói subscription) | `NULL` (không phải 0) |
| `UNKNOWN` | Không thể xác định chi phí | `NULL` (không phải 0) |

**Quy tắc quan trọng:** `UNKNOWN` được lưu là `NULL`, **không bao giờ** là số không. Số không ngụ ý dịch vụ miễn phí biết rõ — chi phí không biết thì khác.

### Phân loại Lỗi

| Phân loại | Ý nghĩa |
|-----------|---------|
| `AUTH` | API key không hợp lệ, hết hạn, hoặc thiếu |
| `RATE_LIMIT` | Nhà cung cấp giới hạn request |
| `TIMEOUT` | Request vượt quá thời gian giới hạn |
| `PROVIDER` | Lỗi phía nhà cung cấp (server crash, model không khả dụng) |
| `VALIDATION` | Đầu vào bị từ chối bởi schema nhà cung cấp |
| `NETWORK` | Kết nối thất bại, lỗi DNS |
| `INTERNAL` | Lỗi phía Sophia |
| `UNKNOWN` | Không thể phân loại lỗi |

### Chính sách Sức khỏe Nhà cung cấp

Trạng thái sức khỏe được xác định bởi chỉ số độ tin cậy trong cửa sổ thời gian:

| Trạng thái | Ý nghĩa |
|------------|---------|
| `HEALTHY` | Tỷ lệ thành công ≥ 90%, tỷ lệ thất bại ≤ 5%, p95 ≤ 15s |
| `DEGRADED` | Tỷ lệ thành công < 90% HOẶC tỷ lệ thất bại > 5% HOẶC p95 > 15s |
| `UNHEALTHY` | Tỷ lệ thành công < 70% HOẶC (tỷ lệ thành công < 85% VÀ p95 > 30s) |
| `INSUFFICIENT_DATA` | Ít hơn 10 job trong cửa sổ |

**Ngưỡng mặc định** (cấu hình được cho mỗi đánh giá):

```typescript
DEFAULT_HEALTH_POLICY = {
  minSampleSize: 10,
  unhealthySuccessRate: 70,
  unhealthyP95LatencyMs: 30000,
  degradedSuccessRate: 90,
  degradedP95LatencyMs: 15000,
  degradedFailureRate: 5,
}
```

### API Endpoint

**GET `/api/v1/creative-studio/economics`**

- Cần xác thực (401 nếu chưa đăng nhập)
- Chỉ đọc — không thay đổi dữ liệu
- Trả về chỉ số tổng hợp cho mỗi nhà cung cấp

### Mô hình Sự thật Kinh tế

Sophia tuân theo các quy tắc nghiêm ngặt khi tính toán chỉ số tài chính:

- **Biên lợi nhuận gộp chỉ được tính khi CẢ chi phí VÀ doanh thu đều biết rõ.**
- Nếu chi phí là `NULL` (không biết/không tính mét), biên lợi nhuận là `NULL` — không phải số.
- Nếu doanh thu là `NULL`, biên lợi nhuận là `NULL`.
- Mức độ tin cậy dữ liệu hướng dẫn cách diễn giải:
  - `HIGH`: ≥ 100 job VÀ ≥ 80% job có chi phí biết rõ
  - `MEDIUM`: ≥ 50 job
  - `LOW`: ít hơn 50 job

### Lưu trữ Dữ liệu & Quyền riêng tư

Xem `creative-economics-data-retention.md` để biết chính sách đầy đủ.

Điểm chính:
- Telemetry chỉ lưu **chỉ số vận hành** (jobId, nhà cung cấp, trạng thái, độ trễ, phân loại chi phí, phân loại lỗi).
- **Không bao giờ lưu**: prompt đầy đủ, API key, OAuth token, Authorization header, dữ liệu cá nhân.
- Khách hàng sở hữu dữ liệu job của họ. Sophia chỉ tổng hợp chỉ số ẩn danh.

### Phạm vi Test

54 test chuyên biệt bao phủ tất cả các phase:

| File Test | Phạm vi |
|-----------|---------|
| `seed/types/__tests__/creative-job-economics.test.ts` | Phân loại chi phí, biên lợi nhuận, xử lý NULL |
| `tree/media-jobs/__tests__/media-job-economics-query.test.ts` | Tỷ lệ thành công/thất bại, P50/P95, tỷ lệ retry |
| `tree/media-jobs/__tests__/media-job-economics-aggregate.test.ts` | Tổng hợp kinh tế, phân loại chi phí |
| `tree/media-jobs/__tests__/provider-health-policy.test.ts` | Quy tắc phân loại sức khỏe |
| `tree/media-jobs/__tests__/error-category-mapper.test.ts` | Ánh xạ FailureKind → ErrorCategory |
| `tree/media-jobs/__tests__/economic-decision-formatter.test.ts` | Định dạng đầu ra, mức độ tin cậy dữ liệu |
