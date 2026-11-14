# 04 — ĐẶC TẢ HỆ THỐNG DESIGN TOKENS (TOKEN SPECIFICATION)
> **Tài liệu:** `docs/design/zen-design-os/04-TOKEN-SPECIFICATION.md`
> **Nguồn chân lý DTCG JSON:** `apps/sophia-ai-factory/src/seed/design-tokens/zen-design-tokens.dtcg.json`
> **Nguồn chân lý CSS Runtime:** `apps/sophia-ai-factory/src/app/globals.css`
> **Tiêu chuẩn:** W3C Design Tokens Community Group (DTCG) Format `2025.10`

---

## 1. BẢNG MÀU NGỮ NGHĨA HAI CHẾ ĐỘ (DUAL-THEME SEMANTIC COLOR TOKENS)

Bảng dưới đây liệt kê đầy đủ **29 vai trò ngữ nghĩa DTCG** trong `zen-design-tokens.dtcg.json` cùng các biến CSS runtime tương ứng trong `src/app/globals.css` (Authority #1):

| Biến CSS (`src/app/globals.css`) | Đường dẫn DTCG (`zen-design-tokens.dtcg.json`) | Chế độ Sáng (`:root` — Executive Studio Ivory) | Chế độ Tối (`.dark` — Director's Control Deck) | Vai trò ngữ nghĩa (Material 3 Role Mapping) |
|---|---|---|---|---|
| `--surface-dim` | `color.semantic.{light\|dark}.surface-dim` | `#EEF1F7` | `#1A1C28` (`var(--muted)`) | Nền lùi bậc thấp, vùng đệm tách khối |
| `--surface` / `--background` | `color.semantic.{light\|dark}.surface` | `#F8F9FC` | `#090A10` | Nền chính của toàn bộ khung nhìn ứng dụng |
| `--surface-bright` | `color.semantic.{light\|dark}.surface-bright` | `#FFFFFF` | `#0E1017` (`var(--background-secondary)`) | Bề mặt phụ sáng hơn nền chính |
| `--surface-container-lowest` | `color.semantic.{light\|dark}.surface-container-lowest` | `#FFFFFF` | `#08080C` | Hốc ô nhập liệu (Dark) / thẻ nổi tinh khiết (Light) |
| `--surface-container-low` | `color.semantic.{light\|dark}.surface-container-low` | `#F3F5FA` | `#1A1C28` (`var(--muted)`) | Vùng gom nhóm phụ, thanh điều hướng bên |
| `--surface-container` / `--card` | `color.semantic.{light\|dark}.surface-container` | `#FFFFFF` | `#11131F` | Bề mặt thẻ KPI, biểu mẫu BYOK và bảng dữ liệu |
| `--surface-container-high` | `color.semantic.{light\|dark}.surface-container-high` | `#ECEFF6` | `#1F1F29` | Bề mặt nổi bậc cao (hover, active drawer) |
| `--surface-container-highest` | `color.semantic.{light\|dark}.surface-container-highest` | `#E2E7F1` | `#23232F` | Chip đang chọn, thanh tiêu đề ghim, tooltip |
| `--on-surface` / `--foreground` | `color.semantic.{light\|dark}.on-surface` | `#0B0F19` | `#F8FAFC` | Màu chữ chính có độ tương phản cao (`18.19:1` Light / `18.89:1` Dark) |
| `--on-surface-variant` / `--muted-foreground` | `color.semantic.{light\|dark}.on-surface-variant` | `#475569` | `#94A3B8` | Chữ phụ, nhãn hướng dẫn, chú thích |
| `--outline` | `color.semantic.{light\|dark}.outline` | `#64748B` | `#64748B` | Đường viền điều khiển tương tác đạt chuẩn 3:1 (`4.52:1` Light / `4.15:1` Dark) |
| `--outline-variant` / `--border` | `color.semantic.{light\|dark}.outline-variant` | `#E2E8F0` | `#1E2235` | Đường viền phân tách thẻ và bảng dữ liệu |
| `--primary` | `color.semantic.{light\|dark}.primary` | `#4338CA` | `#6366F1` | Hành động chính, nút CTA, bước đang hoạt động |
| `--primary-text` | `color.semantic.{light\|dark}.primary-text` | `#4338CA` | `#818CF8` | Chữ nhấn màu Indigo trên nền `surface-container` đạt chuẩn AA |
| `--primary-solid` | `color.semantic.{light\|dark}.primary-solid` | `#4338CA` | `#4F46E5` | Nền nút đặc có tương phản AA với chữ trắng (`#FFFFFF`) |
| `--on-primary` / `--primary-foreground` | `color.semantic.{light\|dark}.on-primary` | `#FFFFFF` | `#FFFFFF` | Chữ trên nền nút chính |
| `--primary-container` | `color.semantic.{light\|dark}.primary-container` | `#E0E7FF` | `#211966` | Nền huy hiệu / điều hướng đang chọn |
| `--on-primary-container` | `color.semantic.{light\|dark}.on-primary-container` | `#1E1B4B` | `#DAD6FF` | Chữ và biểu tượng trên nền `primary-container` |
| `--secondary` | `color.semantic.{light\|dark}.secondary` | `#7E22CE` | `#A855F7` | Tác nhân AI (Agent Telemetry, AI Orchestration) |
| `--on-secondary` / `--secondary-foreground` | `color.semantic.{light\|dark}.on-secondary` | `#FFFFFF` | `#FFFFFF` | Chữ trên nền `secondary` |
| `--tertiary` / `--accent` | `color.semantic.{light\|dark}.tertiary` | `#B45309` | `#F59E0B` | Tín hiệu doanh thu, MCU Credits, điểm nhấn điện ảnh |
| `--on-tertiary` | `color.semantic.{light\|dark}.on-tertiary` | `#FFFFFF` | `#090A10` | Chữ trên nền `tertiary` |
| `--success` | `color.semantic.{light\|dark}.success` | `#047857` | `#10B981` | Trạng thái xác thực API Key thành công, hệ thống khỏe mạnh |
| `--warning` | `color.semantic.{light\|dark}.warning` | `#B45309` | `#F59E0B` | Cảnh báo hạn mức, trạng thái chờ phê duyệt thủ công |
| `--error` | `color.semantic.{light\|dark}.error` | `#BE123C` | `#FB7185` | Văn bản / nhãn lỗi đạt chuẩn tương phản trên nền thẻ tối |
| `--info` | `color.semantic.{light\|dark}.info` | `#0E7490` | `#22D3EE` | Nhãn telemetry, độ trễ và trạng thái thông tin |
| `--inverse-surface` | `color.semantic.{light\|dark}.inverse-surface` | `#090A10` | `#F8FAFC` | Nền đảo chiều cho toast / snackbar / banner tương phản cao |
| `--inverse-on-surface` | `color.semantic.{light\|dark}.inverse-on-surface` | `#F8FAFC` | `#0B0F19` | Chữ trên bề mặt `inverse-surface` |
| `--inverse-primary` | `color.semantic.{light\|dark}.inverse-primary` | `#818CF8` | `#685AED` | Hành động nhấn trên bề mặt `inverse-surface` |
| `--muted` / `--surface-variant` | *(Biến CSS runtime trong `globals.css`)* | `#F1F5F9` | `#1A1C28` | Nền phụ cho khối tìm kiếm, skeleton và vùng tĩnh |
| `--card-foreground` / `--popover-foreground` | *(CSS alias của `--on-surface` trong `globals.css`)* | `#0B0F19` | `#F8FAFC` | Màu chữ trên bề mặt thẻ và hộp thoại |
| `--popover` | *(CSS alias của `--card` trong `globals.css`)* | `#FFFFFF` | `#11131F` | Menu thả xuống, hộp thoại, ngăn kéo |
| `--destructive` | *(Biến CSS runtime trong `globals.css`)* | `#BE123C` | `#F43F5E` | Nút hành động xóa / thu hồi khóa / cảnh báo dừng khẩn cấp |
| `--ring` | *(CSS alias của `--primary` trong `globals.css`)* | `#4338CA` | `#6366F1` | Vòng focus bàn phím (`:focus-visible`) chuẩn WCAG 2.2 AA |

---

## 2. TOKEN SÂN KHẤU VIDEO CHUYÊN DỤNG (DEDICATED STUDIO STAGE TOKENS)

Các biến CSS runtime bất biến này được khai báo trực tiếp trong `:root` của `src/app/globals.css:30-33` (không nằm trong `zen-design-tokens.dtcg.json`) và giữ nguyên giá trị tối ở cả hai chế độ Sáng và Tối để đảm bảo độ chính xác thị giác khi xem trước video:

| Biến CSS (`src/app/globals.css`) | Nguồn khai báo | Giá trị cố định | Mục đích sử dụng |
|---|---|---|---|
| `--studio-stage-bg` | `:root` (`src/app/globals.css:30`) | `#090A10` | Nền khung hình video 9:16 / 16:9 (`TimelineBrowserPreview`, `SophiaArtifactCanvas`) |
| `--studio-stage-panel` | `:root` (`src/app/globals.css:31`) | `#11131F` | Thanh điều khiển lớp phủ bên trong trình phát video |
| `--studio-stage-fg` | `:root` (`src/app/globals.css:32`) | `#F8FAFC` | Chữ và biểu tượng hiển thị đè lên khung video |
| `--studio-stage-border` | `:root` (`src/app/globals.css:33`) | `#1E2235` | Viền khung máy quay và thước phim (`.film-strip`) |

---

## 3. TOKEN CHỮ VIẾT, KHOẢNG CÁCH, BO GÓC & CHUYỂN ĐỘNG

### 3.1. Typography (`typography.fontFamily`)
- **UI & Heading (`fontFamily.display` / `fontFamily.sans`)**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (nạp đầy đủ subset `latin` + `vietnamese`).
- **Monospace (Telemetry / API Keys / Financial Counters, `fontFamily.mono`)**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (kích hoạt `font-variant-numeric: tabular-nums`).
- **Scoped Landing Display (`.v3-core` only)**: `'Archivo', 'Inter', system-ui, sans-serif` (`font-variation-settings: "wdth" 104` / `102` chỉ dùng cho tiêu đề scrollytelling trên Landing/Guide; không dùng cho UI ứng dụng; tuyệt đối không dùng `Satoshi` hay `Instrument Serif`).

### 3.2. Bo góc (`--radius` & `@theme inline` trong `src/app/globals.css`)
- `--radius`: `0.75rem` (`12px` — khai báo trong `:root`)
- `--radius-sm`: `calc(var(--radius) - 4px)` (`8px` — khai báo trong `@theme inline`)
- `--radius-md`: `calc(var(--radius) - 2px)` (`10px` — khai báo trong `@theme inline`)
- `--radius-lg`: `var(--radius)` (`12px` — khai báo trong `@theme inline`)
- *(Bo góc `16px` trên thẻ chuẩn sử dụng lớp tiện ích Tailwind v4 mặc định `rounded-2xl`, không qua biến `--radius-xl` riêng.)*

### 3.3. Chuyển động (`motion`)
- `--motion-duration-instant`: `80ms`
- `--motion-duration-fast`: `150ms`
- `--motion-duration-normal`: `240ms`
- `--motion-duration-deliberate`: `400ms`
- `--motion-duration-cinematic`: `600ms`
- `--motion-ease-standard`: `cubic-bezier(0.2, 0, 0, 1)`
- `--motion-ease-emphasized`: `cubic-bezier(0.16, 1, 0.3, 1)`
- `--motion-ease-decelerate`: `cubic-bezier(0, 0, 0, 1)`
- `--motion-ease-accelerate`: `cubic-bezier(0.3, 0, 1, 1)`

---

## 4. API TRUY XUẤT TOKEN TRONG TYPESCRIPT (`src/seed/design-tokens/index.ts`)

```typescript
import {
  ZEN_DESIGN_TOKENS,
  getZenSemanticColor,
  getZenMotionDuration,
  getZenMotionEasingCss,
  getWcagContrastRatio,
  auditZenThemeContrast,
} from '@/seed/design-tokens';

const lightSurface = getZenSemanticColor('light', 'surface');      // '#F8F9FC' (Executive Studio Ivory)
const lightText = getZenSemanticColor('light', 'on-surface');      // '#0B0F19'
const darkSurface = getZenSemanticColor('dark', 'surface');        // '#090A10' (Director's Control Deck)
const ratio = getWcagContrastRatio(lightText, lightSurface);       // 18.19
const deliberateMs = getZenMotionDuration('deliberate');           // '400ms'
const pressCurve = getZenMotionEasingCss('emphasized');            // 'cubic-bezier(0.16, 1, 0.3, 1)'
const darkAuditRows = auditZenThemeContrast('dark');               // 12 cặp kiểm định chuẩn WCAG 2.2 AA
```
