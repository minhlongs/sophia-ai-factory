# Chiến lược Xử lý Nợ Kỹ thuật (Technical Debt) - Sophia AI Factory

**Người thực hiện:** Researcher Agent (Antigravity Team)
**Ngày báo cáo:** 2026-02-12
**Dự án:** `apps/sophia-ai-factory`

---

## 1. Phân tích Hiện trạng & Nguyên nhân Gốc rễ

### 1.1. Cấu trúc Thư mục Bất thường (Nested Project)
Dự án hiện đang tồn tại cấu trúc lồng nhau: `apps/sophia-ai-factory/apps/sophia-ai-factory/`.
- **Hệ quả:** Gây nhầm lẫn trong việc xác định `root` của project, cấu hình đường dẫn (path aliases), và lãng phí không gian lưu trữ.
- **Nguyên nhân:** Có thể do lỗi trong quá trình chạy lệnh khởi tạo project (scaffold) hoặc lỗi khi di chuyển mã nguồn từ mono-repo cũ.

### 1.2. Sự chồng chéo Logic (Redundancy)
Phát hiện sự tồn tại của hai module xử lý lệnh Telegram:
- `src/lib/telegram/telegram-bot.ts`: Handler đơn giản, mang tính chất thử nghiệm hoặc cũ.
- `src/lib/telegram/telegram-command-handlers.ts`: Handler phức tạp sử dụng FSM (Finite State Machine).
- **Hệ quả:** Khó bảo trì, dễ gây lỗi "split brain" khi logic thay đổi ở một nơi nhưng nơi kia vẫn giữ code cũ.

### 1.3. Vi phạm Tiêu chuẩn Code (Coding Standards)
Theo `CLAUDE.md`, file không được vượt quá 200 dòng. Tuy nhiên, có ít nhất 20 file vi phạm:
- `telegram-command-handlers.ts` (381 dòng)
- `generate-campaign.ts` (343 dòng)
- `affiliate-ai-scorer.ts` (230 dòng)
- ... (xem chi tiết trong danh sách refactoring)

### 1.4. Nợ Kiến trúc (Architectural Debt)
- **Smart Resume Engine:** Hiện đang sử dụng `Map` trong bộ nhớ (in-memory) để lưu checkpoint. Checkpoint sẽ bị mất khi server restart hoặc deploy lại. Cần chuyển sang bảng `campaign_checkpoints` trong Supabase.

### 1.5. Circular Dependencies
- **Kết quả kiểm tra (Madge):** Không phát hiện circular dependencies nghiêm trọng trong thư mục `src`. Đây là một điểm sáng, cho thấy sự phân tách layer (app, components, lib) vẫn đang được kiểm soát tốt.

---

## 2. Đề xuất Công cụ & Quy trình Ngăn chặn Tech Debt mới

### 2.1. Nâng cấp ESLint Rules
Cần bổ sung các rule nghiêm ngặt hơn vào `.eslintrc.json`:
- `max-lines`: Giới hạn 200 dòng cho mỗi file (Cảnh báo: Error).
- `no-restricted-imports`: Ngăn chặn việc import trực tiếp từ các module nội bộ của các component khác (ép dùng public API/alias).
- `import/no-cycle`: Tự động kiểm tra circular dependencies trong quá trình dev.

### 2.2. Triển khai Git Hooks (Husky + lint-staged)
- **Pre-commit:** Tự động chạy `npm run lint` và `npm run type-check`. Không cho phép commit nếu có lỗi.
- **Pre-push:** Chạy các bài test quan trọng (`npm test`).

### 2.3. Quy trình Review 2 Lớp
1. **Lớp 1 (Automated):** Sử dụng các Agent (Tester, Code-Reviewer) để quét code vi phạm standards trước khi con người review.
2. **Lớp 2 (Manual):** Focus vào logic nghiệp vụ và kiến trúc thay vì bắt lỗi syntax/formatting.

---

## 3. Hướng dẫn Refactoring cho các Vấn đề Phức tạp

### 3.1. Hợp nhất Module Telegram
**Vấn đề:** Trùng lặp giữa `telegram-bot.ts` và `telegram-command-handlers.ts`.
**Hướng giải quyết:**
1. Di chuyển toàn bộ logic handler từ `telegram-bot.ts` sang hệ thống FSM trong `telegram-command-handlers.ts`.
2. Xóa bỏ `telegram-bot.ts` cũ.
3. Chia nhỏ `telegram-command-handlers.ts` thành các module nhỏ hơn:
   - `handlers/start-handler.ts`
   - `handlers/campaign-handler.ts`
   - `fsm/state-manager.ts`

### 3.2. Chuyển đổi Smart Resume sang Supabase
**Vấn đề:** Mất trạng thái checkpoint khi restart.
**Hướng giải quyết:**
1. Tạo migration SQL cho bảng `campaign_checkpoints` (id, campaign_id, step, metadata, updated_at).
2. Viết class `SupabaseCheckpointStore` thay thế cho in-memory Map.
3. Cập nhật `smart-resume-engine.ts` để sử dụng store mới.

### 3.3. Xử lý "Nested Directory" (High Risk)
**Vấn đề:** Thư mục lồng nhau `apps/sophia-ai-factory/apps/...`
**Hướng giải quyết:**
1. Sao lưu toàn bộ project.
2. Thực hiện "Flatting": Di chuyển nội dung từ thư mục con lên thư mục cha.
3. Cập nhật lại tất cả đường dẫn tuyệt đối trong `package.json`, `tsconfig.json`, và cấu hình CI/CD.
4. Chạy `npm run build` để kiểm tra toàn bộ liên kết.

---

## 4. Kết luận & Ưu tiên thực hiện (Action Items)

| Ưu tiên | Nhiệm vụ | Trạng thái |
| :--- | :--- | :--- |
| **P0** | Sửa lỗi cấu trúc thư mục lồng nhau (Flatten structure) | Chờ duyệt |
| **P0** | Migration Smart Resume sang Supabase (Persistence) | Chờ duyệt |
| **P1** | Chia nhỏ các file > 200 dòng (Modularization) | Đang khảo sát |
| **P2** | Cấu hình Husky & Stricter Linting | Chờ duyệt |

**Câu hỏi chưa giải đáp:**
- Tại sao cấu trúc thư mục lại bị lồng nhau như vậy? (Cần xác nhận từ Lead Developer).
- Có sự phụ thuộc nào từ các service bên ngoài vào đường dẫn hiện tại không?

---
*Báo cáo được tạo tự động bởi Antigravity Researcher Agent.*
