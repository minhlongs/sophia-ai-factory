# Deploy Guard SOP — Hướng dẫn vận hành

**Status:** Active  
**Applies to:** Sophia AI Factory — Deploy Guard (Admin UI)  
**Tasks:** #88, #92, #47

---

## 1. Mục đích / Purpose

Deploy Guard là cơ chế kiểm soát deployment, đảm bảo tuân thủ SOC 2 CC6.1 (separation of duties). Mỗi deployment cần có ít nhất 2 operator attestation (chữ ký) hoặc được phê duyệt bởi admin.

**Key points:**
- Khi không có PR merge, deploy sẽ tạo approval pending và yêu cầu 2 chữ ký.
- Operator xem pending approvals tại `/dashboard/admin/deploy-guard`.
- Operator có thể **Attest** (ký), **Reject** (từ chối với lý do), hoặc **Emergency Override** (bypass).
- Mọi hành động được ghi nhận trong `admin_audit_log` (không thể sửa).

---

## 2. Luồng công việc / Operator Workflow

### 2.1 Xem danh sáchPending Approvals

- Truy cập: `https://sophia.agencyos.network/dashboard/admin/deploy-guard`
- Bảng hiển thị: Commit, Branch, Operator, Attestations (x/y), Thời gian.
- Nút **Details** mở trang chi tiết approval.

### 2.2 Chi tiết Approval (Approval Details)

- Xem: Diff Summary, Files changed, Danh sách attestations.
- Cần thực hiện Attest nếu còn remaining attestations.
- Form Reject: chọn **Reject Approval**, nhập lý do, xác nhận.

### 2.3 Attest (Chứng thực)

- Bấm nút **Attest** (chỉ hiện khi còn remaining).
- Xác nhận dialog: sẽ ký với DEPLOY_KEY của bạn.
- Hệ thống tạo manifest (commit, branch, timestamp, diff, files) và tính HMAC-SHA256 signature bằng DEPLOY_KEY.
- Gửi signature đến `/api/admin/deploy-guard/attest`.
- Khi đạt quorum (đủ 2 chữ ký), approval tự động chuyển sang `approved` và deploy được phép.

### 2.4 Reject (Từ chối)

- Bấm **Reject Approval**, nhập lý do.
- Hệ thống đặt status=`rejected`, ghi audit log với reason.
- Deployment bị chặn vĩnh viễn cho commit đó (trừ override).

### 2.5 Emergency Override

- Phần Emergency Override: nhập Commit SHA và lý do khẩn cấp.
- Gửi → tạo `deploy_overrides` record.
- Deploy được phép bỏ qua guard.
- Lý do override phải được ghi chú rõ ràng (sẽ audit).

---

## 3. Giao diện Admin UI

### 3.1 Trang chính: `/dashboard/admin/deploy-guard`

- Danh sách pending approvals (live poll mỗi 30s).
- Nút Attest/Reject từng hàng.
- Phần Emergency Override ở dưới.

### 3.2 Trang chi tiết: `/dashboard/admin/deploy-guard/approvals/[id]`

- Hiển thị đầy đủ thông tin approval.
- Danh sách attestations (operator, host, thời gian).
- Buttons: Attest (nếu cần), Reject Approval.

---

## 4. Tích hợp với Deploy Script

### 4.1 Pre-push hook

- File: `.husky/pre-push` gọi `scripts/deploy/guard-deploy.js --dry-run`.
- Nếu không có PR merge, in thông báo với link UI:
  ```
  → Attest via admin UI: https://sophia.agencyos.network/dashboard/admin/deploy-guard
  ```
- Nếu bị block, in link emergency override.

### 4.2 Deploy script (deploy-with-sha.sh)

- Bước đầu tiên: gọi `/api/admin/deploy-guard/create-approval` với thông tin commit, branch, operator, diff summary, files changed.
- Sau khi deploy thành công, script thu thập DEPLOY_KEY từ môi trường và tự động attest nếu cần (tích hợp sẵn).
- Deploy chỉ được phép khi:
  - PR có approval từ review + CI pass, **HOẶC**
  - Có 2 operator attestations, **HOẶC**
  - Có emergency override.

---

## 5. Audit & Compliance

- Tất hành động (attest, reject, override, approval) được ghi vào `admin_audit_log` với:
  - `actor_user_id`
  - `action_type`: `DEPLOY_GUARD_CREATED`, `DEPLOY_GUARD_ATTESTED`, `DEPLOY_GUARD_REJECTED`, `DEPLOY_GUARD_OVERRIDDEN`, `DEPLOY_GUARD_APPROVED`
  - `payload`: JSON chứa `approvalId`, `reason`, `metadata`.
- Audit log là append-only, không thể sửa.

### Xem lịch sử (History)

- Trang `/dashboard/admin/deploy-guard` có tab Recent History (lấy từ `admin_audit_log`).
- Lọc: các action bắt đầu bằng `DEPLOY_GUARD_`.
- **Lưu ý:** Operator identity (user ID) được trích xuất tự động từ session admin khi thực hiện attest/reject/override, do đó audit log ghi nhận chính xác ai đã thực hiện hành động.

---

## 6. Xử lý sự cố / Troubleshooting

| Vấn đề | Nguyên nhân | Khắc phục |
|--------|-------------|-----------|
| Không thấy pending approval | Đã được approve/reject/override | Kiểm tra History |
| Attest button disabled | Approval đã có đủ 2 chữ ký hoặc status không phải pending | Xem chi tiết approval |
| Deploy bị block mặc dù có 2 chữ ký | Có thể approval đã `rejected` hoặc `expired` (24h) | Tạo approval mới |
| Pre-push hook báo "no PR found" | Đang push trực tiếp vào main (không qua PR) | Cần 2 operator attest qua UI |

### Emergency Bypass (từ command line)

```bash
# Bỏ qua guard (sẽ ghi audit)
./scripts/deploy-with-sha.sh --override "Khẩn cấp: hotfix production"
```

---

## 7. Bảo mật

- DEPLOY_KEY phải là bí mật operator, không chia sẻ.
- Mỗi operator phải có DEPLOY_KEY riêng và giữ nó an toàn.
- Chữ ký được tạo client-side bằng Web Crypto API, không gửi secret qua server.
- Server chỉ lưu signature, không lưu DEPLOY_KEY.

---

## 8. Liên kết / References

- API Routes:
  - `POST /api/admin/deploy-guard/create-approval`
  - `GET  /api/admin/deploy-guard/pending`
  - `POST /api/admin/deploy-guard/attest`
  - `POST /api/admin/deploy-guard/reject`
  - `POST /api/admin/deploy-guard/override`
  - `GET  /api/admin/deploy-guard/history`
- Services: `src/forest/deploy-guard/approval-service.ts`
- Types: `src/forest/deploy-guard/types.ts`
- Manifest generator: `src/forest/deploy-guard/manifest-generator.ts`
- UI: `src/app/[locale]/dashboard/admin/deploy-guard/`
- Migration: `migrations/0186_add_diff_fields.sql`

---

## 9. Changelog

- **2026-06-20** — Tích hợp reject approval, attestation, override. Tạo admin UI, cập nhật pre-push hook với link UI.

---

**Lưu ý:** Tài liệu này song ngữ Việt/Anh. Mọi thay đổi quan trọng cần cập nhật cả hai ngôn ngữ.
