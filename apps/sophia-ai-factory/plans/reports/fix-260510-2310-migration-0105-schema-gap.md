# Fix Report — Migration 0105 Schema Gap

> Commit: `57024fa7` | Deploy: `2026-05-11T06:13:23Z` | SHA match: ✅

## Bối cảnh

Phase 03 Stripe Connect KYC report ghi `migration 0105 applied`, nhưng runtime audit phát hiện 3 bảng nền tảng (`commission_ledger`, `payout_batches`, `payout_methods`) thực ra KHÔNG tồn tại trên remote D1 — code Phase 13 silent-failing.

## Root Cause

1. `src/seed/db/migrations/0038-revenue-split.sql` chứa CREATE statement cho 4 bảng (`commission_ledger`, `payout_batches`, `payout_methods`, `tenant_settings`).
2. Folder `src/seed/db/migrations/` KHÔNG được `scripts/apply-migrations.sh` walk — script chỉ apply diff trong canonical `migrations/`.
3. Ai đó port riêng `tenant_settings` qua `migrations/0085-tenant-settings.sql` (schema khác: namespaced JSON thay vì column `vn_pit_enabled`).
4. 3 bảng còn lại bị bỏ quên → code Phase 13 (`payout-batcher.ts`, `/api/affiliate/payout-method`, `commission-ledger.ts`) chạy vào bảng không tồn tại.

## Phạm vi ảnh hưởng pre-fix

| Code path | Hành vi | Customer impact |
|---|---|---|
| `POST /api/affiliate/payout-method` | 500 vì `payout_methods` không tồn tại | Không affiliate nào đăng ký được phương thức nhận thưởng |
| `payout-batcher` weekly cron | Throw khi SELECT `commission_ledger` | Cron silent-fail mỗi Chủ nhật 12:00 UTC |
| `conversion-to-ledger` Inngest | Throw khi insert vào `commission_ledger` | Mọi conversion event bị drop |
| `conversion-to-ledger` VN PIT branch | Throw khi SELECT `vn_pit_enabled` (column không tồn tại trong 0085 schema) | Toàn bộ flow conversion VN bị break |

Lý do GAP không bị catch sớm hơn: 0 conversion thật xảy ra, cron payout chưa fire (production live ~10 ngày).

## Fix

### A. Migration 0106-revenue-split-tables.sql

Copy verbatim 3 CREATE TABLE từ 0038 (`commission_ledger`, `payout_batches`, `payout_methods`) + 5 indexes. `tenant_settings` skip — schema 0085 đã canonical. Tất cả `IF NOT EXISTS` để safe trên môi trường partial-apply.

```bash
npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0106-revenue-split-tables.sql
# Total queries executed: 8 | Rows written: 16 | success: true
```

### B. Refactor conversion-to-ledger.ts

`fetch-tenant-vn-pit` step đổi từ `SELECT vn_pit_enabled FROM tenant_settings` (column không tồn tại) sang đọc namespaced JSON theo schema 0085:

```sql
SELECT value FROM tenant_settings WHERE tenant_id = ? AND namespace = 'vn_pit' LIMIT 1
```

Sau đó `JSON.parse(value).enabled === true`. Behavior tương đương; default `false` khi row hoặc JSON invalid.

## Verify

| Check | Trạng thái |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| Vitest `src/land/payouts/ src/forest/inngest/` | ✅ 84/84 pass |
| `npm run build` | ✅ build complete |
| `npm run deploy:full` | ✅ Deploy complete |
| `/api/version` shortSha == local | ✅ `57024fa7` match |
| `curl -sI sophia.agencyos.network` | ✅ HTTP/2 200 |
| Remote D1 tables present | ✅ `commission_ledger`, `payout_batches`, `payout_methods` + 5 indexes |
| `GET /api/affiliate/payout-method` | ✅ HTTP 401 (auth required, KHÔNG còn 500 table-missing) |

## Lessons

1. **Canonical migrations directory drift** — phải có CI/test guard verify mọi CREATE TABLE trong code path đều có migration tương ứng trong `migrations/`. Đề xuất: viết script grep `from ['\"]@/(land|forest)` quét all SQL strings, cross-reference với `migrations/*.sql`.
2. **Phase report optimism** — Phase 03 mark `[x] migration applied` mà chưa runtime-verify SELECT từ bảng. Reports phải bao gồm `SELECT count(*) FROM <table>` để confirm bảng tồn tại trên remote, không chỉ `apply-migrations.sh exit 0`.
3. **Schema name collision** — 2 migration cùng tạo `tenant_settings` với 2 schema khác nhau (0038 column-flag vs 0085 namespaced JSON). Migration naming nên enforce 1-table-1-CREATE-statement-canonical-source.

## Unresolved

- File `src/seed/db/migrations/0038-revenue-split.sql` + `20260506_revenue_split.sql` còn nằm lại — coi như historical record hay xóa? (Đề xuất: thêm header `-- DEPRECATED: superseded by migrations/0106-revenue-split-tables.sql + 0085-tenant-settings.sql` để tránh tương lai có người restore nhầm.)
- Không có data migration cần thiết (bảng mới = empty từ đầu, không có dữ liệu lịch sử cần backfill).
- Cron `payout-batcher-weekly` chạy lần đầu vào Chủ nhật 12:00 UTC kế tiếp — cần monitor Sentry/Inngest dashboard sau lần fire đầu để confirm path hoạt động end-to-end với bảng thật.
