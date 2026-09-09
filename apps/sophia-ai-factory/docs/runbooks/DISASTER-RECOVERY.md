# Runbook: Disaster Recovery & Restore SOP

**Document ID:** RUN-DR-001  
**Severity:** P1 — Operational Independence & Business Continuity  
**Classification:** PLATFORM PROCEDURE (Operator-executable, fail-closed)  
**Effective Date:** 2026-09-10  
**Target Architecture:** Cloudflare D1 (`sophia-raas-db`) + Cloudflare R2 (`sophia-backups`)  

---

## 1. Mục đích & Tổng quan / Purpose & Overview

### 🇻🇳 Vietnamese
Tài liệu này quy định quy trình phục hồi thảm họa (Disaster Recovery — DR) cho Sophia AI Factory. Nó định nghĩa rõ ràng:
1. Cơ chế sao lưu cơ sở dữ liệu D1 lên R2.
2. Quy trình kiểm tra khôi phục không xâm lấn (dry-run trên ephemeral D1).
3. Quy trình khôi phục thực tế khi xảy ra sự cố hỏng hóc hoặc mất dữ liệu.
4. Chỉ số mục tiêu thời gian khôi phục (RTO) và mục tiêu điểm khôi phục (RPO).

### 🇬🇧 English
This SOP governs the Disaster Recovery (DR) procedures for Sophia AI Factory. It establishes:
1. The D1 database backup mechanism to R2 storage.
2. Non-invasive restore verification procedures (dry-run on an ephemeral D1 database).
3. Production restore execution in the event of data corruption or loss.
4. Defined Recovery Time Objective (RTO) and Recovery Point Objective (RPO).

---

## 2. RTO & RPO Targets / Mục tiêu RTO & RPO

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | **≤ 24 hours** (standard) / **< 15 minutes** (pre-maintenance) | Standard daily D1 backup dump. Before major migrations, operator triggers ad-hoc backup to bring RPO to < 15 min. |
| **RTO (Recovery Time Objective)** | **≤ 15 minutes** | Time required to download snapshot from R2 and execute `wrangler d1 execute --remote --file=<dump.sql>`. |
| **Retention Policy** | **30 days** | Auto-rotated via Cloudflare R2 Bucket Lifecycle rules configured in CF Dashboard. |

---

## 3. Kiến trúc sao lưu / Backup Architecture

```
Cloudflare D1 (sophia-raas-db)
       ↓
GET/POST /api/cron/d1-backup (Authenticated with CRON_SECRET)
       ↓
buildD1Dump() generates dump.sql (< 50MB ceiling, in-memory safe)
       ↓
Uploads to R2 bucket: sophia-backups/d1-YYYY-MM-DD.sql
       ↓
Cloudflare R2 Bucket (30-day lifecycle auto-rotation)
```

### Platform Capability vs External Operator Requirement
- **Platform Capability (In-Code):** The backup endpoint `/api/cron/d1-backup` is fully implemented and operational. It dumps all schema and data tables into standard SQLite DDL/DML, enforces size safety (< 50MB buffer limit for Cloudflare Worker 128MB RAM limit), checks 12-hour idempotency, and stores the artifact directly in the `BACKUPS_BUCKET` binding.
- **Operator Requirement:** Under the Sophia No-Code / No-Tech doctrine, the operator does not maintain complex external crons on behalf of tenants. The backup route can be triggered on demand via authenticated cURL, or scheduled via an external cron service (such as Upstash QStash, Cloudflare Cron Triggers, or Better Stack).

---

## 4. On-Demand Backup Trigger / Kích hoạt sao lưu tức thì

Trước khi thực hiện migration lớn hoặc cập nhật cấu hình, thực hiện tạo bản sao lưu ngay lập tức:

```bash
# Obtain CRON_SECRET from your Cloudflare Worker environment or secret manager
PROD_URL="https://sophia.agencyos.network"

curl -X POST "${PROD_URL}/api/cron/d1-backup" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

# Expected response:
# {"ok":true,"timestamp":"2026-09-10T...","sizeBytes":...,"tablesCount":...}
```

---

## 5. Non-Destructive Restore Drill (Ephemeral DB)

**Quy tắc bất biến:** Không bao giờ thử nghiệm restore trực tiếp trên cơ sở dữ liệu production đang hoạt động. Luôn kiểm tra trên một D1 database tạm thời (ephemeral).

### Bước 5.1: Liệt kê và tải bản backup mới nhất từ R2

```bash
# 1. Kiểm tra danh sách bản sao lưu trong bucket sophia-backups
npx wrangler r2 object list sophia-backups --remote

# 2. Xác định file snapshot mới nhất (ví dụ: d1-2026-09-10.sql)
LATEST_SNAPSHOT="d1-$(date +%Y-%m-%d).sql"

# 3. Tải về thư mục tạm cục bộ
mkdir -p /tmp/dr-drill
npx wrangler r2 object get sophia-backups/${LATEST_SNAPSHOT} \
  --file=/tmp/dr-drill/${LATEST_SNAPSHOT} \
  --remote

# 4. Kiểm tra tính toàn vẹn của file SQL
ls -lh /tmp/dr-drill/${LATEST_SNAPSHOT}
head -n 20 /tmp/dr-drill/${LATEST_SNAPSHOT}
```

### Bước 5.2: Tạo database D1 tạm thời và áp dụng snapshot

```bash
DRILL_DB="sophia-drill-$(date +%s)"

# Tạo ephemeral D1 database
npx wrangler d1 create "$DRILL_DB"

# Thực thi snapshot SQL vào database tạm
npx wrangler d1 execute "$DRILL_DB" \
  --file=/tmp/dr-drill/${LATEST_SNAPSHOT} \
  --remote

# Kiểm tra xác thực số lượng bảng và dữ liệu mẫu
npx wrangler d1 execute "$DRILL_DB" \
  --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';" \
  --remote

npx wrangler d1 execute "$DRILL_DB" \
  --command "SELECT COUNT(*) as user_count FROM user;" \
  --remote
```

### Bước 5.3: Dọn dẹp database tạm

```bash
# Xóa database tạm thời sau khi hoàn tất drill
npx wrangler d1 delete "$DRILL_DB" --skip-confirmation
rm -rf /tmp/dr-drill
```

---

## 6. Production Emergency Restore Procedure

Chỉ thực hiện quy trình này khi có sự cố nghiêm trọng được xác nhận (mất dữ liệu, corruption không thể khắc phục bằng migration).

### Bước 6.1: Kích hoạt chế độ bảo trì / Maintenance mode (nếu cần)
Thông báo cho các bên liên quan và chuyển hướng lưu lượng tạm thời nếu dữ liệu đang bị biến dạng.

### Bước 6.2: Chạy khôi phục qua script chuẩn hóa

Script `scripts/dr/restore-from-snapshot.sh` cung cấp chế độ dry-run mặc định và yêu cầu cờ `--confirm` rõ ràng:

```bash
cd apps/sophia-ai-factory

# 1. Chạy chế độ Dry-Run để kiểm tra cấu trúc
./scripts/dr/restore-from-snapshot.sh --snapshot /path/to/validated-snapshot.sql

# 2. Khi đã chắc chắn 100%, thực hiện restore chính thức:
./scripts/dr/restore-from-snapshot.sh --snapshot /path/to/validated-snapshot.sql --confirm
```

Hoặc thực thi trực tiếp qua Wrangler:
```bash
npx wrangler d1 execute sophia-raas-db \
  --file=/path/to/validated-snapshot.sql \
  --remote
```

### Bước 6.3: Hậu kiểm sản phẩm / Post-Restore Validation

1. **Kiểm tra API Health:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health
   # Must be 200
   ```
2. **Kiểm tra bảng khóa tài chính và người dùng:**
   ```bash
   npx wrangler d1 execute sophia-raas-db \
     --command "SELECT COUNT(*) FROM user; SELECT COUNT(*) FROM user_profiles; SELECT COUNT(*) FROM subscription;" \
     --remote
   ```
3. **Đăng nhập và kiểm tra giao diện người dùng:**
   Truy cập `/vi/login` và xác nhận session đăng nhập bình thường.

---

## 7. Ghi nhật ký sự cố / Incident Journaling

Mọi cuộc diễn tập khôi phục (drill) hoặc khôi phục thực tế phải được ghi chép vào `docs/audit/` hoặc nhật ký vận hành với các thông tin:
- Timestamp (UTC)
- Snapshot artifact ID / R2 key
- RTO thực tế đo được
- Kết quả xác minh tính toàn vẹn của bảng
- Người thực hiện

---

*Last updated: 2026-09-10. Cross-reference: `scripts/dr/restore-from-snapshot.sh`, `src/app/api/cron/d1-backup/route.ts`.*
