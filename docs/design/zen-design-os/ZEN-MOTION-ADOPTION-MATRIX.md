# ZEN MOTION ADOPTION MATRIX — SOPHIA AI FACTORY
> **Tài liệu:** `docs/design/zen-design-os/ZEN-MOTION-ADOPTION-MATRIX.md`
> **Phiên bản:** ZEN DESIGN OS v1.0 (Founder Addendum #07.1)
> **Trạng thái:** Đã khóa & Triển khai trên nhánh `design/sophia-zen-design-os-v1`
> **Nguyên tắc cốt lõi:** Motion là tín hiệu trạng thái (State Signal), định hướng không gian (Spatial Orientation) và phản hồi nhân quả (Causal Feedback) — **tuyệt đối không phải trang trí điện ảnh gây nhiễu**.

---

## 1. BẢNG ĐÁNH GIÁ CHẤP NHẬN / TỪ CHỐI (ADOPTION MATRIX)

| Mẫu tham chiếu (Reference Pattern) | Quyết định | Lý do kỹ thuật & UX (Rationale) | Vị trí áp dụng hợp lệ | Vị trí bị cấm tuyệt đối | Ngân sách hiệu năng (Performance Budget) | Hành vi `prefers-reduced-motion` |
|---|---|---|---|---|---|---|
| **1. CSS Custom Property Easing & Duration Tokens** (`--motion-duration-*`, `--motion-ease-*`) | **ADOPT** | Chuẩn hóa toàn bộ nhịp điệu chuyển động theo Material 3 Expressive (`cubic-bezier(0.16, 1, 0.3, 1)`), loại bỏ ma trận `duration-300`/`duration-500` rời rạc. | `src/app/globals.css`, `PageTransition`, `ScrollReveal`, `FadeInView`, `AnimatedCounter`, `WizardStepper`, `ThemeToggle`, Drawer/Modal. | Không dùng đường cong linear cho chuyển động xuất hiện (enter transition). | 0 KB JS runtime (100% CSS native). | Ép toàn bộ `--motion-duration-*` về `0ms` và tắt transform (`src/app/globals.css:991-1040`). |
| **2. View Transition / Shared-Context Spatial Continuity** (`PageTransition` & Step-to-Step) | **ADOPT** | Giúp CEO không chuyên kỹ thuật hiểu rõ đang tiến hay lùi trong Setup Wizard 6 bước và khi chuyển giữa các tab Dashboard. | `src/seed/components/ui/page-transition.tsx`, `WizardStepper` progress bar (`300ms`), tab switching. | Không dùng hiệu ứng lật trang 3D, zoom-blur hoặc kéo dài quá `400ms`. | Chỉ sử dụng `opacity` + `transform: translateY(12px)` trên compositor thread; `CLS = 0.00`. | Hiển thị tức thì (`opacity: 1`, `transform: none`, `transition: none`). |
| **3. Calm AI Telemetry Pulse & Progress** (`animate-pulse` có kiểm soát, `.radar`, `.camera-rec`) | **ADOPT** | Truyền tải trạng thái AI đang xử lý (OpenRouter/ElevenLabs/D-ID verification, Render Queue) mà không gây mỏi mắt. | Huy hiệu `LIVE`, `REC` trong Studio Stage, nút `Verify` khi đang kiểm tra API key, thanh tiến trình render. | Không nhấp nháy toàn bộ viền thẻ (card border) hoặc nền trang; không chạy vô tận khi tác vụ đã xong. | `opacity` / `transform: rotate()` trên lớp kích thước nhỏ (`<= 48x48px`). | Dừng animation (`animation: none`), giữ trạng thái tĩnh rõ ràng. |
| **4. Scroll-Driven Reveal (`ScrollReveal` / `IntersectionObserver`)** | **ADAPT** | Tạo nhịp điệu đọc tự nhiên trên Landing Page & khối báo cáo dài với biên độ dịch chuyển vừa phải (`translateY(2rem)`, hoặc `1.5rem` khi dùng `staggerDelay`). | `src/seed/components/ui/scroll-reveal.tsx`, trang Landing/Marketing. | **CẤM** dùng trong các bảng dữ liệu vận hành dày đặc, form nhập API key, hoặc thanh điều hướng cố định. | Native `IntersectionObserver` (`disconnect()` ngay sau lần hiện đầu tiên). | Bỏ qua observer, hiển thị `visible = true` và `transition: none` ngay lập tức. |
| **5. Staggered Card Choreography (`FadeInView` delay)** | **ADAPT** | Giúp phân tách thứ tự ưu tiên của các khối KPI trong Dashboard khi tải lần đầu, với quy ước ngân sách trễ tại caller `delay <= 180ms`. | `src/seed/components/ui/fade-in-view.tsx` trên 3–4 thẻ KPI đầu trang Dashboard. | **CẤM** stagger trên danh sách dài (> 6 phần tử), bảng lịch sử giao dịch, hoặc thông báo lỗi bảo mật/thanh toán. | Giới hạn caller `delay <= 180ms`, chỉ biến đổi `opacity` + `translateY` (`distance` mặc định `20px`). | Tắt toàn bộ delay và transform (`transition: none`); hiển thị đồng thời. |
| **6. WebGL / Three.js / Custom Shader Backgrounds** | **REJECT** | Tăng kích thước bundle > 150KB, tiêu thụ GPU/pin cao trên laptop văn phòng của CEO, gây giảm độ tương phản chữ và vi phạm Cloudflare Worker Cold-Start budget. | Không áp dụng ở bất kỳ đâu trong Sophia AI Factory. | Toàn bộ ứng dụng (`Setup Wizard`, `Dashboard`, `Niche Studio`, `Marketing`). | Tiết kiệm ~150–600KB JS + 0% GPU shader overhead. | Không áp dụng (đã loại bỏ hoàn toàn). |
| **7. Cursor-Following Spotlight / Magnetic Buttons** | **REJECT** | Gây mất tập trung trên các nút hành động nhạy cảm (Lưu API Key, Xác nhận thanh toán NOWPayments, Xuất bản video), không có giá trị trên thiết bị cảm ứng/mobile. | Không áp dụng. | Toàn bộ nút bấm, thẻ KPI, form BYOK và điều hướng. | 0 `mousemove` listener toàn cục. | Không áp dụng (đã loại bỏ hoàn toàn). |
| **8. Parallax Scrolling / Scroll-Jacking / Smooth-Scroll Override (Lenis/GSAP ScrollTrigger)** | **REJECT** | Phá vỡ hành vi cuộn tự nhiên của trình duyệt macOS/iOS/Windows, làm lệch vị trí focus bàn phím (WCAG 2.2 AA) và gây chóng mặt. | Không áp dụng. | Toàn bộ các route trong ứng dụng. | 0 KB thư viện cuộn bên thứ ba; giữ nguyên native scroll. | Không áp dụng (đã loại bỏ hoàn toàn). |
| **9. Celebration Confetti / Particle Explosions** | **REJECT** | Làm giảm tính nghiêm cẩn của nền tảng B2B SaaS ("Quiet Expressive Precision") khi hoàn tất Setup Wizard hoặc thanh toán. | Thay thế bằng biểu tượng Checkmark sắc nét + thông báo trạng thái `Emerald` có độ tin cậy cao. | `FinishStep`, `PaymentStep`, `PublishModal`. | 0 `<canvas>` particle loop. | Không áp dụng (đã loại bỏ hoàn toàn). |

---

## 2. HỆ THỐNG TOKEN CHUYỂN ĐỘNG CHUẨN HÓA (`src/app/globals.css`)

```css
/* ZEN MOTION GOVERNANCE TOKENS (Founder Addendum #07.1) */
--motion-duration-instant: 80ms;     /* Phản hồi nhấn nút, toggle switch */
--motion-duration-fast: 150ms;       /* Hover, focus ring, tooltip */
--motion-duration-normal: 240ms;     /* Chuyển tab, đóng/mở accordion, bước stepper */
--motion-duration-deliberate: 400ms; /* Chuyển màn hình (PageTransition), ngăn kéo (Drawer) */
--motion-duration-cinematic: 600ms;  /* Chỉ dành cho khung preview Studio khi khởi tạo */

--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
--motion-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
--motion-ease-decelerate: cubic-bezier(0, 0, 0, 1);
--motion-ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
```

---

## 3. CAM KẾT KHẢ NĂNG TIẾP CẬN & HIỆU NĂNG (WCAG 2.2 AA & CORE WEB VITALS)

1. **`prefers-reduced-motion: reduce`**:
   - Được thực thi ở cả tầng CSS toàn cục (`src/app/globals.css:991-1040`) và tầng React Hook (`window.matchMedia('(prefers-reduced-motion: reduce)')` kèm sự kiện `'change'` trong cả 4 nguyên bản `PageTransition`, `ScrollReveal`, `FadeInView` và `AnimatedCounter`).
   - Khi người dùng bật chế độ giảm chuyển động trên hệ điều hành, mọi hoạt ảnh lặp vô hạn (`.radar::after`, `.camera-rec::before`, `.animate-pulse`, `.animate-spin`) dừng ngay lập tức và mọi phép biến đổi vị trí (`transform`) bị vô hiệu hóa.
2. **Bảo toàn trạng thái luồng bảo vệ (Protected Flows)**:
   - Không có bất kỳ animation nào trì hoãn việc hiển thị thông báo lỗi xác thực API Key (`status === 'invalid'`), cảnh báo thu hồi khóa (Revoke Provider), hoặc trạng thái thanh toán NOWPayments/PayOS.
   - Độ lệch bố cục tích lũy do chuyển động (`CLS`) bằng `0.00`.
