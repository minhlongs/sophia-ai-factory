# 10 — HỢP ĐỒNG TRAO ĐỔI THIẾT KẾ GOOGLE STITCH (`DESIGN.md` CONTRACT)
> **Tài liệu:** `docs/design/zen-design-os/10-STITCH-DESIGN-MD-CONTRACT.md`
> **Tệp đích:** `/DESIGN.md` (tại thư mục gốc của kho mã nguồn)
> **Quy tắc thẩm quyền:** `.claude/rules/sophia-design-authority.md`

---

## 1. THỨ TỰ THẨM QUYỀN THIẾT KẾ (AUTHORITY ORDER)

Theo quy tắc `.claude/rules/sophia-design-authority.md`, thứ tự ưu tiên từ cao xuống thấp trong Sophia AI Factory được khóa chặt như sau:

1. **`apps/sophia-ai-factory/src/app/globals.css`** — Nguồn chân lý thực thi cao nhất ở runtime.
2. **`apps/sophia-ai-factory/src/seed/design-tokens/zen-design-tokens.dtcg.json`** — Nguồn chân lý DTCG 2025.10 ánh xạ 1:1 với `globals.css`.
3. **`.claude/rules/`** — Các quy tắc bảo vệ kiến trúc và luồng nghiệp vụ của dự án.
4. **`/DESIGN.md`** — Giao diện trao đổi thiết kế chuẩn hóa cho Google Stitch và các công cụ thiết kế AI.

> **Nguyên tắc bất biến:** Nếu bất kỳ công cụ bên ngoài nào tạo ra bản thiết kế có màu sắc hoặc font chữ mâu thuẫn với `src/app/globals.css`, giá trị trong `src/app/globals.css` luôn thắng.

---

## 2. CẤU TRÚC CHUẨN CỦA `/DESIGN.md` CHO GOOGLE STITCH

Tệp `/DESIGN.md` tại thư mục gốc đã được cập nhật đầy đủ 8 phần chuẩn hóa để khi đưa vào Google Stitch (`upload_design_md` hoặc `create_design_system_from_design_md`), AI sẽ sinh ra các màn hình tuân thủ đúng **ZEN DESIGN OS v1.0**:

1. **System Identity & Philosophy**: Xác định rõ phong cách **Quiet Expressive Precision** (Director's Control Deck cho Dark Mode & Executive Studio Ivory cho Light Mode).
2. **Dual-Theme Color Palette**: Liệt kê chính xác mã Hex và biến CSS của cả hai chế độ `:root` và `.dark`, kèm tỷ lệ tương phản WCAG 2.2 AA đã được kiểm chứng.
3. **Dedicated Studio Dark Stage**: Quy định rõ vùng khung hình video (`--studio-stage-bg: #090A10`) luôn giữ nền tối.
4. **Typography System (Bilingual VI + EN)**: Khóa bộ đôi font chữ `Inter` (UI/Body) và `JetBrains Mono` (Code/Telemetry/`tabular-nums`) — cả hai với subset `latin` + `vietnamese`. `.v3-core` landing giữ `Archivo` (wdth) chỉ cho headline scrollytelling. Không dùng `Satoshi` / `Instrument Serif`.
5. **Layout, Spacing & Radius**: Quy định lưới 12 cột, sidebar `280px`, chiều cao TopBar `64px` và thang bo góc `6px–16px`.
6. **Zen Motion Governance**: Liệt kê các biến `--motion-duration-*` (`80ms–600ms`), đường cong `--motion-ease-emphasized` và danh sách các hiệu ứng bị cấm (WebGL, Parallax, Confetti, Magnetic Cursor).
7. **Signature Visual Utilities**: Mô tả cách dùng đúng cho `.radar`, `.film-strip`, `.camera-rec` (chỉ dùng trên khung preview thật) và `.studio-glass`.
8. **Protected Flows Contract**: Cảnh báo rõ các thành phần không được phép thay đổi logic hoặc xóa bỏ thuộc tính kiểm thử (`Setup Wizard BYOK`, `Telegram Bot`, `NOWPayments/PayOS`).
