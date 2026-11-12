# 04 — ĐẶC TẢ HỆ THỐNG DESIGN TOKENS (TOKEN SPECIFICATION)
> **Tài liệu:** `docs/design/zen-design-os/04-TOKEN-SPECIFICATION.md`
> **Nguồn chân lý DTCG JSON:** `apps/sophia-ai-factory/src/seed/design-tokens/zen-design-tokens.dtcg.json`
> **Nguồn chân lý CSS Runtime:** `apps/sophia-ai-factory/src/app/globals.css`
> **Tiêu chuẩn:** W3C Design Tokens Community Group (DTCG) Format `2025.10`

---

## 1. BẢNG MÀU NGỮ NGHĨA HAI CHẾ ĐỘ (DUAL-THEME SEMANTIC COLOR TOKENS)

| Biến CSS (`src/app/globals.css`) | Đường dẫn DTCG (`zen-design-tokens.dtcg.json`) | Chế độ Sáng (`:root` — Executive Studio Ivory) | Chế độ Tối (`.dark` — Director's Control Deck) | Vai trò ngữ nghĩa (Material 3 Role Mapping) |
|---|---|---|---|---|
| `--background` | `color.semantic.{light\|dark}.background` | `#F8F9FC` | `#090A10` | `surface` — Nền chính của toàn bộ khung nhìn ứng dụng |
| `--foreground` | `color.semantic.{light\|dark}.foreground` | `#0B0F19` | `#F8FAFC` | `on-surface` — Màu chữ chính có độ tương phản cực cao |
| `--card` | `color.semantic.{light\|dark}.card` | `#FFFFFF` | `#11131F` | `surface-container` — Bề mặt thẻ KPI, biểu mẫu BYOK và bảng dữ liệu |
| `--card-foreground` | `color.semantic.{light\|dark}.card-foreground` | `#0B0F19` | `#F8FAFC` | `on-surface` — Màu chữ trên bề mặt thẻ |
| `--popover` | `color.semantic.{light\|dark}.popover` | `#FFFFFF` | `#16192B` | `surface-container-high` — Menu thả xuống, hộp thoại, ngăn kéo |
| `--primary` | `color.semantic.{light\|dark}.primary` | `#4338CA` | `#6366F1` | `primary` — Hành động chính, nút CTA, bước đang hoạt động |
| `--primary-foreground` | `color.semantic.{light\|dark}.primary-foreground` | `#FFFFFF` | `#FFFFFF` | `on-primary` — Chữ trên nền nút chính |
| `--secondary` | `color.semantic.{light\|dark}.secondary` | `#7E22CE` | `#A855F7` | `secondary` — Tác nhân AI (Agent Telemetry, AI Orchestration) |
| `--accent` | `color.semantic.{light\|dark}.accent` | `#B45309` | `#F59E0B` | `tertiary` — Tín hiệu doanh thu, MCU Credits, cảnh báo chú ý |
| `--success` | `color.semantic.{light\|dark}.success` | `#047857` | `#10B981` | Trạng thái xác thực API Key thành công, hệ thống khỏe mạnh |
| `--destructive` | `color.semantic.{light\|dark}.destructive` | `#BE123C` | `#F43F5E` | Lỗi xác thực, thu hồi khóa, cảnh báo dừng khẩn cấp |
| `--muted` | `color.semantic.{light\|dark}.muted` | `#F1F5F9` | `#16192B` | `surface-variant` — Nền phụ, vùng tìm kiếm, thẻ không hoạt động |
| `--muted-foreground` | `color.semantic.{light\|dark}.muted-foreground` | `#475569` | `#94A3B8` | `on-surface-variant` — Chữ phụ, nhãn hướng dẫn, chú thích |
| `--border` | `color.semantic.{light\|dark}.border` | `#E2E8F0` | `#1E2235` | `outline-variant` — Đường viền phân tách thẻ và ô nhập liệu |
| `--ring` | `color.semantic.{light\|dark}.ring` | `#4338CA` | `#6366F1` | Vòng focus bàn phím (`:focus-visible`) chuẩn WCAG 2.2 AA |

---

## 2. TOKEN SÂN KHẤU VIDEO CHUYÊN DỤNG (DEDICATED STUDIO STAGE TOKENS)

Các token này giữ nguyên giá trị tối ở cả hai chế độ Sáng và Tối để đảm bảo độ chính xác thị giác khi xem trước video:

| Biến CSS | Đường dẫn DTCG | Giá trị cố định | Mục đích sử dụng |
|---|---|---|---|
| `--studio-stage-bg` | `color.studio-stage.background` | `#090A10` | Nền khung hình video 9:16 / 16:9 (`TimelineBrowserPreview`, `SophiaArtifactCanvas`) |
| `--studio-stage-panel` | `color.studio-stage.panel` | `#11131F` | Thanh điều khiển lớp phủ bên trong trình phát video |
| `--studio-stage-fg` | `color.studio-stage.foreground` | `#F8FAFC` | Chữ và biểu tượng hiển thị đè lên khung video |
| `--studio-stage-border` | `color.studio-stage.border` | `#1E2235` | Viền khung máy quay và thước phim (`.film-strip`) |

---

## 3. TOKEN CHỮ VIẾT, KHOẢNG CÁCH, BO GÓC & CHUYỂN ĐỘNG

### 3.1. Typography (`typography.fontFamily`)
- **UI & Heading (`fontFamily.display` / `fontFamily.sans`)**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (nạp đầy đủ subset `latin` + `vietnamese`).
- **Monospace (Telemetry / API Keys / Financial Counters, `fontFamily.mono`)**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (kích hoạt `font-variant-numeric: tabular-nums`).
- **Scoped Landing Display (`.v3-core` only)**: `'Archivo', 'Inter', system-ui, sans-serif` (`font-variation-settings: "wdth" 104` / `102` chỉ dùng cho tiêu đề scrollytelling trên Landing/Guide; không dùng cho UI ứng dụng; tuyệt đối không dùng `Satoshi` hay `Instrument Serif`).

### 3.2. Bo góc (`radius`)
- `--radius-sm`: `0.375rem` (`6px`)
- `--radius-md`: `0.5rem` (`8px`)
- `--radius-lg`: `0.75rem` (`12px`)
- `--radius-xl`: `1rem` (`16px`)

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
  getSemanticColorMap,
  getContrastRatio,
  meetsWcagAA,
} from '@/seed/design-tokens';

const lightColors = getSemanticColorMap('light'); // Trả về bảng màu Executive Studio Ivory
const darkColors = getSemanticColorMap('dark');   // Trả về bảng màu Director's Control Deck
const ratio = getContrastRatio(lightColors.foreground, lightColors.background); // 18.36
```
