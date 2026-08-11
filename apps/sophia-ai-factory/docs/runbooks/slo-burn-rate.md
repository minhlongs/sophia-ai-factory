# Runbook: SLO Burn Rate Investigation

**Version:** 1.0  
**Last Updated:** 2026-08-11  
**Owner:** Platform Engineering

---

## Overview

This runbook guides investigation when SLO burn-rate alerts fire. Burn rate measures how fast we're consuming our error budget relative to the SLO target.

## SLO Targets & Error Budgets

| SLO | Target | Monthly Error Budget | Burn Rate Formula |
|-----|--------|---------------------|-------------------|
| Availability | ≥ 99.5% | 0.5% × total_requests | `bad_requests / (0.005 × total_requests)` |
| Error Rate | < 1% | 1% × total_requests | `5xx_count / (0.01 × total_requests)` |
| API Latency p95 | < 800ms | N/A (indicator) | `p95_measured / 800` |
| Health Latency p95 | < 500ms | N/A (indicator) | `p95_measured / 500` |
| Webhook Delivery p95 | < 5 min | N/A (indicator) | `p95_measured / 300000` |

## Alert Levels & Response

| Alert Level | Burn Rate | Meaning | Response Time | Escalation |
|-------------|-----------|---------|---------------|------------|
| **Info** | > 0.5× | 50% budget consumed | 4 hours | Log, review at next standup |
| **Warning** | > 1× | Budget exhausted | 1 hour | Page on-call, investigate |
| **Critical** | > 2× | 2× budget consumed | 15 min | Page on-call + team lead, incident bridge |
| **Emergency** | > 5× | Severe degradation | 5 min | Page on-call + team lead + CTO, incident bridge |

---

## Investigation Steps

### 1. Acknowledge Alert
```bash
# Check current month burn rates
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sophia.agencyos.network/api/cron/slo-burn-rate
```

### 2. Identify Affected SLO
From the alert, note:
- `slo_name`: Which SLO (availability, error_rate, api_latency_p95, etc.)
- `burn_rate`: Current burn rate multiplier
- `alert_level`: info/warning/critical/emergency
- `period`: Time window (usually '1m' for monthly)

### 3. Check Real-Time Metrics (Sentry)
1. Open Sentry dashboard → Metrics → Custom Metrics
2. Filter by `sophia.slo.*`
3. Look for:
   - `sophia.slo.availability` (ratio)
   - `sophia.slo.error.rate` (ratio)
   - `sophia.slo.latency.p95` (millisecond)
   - `sophia.slo.burn_rate` (ratio)
   - `sophia.slo.alert.fired` (count)

### 4. Check Workers Analytics Engine
```sql
-- In Cloudflare Dashboard → Workers Analytics Engine → sophia_slo_metrics
SELECT
  route,
  quantile(0.95)(durationMs) as p95,
  countIf(isError) / count() as error_rate,
  count() as total
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY route
ORDER BY error_rate DESC
```

### 5. Check D1 slo_burn Table
```sql
-- Current month burn rates
SELECT * FROM v_slo_current_month;

-- Historical view
SELECT slo_name, year_month, burn_rate, alert_level, measured_value, metadata
FROM slo_burn
WHERE year_month >= strftime('%Y-%m', 'now', '-3 months')
ORDER BY year_month DESC, slo_name;
```

### 6. Correlate with Recent Changes
- Check deployment log: `git log --oneline -20`
- Check if deploy happened near alert time: `/api/version` shortSha
- Recent config changes: feature flags, rate limits, new routes

### 7. Common Root Causes by SLO

#### Availability < 99.5%
- **D1 connection issues** — Check D1 error rate in Cloudflare logs
- **External API failures** — OpenRouter, ElevenLabs, D-ID, NOWPayments
- **Worker CPU time exceeded** — Check `cpu_time_ms` in WAE
- **Cold starts spike** — New deploy causing cache misses

#### Error Rate > 1%
- **5xx from upstream** — Check `wrangler tail` for stack traces
- **Validation errors** — New schema changes without migration
- **Rate limiting** — Auth rate limiter too aggressive

#### API Latency p95 > 800ms
- **D1 slow queries** — Check query plans, missing indexes
- **External API latency** — AI service calls timing out
- **Cold starts** — New isolate spin-up
- **Large payloads** — Video metadata, base64 images

#### Health Latency p95 > 500ms
- **D1 health check query slow** — Usually indicates D1 contention
- **KV cache misses** — Check KV latency

#### Webhook Delivery p95 > 5 min
- **Webhook handler queue backed up** — Check Inngest function queue
- **Downstream service slow** — Payment provider, Telegram, D-ID webhook
- **Retry storms** — Failed deliveries retrying

---

## Remediation Actions

### Immediate (for Critical/Emergency)
1. **Rollback recent deploy** if correlation found:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --message "SLO breach rollback" --yes
   ```
2. **Scale up / restart** — Not applicable for Workers (auto-scales)
3. **Disable problematic feature** — Feature flag if available
4. **Increase timeout/retries** — For external API calls

### Short-term (within 1 hour)
1. **Add database index** if query identified
2. **Adjust rate limits** if false positives
3. **Fix validation bug** if schema mismatch
4. **Optimize slow query** in D1

### Long-term (post-incident)
1. **Post-mortem** within 48 hours
2. **Update SLO targets** if unrealistic
3. **Add capacity** (not applicable for serverless)
4. **Improve observability** — Add more granular metrics

---

## Useful Queries

### Top error routes (last hour)
```sql
SELECT route, status, count() as cnt
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
  AND isErrorFlag = 1
GROUP BY route, status
ORDER BY cnt DESC
LIMIT 20;
```

### Latency by route (last hour)
```sql
SELECT
  route,
  quantile(0.50)(durationMs) as p50,
  quantile(0.95)(durationMs) as p95,
  quantile(0.99)(durationMs) as p99,
  count() as requests
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY route
ORDER BY p95 DESC;
```

### Monthly burn rate trend
```sql
SELECT slo_name, year_month, burn_rate, alert_level
FROM slo_burn
WHERE year_month >= strftime('%Y-%m', 'now', '-6 months')
ORDER BY year_month, slo_name;
```

---

## Escalation Contacts

| Role | Contact | When |
|------|---------|------|
| On-call Engineer | @platform-oncall (Telegram) | Warning+ |
| Team Lead | @team-lead (Telegram) | Critical+ |
| CTO | @cto (Telegram) | Emergency |
| Platform Channel | #platform-eng (Telegram) | All levels |

---

## Related Documents

- **SLO Targets** — `docs/slo-targets.md`
- **SLO Incident Response** — `docs/runbooks/slo-incident-response.md`
- **Architecture** — `docs/system-architecture.md`
- **Migration** — `src/seed/db/migrations/0039_slo_burn.sql`

---

## Runbook: SLO Burn Rate Investigation (VN)

**Phiên bản:** 1.0  
**Cập nhật:** 2026-08-11  
**Chủ sở hữu:** Kỹ thuật nền tảng

---

## Tổng quan

Runbook này hướng dẫn điều tra khi cảnh báo tỷ lệ tiêu hao SLO (burn-rate) được kích hoạt. Tỷ lệ tiêu hao đo lường tốc độ tiêu hao ngân sách lỗi so với mục tiêu SLO.

## Mục tiêu SLO & Ngân sách lỗi

| SLO | Mục tiêu | Ngân sách hàng tháng | Công thức tỷ lệ tiêu hao |
|-----|----------|---------------------|-------------------------|
| Khả dụng | ≥ 99.5% | 0.5% × tổng_request | `bad_requests / (0.005 × total_requests)` |
| Tỷ lệ lỗi | < 1% | 1% × tổng_request | `5xx_count / (0.01 × total_requests)` |
| Độ trễ API p95 | < 800ms | N/A (chỉ báo) | `p95_measured / 800` |
| Độ trễ Health p95 | < 500ms | N/A (chỉ báo) | `p95_measured / 500` |
| Giao webhook p95 | < 5 phút | N/A (chỉ báo) | `p95_measured / 300000` |

## Mức cảnh báo & Phản ứng

| Mức cảnh báo | Tỷ lệ tiêu hao | Ý nghĩa | Thời gian phản ứng | Thăng cấp |
|-------------|---------------|---------|-------------------|-----------|
| **Thông tin** | > 0.5× | 50% ngân sách đã tiêu hao | 4 giờ | Ghi log, xem xét ở standup tiếp theo |
| **Cảnh báo** | > 1× | Ngân sách đã cạn | 1 giờ | Gọi người trực, điều tra |
| **Nghiêm trọng** | > 2× | 2× ngân sách đã tiêu hao | 15 phút | Gọi người trực + team lead, cầu nối sự cố |
| **Khẩn cấp** | > 5× | Suy giảm nghiêm trọng | 5 phút | Gọi người trực + team lead + CTO, cầu nối sự cố |

---

## Các bước điều tra

### 1. Xác nhận cảnh báo
```bash
# Kiểm tra tỷ lệ tiêu hao tháng hiện tại
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sophia.agencyos.network/api/cron/slo-burn-rate
```

### 2. Xác định SLO bị ảnh hưởng
Từ cảnh báo, ghi chú:
- `slo_name`: SLO nào (availability, error_rate, api_latency_p95, etc.)
- `burn_rate`: Hệ số tỷ lệ tiêu hao hiện tại
- `alert_level`: info/warning/critical/emergency
- `period`: Cửa sổ thời gian (thường '1m' cho hàng tháng)

### 3. Kiểm tra Metrics thời gian thực (Sentry)
1. Mở Sentry dashboard → Metrics → Custom Metrics
2. Lọc theo `sophia.slo.*`
3. Tìm:
   - `sophia.slo.availability` (ratio)
   - `sophia.slo.error.rate` (ratio)
   - `sophia.slo.latency.p95` (millisecond)
   - `sophia.slo.burn_rate` (ratio)
   - `sophia.slo.alert.fired` (count)

### 4. Kiểm tra Workers Analytics Engine
```sql
-- Trong Cloudflare Dashboard → Workers Analytics Engine → sophia_slo_metrics
SELECT
  route,
  quantile(0.95)(durationMs) as p95,
  countIf(isError) / count() as error_rate,
  count() as total
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY route
ORDER BY error_rate DESC
```

### 5. Kiểm tra bảng D1 slo_burn
```sql
-- Tỷ lệ tiêu hao tháng hiện tại
SELECT * FROM v_slo_current_month;

-- Xem lịch sử
SELECT slo_name, year_month, burn_rate, alert_level, measured_value, metadata
FROM slo_burn
WHERE year_month >= strftime('%Y-%m', 'now', '-3 months')
ORDER BY year_month DESC, slo_name;
```

### 6. Tương quan với thay đổi gần đây
- Kiểm tra log deploy: `git log --oneline -20`
- Kiểm tra deploy gần thời điểm cảnh báo: `/api/version` shortSha
- Thay đổi config gần đây: feature flags, rate limits, routes mới

### 7. Nguyên nhân phổ biến theo SLO

#### Khả dụng < 99.5%
- **Vấn đề kết nối D1** — Kiểm tra tỷ lệ lỗi D1 trong Cloudflare logs
- **Lỗi API bên ngoài** — OpenRouter, ElevenLabs, D-ID, NOWPayments
- **Worker vượt CPU time** — Kiểm tra `cpu_time_ms` trong WAE
- **Cold starts tăng** — Deploy mới gây cache miss

#### Tỷ lệ lỗi > 1%
- **5xx từ upstream** — Kiểm tra `wrangler tail` cho stack traces
- **Lỗi validation** — Thay đổi schema mới không có migration
- **Rate limiting** — Auth rate limiter quá chặt

#### Độ trễ API p95 > 800ms
- **D1 query chậm** — Kiểm tra query plans, thiếu indexes
- **Độ trễ API bên ngoài** — Gọi AI service timeout
- **Cold starts** — Spin-up isolate mới
- **Payload lớn** — Metadata video, ảnh base64

#### Độ trễ Health p95 > 500ms
- **D1 health check query chậm** — Thường chỉ ra contention D1
- **KV cache miss** — Kiểm tra độ trễ KV

#### Giao webhook p95 > 5 phút
- **Queue webhook handler bị chậm** — Kiểm tra Inngest function queue
- **Dịch vụ downstream chậm** — Payment provider, Telegram, D-ID webhook
- **Retry storms** — Giao thất bại retry liên tục

---

## Hành động khắc phục

### Ngay lập tức (cho Critical/Emergency)
1. **Rollback deploy gần đây** nếu tìm thấy tương quan:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --message "SLO breach rollback" --yes
   ```
2. **Tắt tính năng gây vấn đề** — Feature flag nếu có
3. **Tăng timeout/retry** — Cho gọi API bên ngoài

### Ngắn hạn (trong 1 giờ)
1. **Thêm database index** nếu xác định query
2. **Điều chỉnh rate limits** nếu false positives
3. **Sửa bug validation** nếu schema mismatch
4. **Tối ưu query chậm** trong D1

### Dài hạn (sau sự cố)
1. **Post-mortem** trong 48 giờ
2. **Cập nhật SLO targets** nếu không thực tế
3. **Cải thiện observability** — Thêm metrics chi tiết hơn

---

## Truy vấn hữu ích

### Top routes lỗi (giờ vừa qua)
```sql
SELECT route, status, count() as cnt
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
  AND isErrorFlag = 1
GROUP BY route, status
ORDER BY cnt DESC
LIMIT 20;
```

### Độ trễ theo route (giờ vừa qua)
```sql
SELECT
  route,
  quantile(0.50)(durationMs) as p50,
  quantile(0.95)(durationMs) as p95,
  quantile(0.99)(durationMs) as p99,
  count() as requests
FROM sophia_slo_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY route
ORDER BY p95 DESC;
```

### Xu hướng tỷ lệ tiêu hao hàng tháng
```sql
SELECT slo_name, year_month, burn_rate, alert_level
FROM slo_burn
WHERE year_month >= strftime('%Y-%m', 'now', '-6 months')
ORDER BY year_month, slo_name;
```

---

## Liên hệ thăng cấp

| Vai trò | Liên hệ | Khi nào |
|--------|---------|---------|
| Kỹ sư trực | @platform-oncall (Telegram) | Warning+ |
| Team Lead | @team-lead (Telegram) | Critical+ |
| CTO | @cto (Telegram) | Emergency |
| Kênh Platform | #platform-eng (Telegram) | Tất cả mức |

---

## Tài liệu liên quan

- **Mục tiêu SLO** — `docs/slo-targets.md`
- **Phản hồi sự cố SLO** — `docs/runbooks/slo-incident-response.md`
- **Kiến trúc** — `docs/system-architecture.md`
- **Migration** — `src/seed/db/migrations/0039_slo_burn.sql`