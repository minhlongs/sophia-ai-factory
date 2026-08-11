# Runbook: SLO Incident Response

**Version:** 1.0  
**Last Updated:** 2026-08-11  
**Owner:** Platform Engineering

---

## Overview

This runbook defines the incident response process when SLO violations are detected. It complements the **SLO Burn Rate Investigation** runbook with specific procedures for incident declaration, communication, and resolution.

## Incident Severity Matrix

| Severity | SLO Condition | Response Time | Communication |
|----------|---------------|---------------|---------------|
| **SEV-1** (Critical) | Emergency burn rate (>5×) OR Availability < 99% | 5 min | Page on-call + team lead + CTO, incident bridge, status page |
| **SEV-2** (Major) | Critical burn rate (>2×) OR Error rate > 5% | 15 min | Page on-call + team lead, incident bridge |
| **SEV-3** (Minor) | Warning burn rate (>1×) OR Latency sustained > threshold | 1 hour | Page on-call, Slack/Telegram notification |
| **SEV-4** (Info) | Info burn rate (>0.5×) OR Single metric spike | 4 hours | Log, review at standup |

---

## Incident Response Flow

```
┌─────────────────────┐
│   Alert Fired       │
│   (Sentry/Telegram) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Acknowledge        │ ◄── 5 min for SEV-1/2
│  (assign owner)     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Declare Incident   │
│  (severity + title) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Investigate        │ ◄── Follow Burn Rate Runbook
│  (root cause)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Mitigate           │
│  (stop the bleeding)│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Resolve            │
│  (fix root cause)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Post-Mortem        │
│  (within 48h)       │
└─────────────────────┘
```

---

## Step-by-Step Procedures

### 1. Alert Acknowledgment (T+0 to T+5min)

**On-call receives alert** via:
- PagerDuty / OpsGenie (if configured)
- Telegram @Sophia_Bbot (configured webhook)
- Email to oncall@sophia.agencyos.network

**Actions:**
1. Acknowledge in alerting system
2. Post in `#platform-eng` (Telegram): "🔴 ACK: <alert name> - investigating"
3. Assign incident commander (usually on-call)
4. Start incident timer

### 2. Incident Declaration (T+5min)

**Create incident record:**
- **Title**: `[SEV-X] <SLO name> breach - <brief description>`
- **Severity**: SEV-1 through SEV-4 per matrix above
- **Commander**: @oncall
- **Channel**: Create Telegram group "incident-<date>-<slo>" or use `#platform-eng` thread

**Template:**
```
🚨 INCIDENT DECLARED
Title: [SEV-2] Availability breach - API returning 5xx
Severity: SEV-2 (Major)
Commander: @engineer-name
Started: 2026-08-11 14:32 UTC
SLO: Availability (target ≥99.5%, current 98.7%)
Burn Rate: 2.3x (Critical)
Affected Routes: /api/*, /webhook/*
```

### 3. Investigation (T+5min to T+30min)

Follow **SLO Burn Rate Investigation** runbook:
1. Check Sentry custom metrics (`sophia.slo.*`)
2. Query WAE for real-time route-level data
3. Check D1 `slo_burn` table for monthly trend
4. Correlate with recent deployments
5. Check `wrangler tail` for error patterns

**Key questions:**
- Is this a single route or platform-wide?
- Did a deploy happen in the last 30 min?
- Are external dependencies (OpenRouter, NOWPayments, D-ID) healthy?
- Is D1/KV showing elevated errors/latency?

### 4. Mitigation (T+30min to T+1h)

**Goal**: Stop the bleeding, restore SLO compliance

**Common mitigations:**

| Issue | Mitigation |
|-------|------------|
| Bad deploy | `npx wrangler rollback --name sophia-ai-factory --message "SLO incident rollback" --yes` |
| External API down | Enable circuit breaker / fallback / cached responses |
| D1 contention | Reduce query complexity, add index, check for runaway query |
| Rate limiter too aggressive | Increase limits, add allowlist for critical paths |
| Webhook queue backed up | Scale Inngest (auto), pause non-critical webhooks |
| Cold start storm | Pre-warm critical routes (not available in Workers) |

**Document every action** in incident channel with timestamp.

### 5. Resolution (T+1h to T+4h)

**Goal**: Fix root cause permanently

**Process:**
1. Identify root cause (code bug, config, dependency, capacity)
2. Implement fix (hotfix deploy, config change, external escalation)
3. Verify SLO recovery via Sentry/WAE
4. Monitor for 30 min post-fix
5. Declare resolved

**Resolution message:**
```
✅ INCIDENT RESOLVED
Title: [SEV-2] Availability breach - API returning 5xx
Duration: 47 minutes
Root Cause: NOWPayments webhook handler throwing on malformed payload
Fix: Added payload validation + graceful error handling (commit abc123)
SLO Recovery: Availability restored to 99.8% at 15:19 UTC
Post-Mortem: Scheduled for 2026-08-12 10:00 UTC
```

### 6. Post-Mortem (Within 48 hours)

**Template:** `docs/postmortems/YYYY-MM-DD-<slug>.md`

**Required sections:**
1. **Summary** — What happened, impact, duration
2. **Timeline** — Key events with timestamps
3. **Root Cause** — 5 Whys analysis
4. **Impact** — Users affected, revenue/business impact
5. **What Went Well** — Detection, mitigation, teamwork
6. **What Went Wrong** — Gaps in observability, process, code
7. **Action Items** — Specific, assigned, dated

**Action item format:**
- `[ ] [P0] Add request_logs table for perf:check` — @engineer — 2026-08-18
- `[ ] [P1] Circuit breaker for NOWPayments webhook` — @engineer — 2026-08-25
- `[ ] [P2] Improve cold start observability` — @engineer — 2026-09-01

**Review:** Post-mortem reviewed in platform standup, action items added to sprint.

---

## Communication Templates

### Internal (Telegram #platform-eng)
```
🔴 INCIDENT [SEV-2] API Availability
Commander: @alice
Started: 14:32 UTC
SLO: Availability 98.7% (target 99.5%)
Burn Rate: 2.3x
Status: INVESTIGATING
```

### Status Page (if customer-facing impact)
```
Title: Degraded API Performance
Status: Investigating
Message: We're investigating elevated error rates on API endpoints. Some requests may fail. Updates every 15 min.
```

### Customer Notification (if SEV-1, >30 min)
- Email to affected tier customers (ENTERPRISE/MASTER)
- In-app banner via feature flag
- Telegram broadcast to @Sophia_Bbot subscribers

---

## Escalation Policies

| Time Elapsed | SEV-1 | SEV-2 | SEV-3 | SEV-4 |
|--------------|-------|-------|-------|-------|
| 5 min | Page CTO | — | — | — |
| 15 min | — | Page Team Lead | — | — |
| 30 min | Incident Bridge | Incident Bridge | — | — |
| 1 hour | Executive Update | Page On-call (if not responding) | Page On-call | — |
| 2 hours | Customer Comms | Customer Comms (if SEV-2) | — | Log only |
| 4 hours | — | — | Escalate to SEV-2 | Review at standup |

---

## Tooling Quick Reference

| Task | Command / Link |
|------|----------------|
| View current burn rates | `curl -H "Auth: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/slo-burn-rate` |
| Sentry Metrics | https://sentry.io/org/sophia/metrics/ |
| WAE Dashboard | Cloudflare Dashboard → Workers Analytics → sophia_slo_metrics |
| D1 Query | `npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM v_slo_current_month" --remote` |
| Deploy Status | `curl https://sophia.agencyos.network/api/version` |
| Rollback | `npx wrangler rollback --name sophia-ai-factory --message "reason" --yes` |
| Live Logs | `npx wrangler tail sophia-ai-factory --format=pretty` |
| Inngest Dashboard | https://app.inngest.com/ (if configured) |

---

## Related Documents

- **SLO Targets** — `docs/slo-targets.md`
- **SLO Burn Rate Investigation** — `docs/runbooks/slo-burn-rate.md`
- **Architecture** — `docs/system-architecture.md`
- **Deployment Verification** — `.claude/rules/sophia-deploy-verify.md`

---

## Runbook: SLO Incident Response (VN)

**Phiên bản:** 1.0  
**Cập nhật:** 2026-08-11  
**Chủ sở hữu:** Kỹ thuật nền tảng

---

## Tổng quan

Runbook này định nghĩa quy trình phản hồi sự cố khi phát hiện vi phạm SLO. Nó bổ sung cho runbook **Điều tra Tỷ lệ Tiêu hao SLO** với các thủ tục cụ thể cho khai báo sự cố, giao tiếp và giải quyết.

## Ma trận Mức độ Sự cố

| Mức độ | Điều kiện SLO | Thời gian phản ứng | Giao tiếp |
|--------|---------------|-------------------|-----------|
| **SEV-1** (Nghiêm trọng) | Tỷ lệ tiêu hao khẩn cấp (>5×) HOẶC Khả dụng < 99% | 5 phút | Gọi người trực + team lead + CTO, cầu nối sự cố, trang trạng thái |
| **SEV-2** (Lớn) | Tỷ lệ tiêu hao nghiêm trọng (>2×) HOẶC Tỷ lệ lỗi > 5% | 15 phút | Gọi người trực + team lead, cầu nối sự cố |
| **SEV-3** (Nhỏ) | Tỷ lệ tiêu hao cảnh báo (>1×) HOẶC Độ trễ duy trì > ngưỡng | 1 giờ | Gọi người trực, thông báo Slack/Telegram |
| **SEV-4** (Thông tin) | Tỷ lệ tiêu hao thông tin (>0.5×) HOẶC Tăng đơn lẻ metric | 4 giờ | Ghi log, xem xét ở standup |

---

## Luồng Phản hồi Sự cố

```
┌─────────────────────┐
│   Cảnh báo kích hoạt │
│   (Sentry/Telegram) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Xác nhận           │ ◄── 5 phút cho SEV-1/2
│  (gán người phụ trách)│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Khai báo sự cố     │
│  (mức độ + tiêu đề) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Điều tra           │ ◄── Theo Runbook Tỷ lệ Tiêu hao
│  (nguyên nhân gốc)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Giảm thiểu         │
│  (ngăn chảy máu)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Giải quyết         │
│  (sửa nguyên nhân)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Post-Mortem        │
│  (trong 48h)        │
└─────────────────────┘
```

---

## Các Thủ Tục Bước Theo Bước

### 1. Xác nhận Cảnh báo (T+0 đến T+5phút)

**Người trực nhận cảnh báo** qua:
- PagerDuty / OpsGenie (nếu cấu hình)
- Telegram @Sophia_Bbot (webhook đã cấu hình)
- Email tới oncall@sophia.agencyos.network

**Hành động:**
1. Xác nhận trong hệ thống cảnh báo
2. Đăng trong `#platform-eng` (Telegram): "🔴 ACK: <tên cảnh báo> - đang điều tra"
3. Gán người chỉ huy sự cố (thường là người trực)
4. Bắt đầu đếm giờ sự cố

### 2. Khai báo Sự cố (T+5phút)

**Tạo bản ghi sự cố:**
- **Tiêu đề**: `[SEV-X] <tên SLO> vi phạm - <mô tả ngắn>`
- **Mức độ**: SEV-1 đến SEV-4 theo ma trận trên
- **Chỉ huy**: @người-trực
- **Kênh**: Tạo nhóm Telegram "incident-<ngày>-<slo>" hoặc dùng thread `#platform-eng`

**Mẫu:**
```
🚨 SỰ CỐ ĐÃ ĐƯỢC KHAI BÁO
Tiêu đề: [SEV-2] Vi phạm Khả dụng - API trả về 5xx
Mức độ: SEV-2 (Lớn)
Chỉ huy: @ten-ky-su
Bắt đầu: 2026-08-11 14:32 UTC
SLO: Khả dụng (mục tiêu ≥99.5%, hiện tại 98.7%)
Tỷ lệ tiêu hao: 2.3x (Nghiêm trọng)
Routes bị ảnh hưởng: /api/*, /webhook/*
```

### 3. Điều tra (T+5phút đến T+30phút)

Theo dõi **Runbook Điều tra Tỷ lệ Tiêu hao SLO**:
1. Kiểm tra Sentry custom metrics (`sophia.slo.*`)
2. Truy vấn WAE cho dữ liệu route thời gian thực
3. Kiểm tra bảng D1 `slo_burn` cho xu hướng hàng tháng
4. Tương quan với các deploy gần đây
5. Kiểm tra `wrangler tail` cho mẫu lỗi

**Câu hỏi then chốt:**
- Có phải route đơn lẻ hay toàn platform?
- Có deploy nào trong 30 phút qua không?
- Các phụ thuộc bên ngoài (OpenRouter, NOWPayments, D-ID) khỏe không?
- D1/KV có lỗi/độ trễ tăng không?

### 4. Giảm thiểu (T+30phút đến T+1giờ)

**Mục tiêu**: Ngăn chảy máu, khôi phục tuân thủ SLO

**Giảm thiểu phổ biến:**

| Vấn đề | Giảm thiểu |
|--------|------------|
| Deploy xấu | `npx wrangler rollback --name sophia-ai-factory --message "SLO incident rollback" --yes` |
| API bên ngoài down | Bật circuit breaker / fallback / cached responses |
| Contention D1 | Giảm độ phức tạp query, thêm index, kiểm tra query runaway |
| Rate limiter quá chặt | Tăng limits, thêm allowlist cho critical paths |
| Webhook queue bị chậm | Scale Inngest (tự động), tạm dừng webhook non-critical |
| Cold start storm | Pre-warm critical routes (không có sẵn trong Workers) |

**Ghi lại mọi hành động** trong kênh sự cố với timestamp.

### 5. Giải quyết (T+1giờ đến T+4giờ)

**Mục tiêu**: Sửa nguyên nhân gốc vĩnh viễn

**Quy trình:**
1. Xác định nguyên nhân gốc (bug code, config, dependency, capacity)
2. Triển khai fix (hotfix deploy, thay đổi config, leo thang external)
3. Xác minh khôi phục SLO qua Sentry/WAE
4. Theo dõi 30 phút sau fix
5. Khai báo đã giải quyết

**Thông báo giải quyết:**
```
✅ SỰ CỐ ĐÃ GIẢI QUYẾT
Tiêu đề: [SEV-2] Vi phạm Khả dụng - API trả về 5xx
Thời gian: 47 phút
Nguyên nhân gốc: NOWPayments webhook handler ném lỗi trên payload malformed
Fix: Thêm validation payload + xử lý lỗi graceful (commit abc123)
Khôi phục SLO: Khả dụng quay về 99.8% lúc 15:19 UTC
Post-Mortem: Dự kiến 2026-08-12 10:00 UTC
```

### 6. Post-Mortem (Trong 48 giờ)

**Mẫu:** `docs/postmortems/YYYY-MM-DD-<slug>.md`

**Các phần bắt buộc:**
1. **Tóm tắt** — Điều gì xảy ra, tác động, thời gian
2. **Dòng thời gian** — Sự kiện then chốt có timestamp
3. **Nguyên nhân gốc** — Phân tích 5 Whys
4. **Tác động** — Người dùng bị ảnh hưởng, tác động doanh thu/kinh doanh
5. **Điều gì đi tốt** — Phát hiện, giảm thiểu, làm việc nhóm
6. **Điều gì đi sai** — Khoảng trống observability, quy trình, code
7. **Hành động** — Cụ thể, gán người, có deadline

**Định dạng hành động:**
- `[ ] [P0] Thêm bảng request_logs cho perf:check` — @ky-su — 2026-08-18
- `[ ] [P1] Circuit breaker cho NOWPayments webhook` — @ky-su — 2026-08-25
- `[ ] [P2] Cải thiện observability cold start` — @ky-su — 2026-09-01

**Xem xét:** Post-mortem được xem xét ở standup platform, action items thêm vào sprint.

---

## Mẫu Giao Tiếp

### Nội bộ (Telegram #platform-eng)
```
🔴 SỰ CỐ [SEV-2] Khả dụng API
Chỉ huy: @alice
Bắt đầu: 14:32 UTC
SLO: Khả dụng 98.7% (mục tiêu 99.5%)
Tỷ lệ tiêu hao: 2.3x
Trạng thái: ĐANG ĐIỀU TRA
```

### Trang Trạng Thái (nếu ảnh hưởng khách hàng)
```
Tiêu đề: Hiệu suất API Giảm Sút
Trạng thái: Đang Điều Tra
Thông báo: Chúng tôi đang điều tra tỷ lệ lỗi tăng trên các API endpoint. Một số request có thể thất bại. Cập nhật mỗi 15 phút.
```

### Thông Báo Khách Hàng (nếu SEV-1, >30 phút)
- Email cho khách hàng tier bị ảnh hưởng (ENTERPRISE/MASTER)
- Banner in-app qua feature flag
- Broadcast Telegram cho subscribers @Sophia_Bbot

---

## Chính Sách Thăng Cấp

| Thời gian trôi qua | SEV-1 | SEV-2 | SEV-3 | SEV-4 |
|-------------------|-------|-------|-------|-------|
| 5 phút | Gọi CTO | — | — | — |
| 15 phút | — | Gọi Team Lead | — | — |
| 30 phút | Cầu Nối Sự Cố | Cầu Nối Sự Cố | — | — |
| 1 giờ | Cập nhật Cấp Cao | Gọi Người Trực (nếu không phản hồi) | Gọi Người Trực | — |
| 2 giờ | Giao Tiếp Khách Hàng | Giao Tiếp Khách Hàng (nếu SEV-2) | — | Chỉ Ghi Log |
| 4 giờ | — | — | Thăng Cấp lên SEV-2 | Xem Xét Ở Standup |

---

## Tham Khảo Công Cụ Nhanh

| Nhiệm Vụ | Lệnh / Link |
|----------|-------------|
| Xem tỷ lệ tiêu hao hiện tại | `curl -H "Auth: Bearer $CRON_SECRET" https://sophia.agencyos.network/api/cron/slo-burn-rate` |
| Sentry Metrics | https://sentry.io/org/sophia/metrics/ |
| WAE Dashboard | Cloudflare Dashboard → Workers Analytics → sophia_slo_metrics |
| Truy Vấn D1 | `npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM v_slo_current_month" --remote` |
| Trạng Thái Deploy | `curl https://sophia.agencyos.network/api/version` |
| Rollback | `npx wrangler rollback --name sophia-ai-factory --message "lý do" --yes` |
| Logs Thời Gian Thực | `npx wrangler tail sophia-ai-factory --format=pretty` |
| Inngest Dashboard | https://app.inngest.com/ (nếu cấu hình) |

---

## Tài Liệu Liên Quan

- **Mục Tiêu SLO** — `docs/slo-targets.md`
- **Điều Tra Tỷ Lệ Tiêu Hao SLO** — `docs/runbooks/slo-burn-rate.md`
- **Kiến Trúc** — `docs/system-architecture.md`
- **Xác Minh Deploy** — `.claude/rules/sophia-deploy-verify.md`