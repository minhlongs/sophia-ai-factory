# Creative Economics — Data Retention & Privacy

> SUPREME COMMAND #9 — Phase 8
> Bilingual: Vietnamese + English

## English

### What telemetry does Sophia store?

The creative economics system stores **operational metrics** for each media job:

| Field | Description |
|-------|-------------|
| `jobId` | Unique job identifier |
| `provider` | AI model / provider used (e.g. "flux", "elevenlabs") |
| `status` | Job outcome: pending, completed, failed |
| `latency` | Processing time in milliseconds |
| `cost_classification` | METERED / UNKNOWN / UNMETERED |
| `error_category` | Failure type (if job failed) |

### What telemetry does Sophia **NOT** store?

The following are **never** stored in the economics system:

- Full prompts (only a reference ID is kept)
- API keys (OpenRouter, ElevenLabs, D-ID, HeyGen)
- OAuth tokens
- Authorization headers
- Personal data (name, email, payment info)

### Data ownership

- **Customer owns their job data.** All media job records belong to the customer who created them.
- **Sophia aggregates anonymized metrics.** Provider health and economic metrics are computed from aggregated, de-identified data — no single customer's data is exposed to others.

### Retention policy

- **D1 rows** are retained indefinitely as customer-facing job history.
- **Aggregate metrics** (provider health, success rates, costs) are derived on-read from the raw rows — no separate aggregate store exists.
- Customers can delete their own job data via account deletion (GDPR).

---

## Tiếng Việt

### Sophia lưu trữ dữ liệu telemetry nào?

Hệ thống kinh tế sáng tạo lưu trữ **chỉ số vận hành** cho mỗi media job:

| Trường | Mô tả |
|--------|-------|
| `jobId` | Mã định danh duy nhất của job |
| `provider` | Mô hình / nhà cung cấp AI (VD: "flux", "elevenlabs") |
| `status` | Kết quả job: đang chờ, hoàn thành, thất bại |
| `latency` | Thời gian xử lý (mili-giây) |
| `cost_classification` | METERED / UNKNOWN / UNMETERED |
| `error_category` | Loại lỗi (nếu job thất bại) |

### Sophia **KHÔNG** lưu trữ điều gì?

Các dữ liệu sau **không bao giờ** được lưu trữ trong hệ thống kinh tế:

- Prompt đầu đủ (chỉ lưu mã tham chiếu)
- API key (OpenRouter, ElevenLabs, D-ID, HeyGen)
- OAuth token
- Authorization header
- Dữ liệu cá nhân (tên, email, thông tin thanh toán)

### Quyền sở hữu dữ liệu

- **Khách hàng sở hữu dữ liệu job của họ.** Tất cả media job thuộc về khách hàng đã tạo ra chúng.
- **Sophia tổng hợp chỉ số ẩn danh.** Chỉ số sức khỏe nhà cung cấp và chỉ số kinh tế được tính từ dữ liệu tổng hợp, không trình danh — dữ liệu của một khách hàng không bị lộ cho người khác.

### Chính sách lưu trữ

- **Dòng dữ liệu D1** được lưu giữ vô thời hạn làm lịch sử job mà khách hàng có xem.
- **Chỉ số tổng hợp** (sức khỏe nhà cung cấp, tỷ lệ thành công, chi phí) được tính lúc đọc từ dữ liệu thô — không có kho lưu trữ tổng hợp riêng.
- Khách hàng có thể xóa dữ liệu job của riêng họ qua xóa tài khoản (GDPR).
