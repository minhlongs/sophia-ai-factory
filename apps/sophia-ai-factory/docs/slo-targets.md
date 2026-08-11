# SLO Targets — Sophia AI Factory

**Version:** 1.0  
**Effective:** 2026-08-11  
**Owner:** Platform Engineering  
**Review Cadence:** Monthly (first Monday)

---

## SLO Summary

| SLO Name | Target | Measurement Window | Alert Threshold |
|----------|--------|-------------------|-----------------|
| Availability | ≥ 99.5% monthly | Calendar month | Burn rate > 2× (budget consumed > 1%/mo) |
| API Latency p95 | < 800 ms | Calendar month | p95 > 800 ms sustained 5 min |
| Health Latency p95 | < 500 ms | Calendar month | p95 > 500 ms sustained 5 min |
| Webhook Delivery p95 | < 5 min | Calendar month | p95 > 5 min sustained 5 min |
| Error Rate | < 1% | Calendar month | Error rate > 1% sustained 5 min |

---

## Route Classification

| Category | Routes | SLO Applied |
|----------|--------|-------------|
| **API** | `/api/*` (excl. health, version) | Availability, API Latency p95, Error Rate |
| **Health** | `/api/health`, `/api/version` | Availability, Health Latency p95 |
| **Webhook — NOWPayments** | `/webhook/nowpayments` | Webhook Delivery p95, Error Rate |
| **Webhook — ClickBank** | `/webhook/clickbank` | Webhook Delivery p95, Error Rate |
| **Webhook — Telegram** | `/webhook/telegram` | Webhook Delivery p95, Error Rate |
| **Webhook — D-ID** | `/webhook/did` | Webhook Delivery p95, Error Rate |
| **Webhook — HeyGen** | `/webhook/heygen` | Webhook Delivery p95, Error Rate |
| **Dashboard** | `/dashboard/*` | Availability, API Latency p95 |

---

## Measurement Methodology

- **Availability**: (2xx + 3xx responses) / all responses  
  *Excludes 4xx (client errors), includes 5xx (server errors)*
- **Latency**: Measured at Worker edge (request entry → response sent)  
  *Includes cold starts, D1 latency, external API calls*
- **Error Rate**: 5xx responses / all responses
- **Webhook Delivery**: Timestamp from webhook received → downstream ACK / processing complete

---

## Error Budget Calculation

| SLO | Target | Monthly Budget | Burn Rate Formula |
|-----|--------|----------------|-------------------|
| Availability | 99.5% | 0.5% × total_requests | `bad_requests / (0.005 × total_requests)` |
| Error Rate | 1% | 1% × total_requests | `5xx_count / (0.01 × total_requests)` |
| Latency | p95 < threshold | N/A (indicator) | `p95_measured / threshold` |

**Alert Levels:**
- **Info**: burn_rate > 0.5× (50% budget consumed)
- **Warning**: burn_rate > 1× (budget exhausted)
- **Critical**: burn_rate > 2× (2× budget consumed)
- **Emergency**: burn_rate > 5× (severe degradation)

---

## Exclusions

- Scheduled maintenance windows (published 48h advance)
- Client-side errors (4xx) — not counted in availability/error rate
- DDoS attack traffic (identified via CF WAF)
- Local development / preview deployments

---

## Escalation

| Alert Level | Response Time | Escalation |
|-------------|---------------|------------|
| Info | 4 hours | Log, review at next standup |
| Warning | 1 hour | Page on-call, investigate |
| Critical | 15 min | Page on-call + team lead, incident bridge |
| Emergency | 5 min | Page on-call + team lead + CTO, incident bridge |

---

## Related Documents

- **Runbook: SLO Burn Rate** — `docs/runbooks/slo-burn-rate.md`
- **Runbook: SLO Incident Response** — `docs/runbooks/slo-incident-response.md`
- **Architecture** — `docs/system-architecture.md`
- **Migration** — `src/seed/db/migrations/0039_slo_burn.sql`

---

## Mục tiêu SLO — Sophia AI Factory

**Phiên bản:** 1.0  
**Hiệu lực:** 2026-08-11  
**Chủ sở hữu:** Kỹ thuật nền tảng  
**Chu kỳ xem xét:** Hàng tháng (Thứ 2 đầu tiên)

---

## Tóm tắt SLO

| Tên SLO | Mục tiêu | Cửa sổ đo lưỡng | Ngưỡng cảnh báo |
|---------|----------|----------------|----------------|
| Tính khả dụng | ≥ 99.5% hàng tháng | Tháng lịch | Tỷ lệ tiêu hao > 2× (ngân sách tiêu hao > 1%/tháng) |
| Độ trễ API p95 | < 800 ms | Tháng lịch | p95 > 800 ms duy trì 5 phút |
| Độ trễ Health p95 | < 500 ms | Tháng lịch | p95 > 500 ms duy trì 5 phút |
| Giao webhook p95 | < 5 phút | Tháng lịch | p95 > 5 phút duy trì 5 phút |
| Tỷ lệ lỗi | < 1% | Tháng lịch | Tỷ lệ lỗi > 1% duy trì 5 phút |

---

## Phân loại tuyến đường

| Danh mục | Tuyến đường | SLO áp dụng |
|----------|-------------|-------------|
| **API** | `/api/*` (trừ health, version) | Khả dụng, Độ trễ API p95, Tỷ lệ lỗi |
| **Health** | `/api/health`, `/api/version` | Khả dụng, Độ trễ Health p95 |
| **Webhook — NOWPayments** | `/webhook/nowpayments` | Giao webhook p95, Tỷ lệ lỗi |
| **Webhook — ClickBank** | `/webhook/clickbank` | Giao webhook p95, Tỷ lệ lỗi |
| **Webhook — Telegram** | `/webhook/telegram` | Giao webhook p95, Tỷ lệ lỗi |
| **Webhook — D-ID** | `/webhook/did` | Giao webhook p95, Tỷ lệ lỗi |
| **Webhook — HeyGen** | `/webhook/heygen` | Giao webhook p95, Tỷ lệ lỗi |
| **Dashboard** | `/dashboard/*` | Khả dụng, Độ trễ API p95 |

---

## Phương pháp đo lường

- **Khả dụng**: (Phản hồi 2xx + 3xx) / tất cả phản hồi  
  *Loại trừ 4xx (lỗi khách), bao gồm 5xx (lỗi máy chủ)*
- **Độ trễ**: Được đo tại Worker edge (nhập request → gửi phản hồi)  
  *Bao gồm cold start, độ trễ D1, gọi API bên ngoài*
- **Tỷ lệ lỗi**: Phản hồi 5xx / tất cả phản hồi
- **Giao webhook**: Dấu thời gian từ webhook nhận được → ACK / xử lý hoàn tất bên dưới

---

## Tính toán ngân sách lỗi

| SLO | Mục tiêu | Ngân sách hàng tháng | Công thức tỷ lệ tiêu hao |
|-----|----------|---------------------|-------------------------|
| Khả dụng | 99.5% | 0.5% × tổng_request | `bad_requests / (0.005 × total_requests)` |
| Tỷ lệ lỗi | 1% | 1% × tổng_request | `5xx_count / (0.01 × total_requests)` |
| Độ trễ | p95 < ngưỡng | N/A (chỉ báo) | `p95_measured / threshold` |

**Mức cảnh báo:**
- **Thông tin**: burn_rate > 0.5× (50% ngân sách đã tiêu hao)
- **Cảnh báo**: burn_rate > 1× (ngân sách đã cạn)
- **Nghiêm trọng**: burn_rate > 2× (2× ngân sách đã tiêu hao)
- **Khẩn cấp**: burn_rate > 5× (suy giảm nghiêm trọng)

---

## Loại trừ

- Cửa sổ bảo trì đã lên lịch (công bố trước 48h)
- Lỗi phía khách (4xx) — không tính vào khả dụng/tỷ lệ lỗi
- Lưu lượng tấn công DDoS (xác định qua CF WAF)
- Phát triển cục bộ / triển khai preview

---

## Thăng cấp

| Mức cảnh báo | Thời gian phản ứng | Thăng cấp |
|-------------|-------------------|-----------|
| Thông tin | 4 giờ | Ghi log, xem xét ở standup tiếp theo |
| Cảnh báo | 1 giờ | Gọi người trực, điều tra |
| Nghiêm trọng | 15 phút | Gọi người trực + team lead, cầu nối sự cố |
| Khẩn cấp | 5 phút | Gọi người trực + team lead + CTO, cầu nối sự cố |

---

## Tài liệu liên quan

- **Runbook: Tỷ lệ tiêu hao SLO** — `docs/runbooks/slo-burn-rate.md`
- **Runbook: Phản hồi sự cố SLO** — `docs/runbooks/slo-incident-response.md`
- **Kiến trúc** — `docs/system-architecture.md`
- **Migration** — `src/seed/db/migrations/0039_slo_burn.sql`