# 12 — QUY TRÌNH HOÀN TÁC & PHỤC HỒI KHẨN CẤP (ROLLBACK & RECOVERY)
> **Tài liệu:** `docs/design/zen-design-os/12-ROLLBACK-AND-RECOVERY.md`
> **Mục tiêu:** Đảm bảo khả năng hoàn tác (Rollback) tức thì ở 3 cấp độ (Giao diện, Mã nguồn Git, và Mạng biên Cloudflare) mà không ảnh hưởng đến dữ liệu khách hàng.

---

## 1. CẤP ĐỘ 1: KHÓA VỀ CHẾ ĐỘ TỐI MẶC ĐỊNH TRONG 5 GIÂY (INSTANT THEME LOCK)

Vì **ZEN DESIGN OS v1.0** không thay đổi schema cơ sở dữ liệu D1 và mặc định đã khởi chạy ở chế độ tối (`defaultTheme="dark"`), nếu Founder muốn tạm thời tắt khả năng chuyển sang chế độ Sáng mà vẫn giữ nguyên các cải tiến về token và chuyển động:

1. Mở `apps/sophia-ai-factory/src/app/layout.tsx`.
2. Đổi `<ZenThemeProvider defaultTheme="dark">` thành `<ZenThemeProvider defaultTheme="dark" forcedTheme="dark">`.
3. Toàn bộ ứng dụng sẽ khóa cố định ở chế độ tối **Director's Control Deck (`#090A10`)** ngay lập tức.

---

## 2. CẤP ĐỘ 2: HOÀN TÁC TRÊN NHÁNH GIT (GIT COMMIT REVERT)

Tất cả các thay đổi của **ZEN DESIGN OS v1.0** được đóng gói gọn gàng trên nhánh cô lập `design/sophia-zen-design-os-v1`.

- **Trước khi merge vào `main`**: Nhánh `main` hoàn toàn chưa bị chạm tới; có thể xóa hoặc đặt lại nhánh `design/sophia-zen-design-os-v1` bất kỳ lúc nào mà không ảnh hưởng đến nhánh chính.
- **Sau khi đã merge vào `main`**:
  ```bash
  git revert HEAD --no-edit
  git push origin main
  ```
  Do không có bất kỳ thay đổi nào đối với cơ sở dữ liệu D1 (`migrations/`), việc `git revert` là **an toàn 100% (stateless UI revert)**.

---

## 3. CẤP ĐỘ 3: HOÀN TÁC TỨC THÌ TRÊN CLOUDFLARE WORKERS (EDGE ROLLBACK)

Nếu đã triển khai lên Production và cần quay về phiên bản Worker liền trước trong vòng `< 30 giây` mà không cần chờ GitHub Actions build lại:

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Rollback ZEN DESIGN OS v1.0" --yes
```

Sau khi rollback, kiểm tra lại mã SHA đang chạy trên biên:
```bash
curl -s "https://sophia.agencyos.network/api/version?ts=$(date +%s)"
```
