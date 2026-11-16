# 04 — CSP NONCE CHAIN, NEXT-THEMES & CLOUDFLARE ROCKET LOADER AUDIT (G5)
# BÁO CÁO KIỂM CHỨNG CHUỖI CSP NONCE, GIAO DIỆN SÁNG/TỐI & ROCKET LOADER (G5)

- **Audited Chain:** `Request → src/middleware.ts → buildCSPHeader(nonce) → RootLayout (getCspNonce) → ZenThemeProvider (next-themes + data-cfasync="false") → Chromium DOM`
- **Browser Evidence File:** `apps/sophia-ai-factory/docs/design/zen-design-os/release-review/evidence/g5-csp-and-csrf-audit.json`
- **Gate Verdict:** **PASS (CSP Nonce Verified in Real Browser; Remote Cloudflare Zone Setting = `UNKNOWN` via API 403 / `NOT_INJECTED_IN_LIVE_HTML` via HTTP Inspection; Founder Runbook Prepared)**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
1. **Chuỗi CSP Nonce & Chống nháy giao diện (`next-themes`):** Đã kiểm chứng trực tiếp bằng trình duyệt Chromium thực (Playwright) và lệnh `curl -sI` trên biên sản xuất:
   - Mỗi yêu cầu HTTP sinh mới một mã `nonce` ngẫu nhiên mật mã học 32 ký tự hex (`crypto.getRandomValues(new Uint8Array(16))`), truyền qua `x-csp-nonce` xuống `RootLayout` → `ZenThemeProvider`.
   - Hai lần tải trang liên tiếp sinh hai mã hoàn toàn khác nhau (`6b4a6579ce10f271d7bee98cc35a1d4f` ≠ `0a873549f508e1260f35d1d72f1a3af9`), kèm `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` — **không có hiện tượng lưu đệm hay dùng lại nonce giữa các yêu cầu**.
   - Ở chế độ Production (`NODE_ENV=production`), `script-src` chỉ chứa `'self' 'nonce-<32hex>'` — **tuyệt đối không có `'unsafe-inline'` và không có `'unsafe-eval'`**.
   - Mặc định lần truy cập đầu tiên là giao diện Tối (`<html class="dark">`, `--surface: #090A10`, `--primary: #6366F1`); khi người dùng chuyển sang Sáng (`sophia-zen-theme = "light"`), giao diện giữ bền vững qua tải lại trang (`--surface: #F8F9FC`, `--primary: #4338CA`) với **`0` cảnh báo hydration, `0` lỗi vi phạm CSP và `0` hiện tượng nháy trắng (FOUC)**.
2. **Trạng thái Cloudflare Rocket Loader:**
   - **Kiểm tra API chỉ đọc (Read-only API):** OAuth token của Wrangler có quyền đọc danh sách zone (`agencyos.network` = `active`), nhưng thiếu quyền `Zone Settings:Read` và `Config Rules:Read` nên Cloudflare API trả `HTTP 403`. Do đó, theo đúng quy tắc nghiêm ngặt của G5, cấu hình cài đặt trên bảng điều khiển Cloudflare từ xa được phân loại trung thực là **`UNKNOWN` (Không xác minh được qua API do giới hạn scope OAuth)**.
   - **Kiểm tra phản hồi HTML thực tế trên `https://sophia.agencyos.network/vi/login`:** Phản hồi HTTP/2 trực tiếp từ Cloudflare (`cf-ray: ...-SIN`) **không xuất hiện** thẻ `rocket-loader.min.js`, đồng thời script khởi tạo giao diện đã mang sẵn thuộc tính `data-cfasync="false"`.
   - **Chính sách bảo vệ:** Không tự ý thay đổi bất kỳ cấu hình Cloudflare nào. Bên dưới cung cấp hướng dẫn từng bước cho Founder để khoá cứng một **Configuration Rule chỉ tắt Rocket Loader riêng cho hostname `sophia.agencyos.network`** (không đụng tới toàn bộ zone `agencyos.network`) kèm kế hoạch hoàn tác 1 cú nhấp.

**🇬🇧 English:**
Real-browser Playwright inspection (`g5-csp-and-csrf-audit.json`) and live edge header inspection confirm per-request 32-hex CSPRNG nonces, zero cross-request nonce reuse (`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`), strict `script-src 'self' 'nonce-...'` without `'unsafe-inline'` (and without `'unsafe-eval'` in `NODE_ENV=production`), `data-cfasync="false"` on the `next-themes` bootstrap script, zero hydration warnings, and zero CSP errors across Dark (`#090A10`) and Light (`#F8F9FC`) switches. Remote Cloudflare zone-setting inspection via Wrangler OAuth returned `HTTP 403` (missing `Zone Settings:Read` scope), so remote dashboard configuration is classified honestly as **`UNKNOWN`**, while live HTML inspection on `https://sophia.agencyos.network/vi/login` shows **zero `rocket-loader.min.js` injection** today. A hostname-scoped Configuration Rule runbook and rollback plan are provided below for Founder review.

---

## 2. Kết quả kiểm chứng chuỗi CSP & Theme trên trình duyệt thực (`g5-csp-and-csrf-audit.json`)

| Kiểm tra / Check | Giá trị đo thực tế | Trạng thái |
|---|---|---|
| Định dạng Nonce yêu cầu #1 | `6b4a6579ce10f271d7bee98cc35a1d4f` (32 ký tự hex CSPRNG) | **PASS** |
| Định dạng Nonce yêu cầu #2 (Reload) | `0a873549f508e1260f35d1d72f1a3af9` (`nonce1 !== nonce2`) | **PASS** |
| Production `script-src` (`NODE_ENV=production`) | `script-src 'self' 'nonce-<32hex>'` (0 `'unsafe-inline'`, 0 `'unsafe-eval'`) | **PASS** |
| `Cache-Control` trên tài liệu HTML động | `private, no-cache, no-store, max-age=0, must-revalidate` | **PASS** |
| Thuộc tính `data-cfasync` trên script `next-themes` | `data-cfasync="false"` | **PASS** |
| Mặc định lần đầu truy cập | `<html class="dark">`, `--surface: #090A10`, `--primary: #6366F1` | **PASS** |
| Giữ trạng thái Sáng sau khi tải lại trang | `<html class="light">`, `--surface: #F8F9FC`, `--primary: #4338CA` | **PASS** |
| Hydration warnings / CSP console errors / Page errors | `0` / `0` / `0` | **PASS** |

---

## 3. Phân tích kỹ thuật `data-cfasync="false"` vs Strict Nonce CSP

- Thuộc tính `data-cfasync="false"` trên thẻ `<script>` của `ZenThemeProvider` ngăn Rocket Loader viết lại riêng thẻ khởi tạo giao diện sáng/tối.
- **Tuy nhiên (cảnh báo kỹ thuật trung thực theo G5):** Nếu ai đó bật Rocket Loader ở cấp độ toàn zone `agencyos.network` trong tương lai, Rocket Loader sẽ viết lại các thẻ `<script nonce="...">` còn lại của Next.js App Router thành `type="text/rocketscript"` và chèn trình nạp `rocket-loader.min.js` không có mã nonce hợp lệ của request hiện tại — điều này **sẽ bị chính sách `script-src 'self' 'nonce-...'` chặn đứng** và làm đơ hydration của React.
- Vì vậy, `data-cfasync="false"` chỉ là lớp phòng vệ phụ cho thẻ theme; biện pháp bảo vệ triệt để theo đúng chính sách của Founder là **Configuration Rule tắt Rocket Loader riêng cho hostname `sophia.agencyos.network`**.

---

## 4. Hướng dẫn dành cho Founder: Khoá Configuration Rule cho riêng `sophia.agencyos.network` (PENDING APPROVAL — CHƯA THỰC THI)

> **Lưu ý:** Không có bất kỳ thay đổi nào được thực hiện lên Cloudflare trong phiên làm việc này. Founder chỉ cần thực hiện quy trình 2 phút dưới đây nếu muốn khoá bảo hiểm vĩnh viễn cho hostname `sophia.agencyos.network`.

### Bước thực hiện trên Cloudflare Dashboard (Không ảnh hưởng các subdomain khác của `agencyos.network`)
1. Đăng nhập **Cloudflare Dashboard** → chọn zone **`agencyos.network`**.
2. Vào mục **Rules** → **Configuration Rules** → nhấn **Create rule**.
3. Đặt tên Rule: `Sophia Strict CSP — Disable Rocket Loader (Hostname Only)`.
4. Phần **When incoming requests match...**, chọn **Custom filter expression**:
   - **Field:** `Hostname`
   - **Operator:** `equals`
   - **Value:** `sophia.agencyos.network`
   - *(Biểu thức chính xác: `(http.host eq "sophia.agencyos.network")`)*
5. Phần **Then the settings are...**:
   - Tìm mục **Rocket Loader** → nhấn **Add** → gạt công tắc sang **Off (Disabled)**.
6. Nhấn **Deploy** để lưu quy tắc.

### Kế hoạch hoàn tác tức thì (1-Click Rollback Plan)
1. Vào **Cloudflare Dashboard** → zone **`agencyos.network`** → **Rules** → **Configuration Rules**.
2. Tìm quy tắc `Sophia Strict CSP — Disable Rocket Loader (Hostname Only)`.
3. Gạt công tắc trạng thái sang **Off** (tạm tắt) hoặc nhấn **Delete** để khôi phục ngay lập tức hành vi mặc định của zone trong `< 5 giây` mà không cần triển khai lại ứng dụng.
