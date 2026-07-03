# Design System Master File — Saigon Factory

> **LOGIC:** Khi xây dựng page cụ thể, kiểm tra `design-system/pages/[page-name].md` trước.
> Nếu file đó tồn tại, rules trong đó **ghi đè** Master file này.
> Nếu không, tuân theo các rules dưới đây.
>
> **EN:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Sophia AI Factory
**Brand:** Saigon Factory
**Generated:** 2026-07-03
**Style:** Retro-future Saigon — 1960s print shop meets modern AI automation

---

## Design System Overview / Tổng Quan

Saigon Factory là sự kết hợp giữa hoài cổ Sài Gòn những năm 1960 và công nghệ AI hiện đại. Ấm áp, gần gũi, nhưng vẫn chuyên nghiệp và mạnh mẽ.

**EN:** Saigon Factory blends 1960s Saigon warmth with modern AI precision. Approachable, professional, and memorable.

| Attribute | Value |
|-----------|-------|
| Primary / Chủ đạo | Amber #D97706 |
| Accent / Nhấn | Indigo #6366F1 |
| Background / Nền | #0F0F11 (dark) |
| Surface / Bề mặt | #18181B |
| Corner / Bo góc | rounded-lg (8px) |
| Headline Font | Inter 28px / 700 |
| Body Font | Inter 15px / 400 |
| Label Font | IBM Plex Sans 13px / 500 |
| Theme / Giao diện | Dark mode (tối) |

**Vibe:** Ấm áp như ánh đèn vàng Sài Gòn xưa, kết hợp với nét hiện đại của AI.

**EN:** Warm like old Saigon's amber streetlights, powered by modern AI.

---

## Color Palette / Bảng Màu

### Core Colors / Màu Chính

| Role | Hex | CSS Variable | Usage / Cách Dùng |
|------|-----|--------------|-------------------|
| Primary (Amber) | `#D97706` | `--color-primary` | Buttons, links, highlights / Nút bấm, liên kết, điểm nhấn |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text on amber backgrounds / Chữ trên nền cam |
| Accent (Indigo) | `#6366F1` | `--color-accent` | Secondary CTAs, active states / CTA phụ, trạng thái active |
| On Accent | `#FFFFFF` | `--color-on-accent` | Text on indigo backgrounds / Chữ trên nền tím |
| Background | `#0F0F11` | `--color-background` | Main page background / Nền chính |
| Surface | `#18181B` | `--color-surface` | Cards, panels, inputs / Thẻ, bảng, ô nhập |
| Surface Hover | `#1F1F23` | `--color-surface-hover` | Hover state for surfaces / Hover trên bề mặt |
| Surface Border | `#27272A` | `--color-border` | Borders, dividers / Viền, đường kẻ |
| Foreground | `#F4F4F5` | `--color-foreground` | Primary text / Chữ chính |
| Muted | `#A1A1AA` | `--color-muted` | Secondary text, hints / Chữ phụ, gợi ý |
| Destructive | `#EF4444` | `--color-destructive` | Errors, delete actions / Lỗi, xoá |
| Success | `#22C55E` | `--color-success` | Success states, confirmations / Thành công |
| Warning | `#F59E0B` | `--color-warning` | Warnings, alerts / Cảnh báo |
| Info | `#3B82F6` | `--color-info` | Info banners, tips / Thông tin |
| Ring | `#D97706` | `--color-ring` | Focus rings, active borders / Viền focus |

### Textures / Hoạ Tiết

- **Letterpress shadow:** Dùng `inset` shadow mô phỏng chữ in ép nổi (cho headings lớn)
- **Amber glow:** `box-shadow: 0 0 20px rgba(217, 119, 6, 0.15)` — hiệu ứng phát sáng màu hổ phách
- **Indigo wash:** Lớp phủ mờ xanh chàm cho banner/section đặc biệt
- **Grain texture:** Noise overlay nhẹ (0.5%) trên background để tạo cảm giác giấy in

**EN:**
- Letterpress inset shadows for large headings
- Amber glow: `0 0 20px rgba(217, 119, 6, 0.15)` for CTA glow effects
- Indigo wash for special banners
- Subtle grain texture (0.5% noise overlay) on backgrounds

---

## Typography / Kiểu Chữ

### Font Stack

| Role | Font | Weight | Size | CSS |
|------|------|--------|------|-----|
| Headline / Tiêu đề | Inter | 700 (Bold) | 28px | `--font-headline` |
| Subheading / Tiêu đề phụ | Inter | 600 (SemiBold) | 20px | `--font-subheading` |
| Body / Nội dung | Inter | 400 (Regular) | 15px | `--font-body` |
| Label / Nhãn | IBM Plex Sans | 500 (Medium) | 13px | `--font-label` |
| Caption / Chú thích | IBM Plex Sans | 400 (Regular) | 12px | `--font-caption` |

### Google Fonts Import

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=Inter:wght@400;600;700;800&display=swap');
```

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 36px | 800 | 1.1 | Hero titles / Tiêu đề hero |
| Heading 1 | 28px | 700 | 1.2 | Page titles / Tiêu đề trang |
| Heading 2 | 22px | 700 | 1.3 | Section titles / Tiêu đề section |
| Heading 3 | 18px | 600 | 1.4 | Card titles / Tiêu đề thẻ |
| Body | 15px | 400 | 1.6 | Paragraphs / Đoạn văn |
| Body Small | 14px | 400 | 1.5 | Compact text / Chữ nhỏ gọn |
| Label | 13px | 500 | 1.4 | Form labels, badges / Nhãn form, huy hiệu |
| Caption | 12px | 400 | 1.4 | Footers, hints / Chân trang, gợi ý |

### Typography Mood / Phong Cách Chữ

- **Headlines:** Mạnh mẽ, rõ ràng, chữ in đậm — gợi nhớ bảng hiệu Sài Gòn xưa
- **Body:** Dễ đọc, thoải mái — không quá chật
- **Labels:** Kỹ thuật, chính xác — phù hợp với hệ thống AI

**EN:**
- **Headlines:** Bold, clear, impactful — evoking old Saigon signage
- **Body:** Readable, relaxed — generous spacing
- **Labels:** Technical, precise — fitting for an AI system

---

## Spacing / Khoảng Cách

| Token | Value | Usage / Cách Dùng |
|-------|-------|-------------------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps / Khe hở nhỏ |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps / Khoảng cách icon |
| `--space-md` | `16px` / `1rem` | Standard padding / Đệm tiêu chuẩn |
| `--space-lg` | `24px` / `1.5rem` | Section padding / Đệm section |
| `--space-xl` | `32px` / `2rem` | Large gaps / Khoảng cách lớn |
| `--space-2xl` | `48px` / `3rem` | Section margins / Lề section |
| `--space-3xl` | `64px` / `4rem` | Hero padding / Đệm hero |
| `--space-4xl` | `96px` / `6rem` | Page sections / Phân cách trang |

---

## Shadows / Đổ Bóng

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift / Nâng nhẹ |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.4)` | Cards, buttons / Thẻ, nút |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.5)` | Modals, dropdowns / Cửa sổ, menu |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.6)` | Featured cards / Thẻ nổi bật |
| `--shadow-amber` | `0 4px 20px rgba(217, 119, 6, 0.15)` | Amber glow / Phát sáng cam |

---

## Easing Curves / Đường Cong Chuyển Động

Phong cách "mechanical easing" — giống máy in cơ học: hơi chậm khi bắt đầu, dứt khoát ở cuối.

**EN:** "Mechanical easing" — like a vintage letterpress: slow start, firm finish.

```css
--ease-mechanical: cubic-bezier(0.6, 0.0, 0.4, 1.0);
--ease-print: cubic-bezier(0.4, 0.0, 0.2, 1.0);
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
```

---

## Components / Thành Phần

### Buttons / Nút Bấm

```css
/* Primary Button / Nút Chính (Amber) */
.btn-primary {
  background: #D97706;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 15px;
  border: none;
  transition: all 250ms cubic-bezier(0.6, 0.0, 0.4, 1.0);
  cursor: pointer;
}

.btn-primary:hover {
  background: #B45309;
  box-shadow: 0 4px 20px rgba(217, 119, 6, 0.25);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: none;
}

/* Accent Button / Nút Nhấn (Indigo) */
.btn-accent {
  background: #6366F1;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 15px;
  border: none;
  transition: all 250ms cubic-bezier(0.6, 0.0, 0.4, 1.0);
  cursor: pointer;
}

.btn-accent:hover {
  background: #4F46E5;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.25);
  transform: translateY(-1px);
}

/* Secondary Button / Nút Phụ */
.btn-secondary {
  background: transparent;
  color: #D97706;
  border: 2px solid #D97706;
  padding: 12px 24px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 15px;
  transition: all 250ms cubic-bezier(0.6, 0.0, 0.4, 1.0);
  cursor: pointer;
}

.btn-secondary:hover {
  background: rgba(217, 119, 6, 0.1);
}

/* Ghost Button / Nút Mờ */
.btn-ghost {
  background: transparent;
  color: #A1A1AA;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 14px;
  border: none;
  transition: all 150ms ease;
  cursor: pointer;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #F4F4F5;
}
```

### Cards / Thẻ

```css
.card {
  background: #18181B;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #27272A;
  box-shadow: var(--shadow-md);
  transition: all 250ms cubic-bezier(0.6, 0.0, 0.4, 1.0);
}

.card:hover {
  border-color: #D97706;
  box-shadow: var(--shadow-amber);
  transform: translateY(-2px);
}

/* Featured Card / Thẻ Nổi Bật */
.card-featured {
  background: #18181B;
  border-radius: 8px;
  padding: 32px;
  border: 1px solid #D97706;
  box-shadow: var(--shadow-amber);
}
```

### Inputs / Ô Nhập

```css
.input {
  background: #18181B;
  color: #F4F4F5;
  padding: 12px 16px;
  border: 1px solid #27272A;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.input::placeholder {
  color: #A1A1AA;
}

.input:focus {
  border-color: #D97706;
  outline: none;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
}

.input-error {
  border-color: #EF4444;
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}
```

### Labels / Nhãn

```css
.label {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: #A1A1AA;
  margin-bottom: 6px;
  display: block;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

### Modals / Cửa Sổ

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
}

.modal {
  background: #18181B;
  border: 1px solid #27272A;
  border-radius: 8px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}

.modal-header {
  margin-bottom: 24px;
}

.modal-close {
  background: transparent;
  border: none;
  color: #A1A1AA;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.modal-close:hover {
  color: #F4F4F5;
  background: rgba(255, 255, 255, 0.05);
}
```

### Navigation / Thanh Điều Hướng

```css
.nav {
  background: rgba(15, 15, 17, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #27272A;
}

.nav-link {
  color: #A1A1AA;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 150ms ease;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nav-link:hover {
  color: #D97706;
  background: rgba(217, 119, 6, 0.08);
}

.nav-link-active {
  color: #D97706;
}
```

### Badges / Huy Hiệu

```css
.badge {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 500;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-amber {
  background: rgba(217, 119, 6, 0.15);
  color: #D97706;
}

.badge-indigo {
  background: rgba(99, 102, 241, 0.15);
  color: #6366F1;
}

.badge-green {
  background: rgba(34, 197, 94, 0.15);
  color: #22C55E;
}

.badge-gray {
  background: rgba(161, 161, 170, 0.1);
  color: #A1A1AA;
}
```

---

## Page-Specific Specs / Chi Tiết Theo Trang

### Landing / Trang Chủ

| Element | Spec |
|---------|------|
| **Visual vibe** | Hero section với amber gradient `linear-gradient(135deg, #0F0F11 0%, #1a0f0a 50%, #0F0F11 100%)` |
| **Hero headline** | 36px/800 Inter, white, có letterpress shadow nhẹ |
| **Hero subtitle** | 18px/400 Inter, #A1A1AA |
| **Primary CTA** | .btn-primary (Amber) với amber glow effect |
| **Secondary CTA** | .btn-secondary (Amber outline) |
| **Feature cards** | .card với icon 28px amber, tiêu đề 18px/600, mô tả 15px/400 |
| **Trust signals** | Logo cloud trắng/xám, opacity 0.5-0.7 |
| **Footer** | Surface `#18181B`, text muted, IBM Plex Sans 13px |
| **Animation** | Mechanical easing, fade-in-up staggered sections |

**EN:** Amber gradient hero, bold 36px headline, feature cards with amber icons, mechanical easing animations.

### Pricing / Bảng Giá

| Element | Spec |
|---------|------|
| **Section bg** | `#0F0F11` |
| **Card** | .card base, 3 cột (mobile: stack) |
| **Most Popular** | .card-featured (amber border), badge "Phổ Biến Nhất / Most Popular" |
| **Tier name** | 22px/700 Inter, white |
| **Price** | 36px/800 Inter, amber |
| **Price period** | 15px/400, muted |
| **Features** | 14px/400, check icon `#22C55E`, dấu X icon `#EF4444` |
| **CTA** | .btn-primary (free tier: .btn-secondary) |
| **FAQ** | 15px/400, question=foreground, answer=muted |

**EN:** Three-column cards, featured card with amber border, check/cross icons for features.

### Dashboard

| Element | Spec |
|---------|------|
| **Sidebar** | Surface `#18181B`, border-right `#27272A`, 240px width |
| **Sidebar logo** | 18px/700, amber |
| **Sidebar links** | 13px/500 IBM Plex Sans, uppercase, muted → amber on active |
| **Top bar** | Blur nav style, breadcrumb 13px/500 |
| **Main content** | `#0F0F11` |
| **Stat card** | .card, 3 cột, số liệu 28px/700 white, label 13px/500 uppercase muted |
| **Table header** | 13px/500 IBM Plex Sans, uppercase, muted, border-bottom `#27272A` |
| **Table row** | 15px/400, foreground, hover: `#1F1F23` |
| **Section title** | 22px/700 with amber left border `2px solid #D97706`, padding-left 12px |

**EN:** Dark sidebar, uppercase IBM Plex Sans nav, stat cards, amber-accented section titles.

### Auth / Login

| Element | Spec |
|---------|------|
| **Page layout** | Centered card, subtle amber glow background `radial-gradient(ellipse at center, rgba(217,119,6,0.05) 0%, transparent 70%)` |
| **Card** | .modal style (max 420px) |
| **Logo** | 22px/700 amber centered |
| **Title** | "Đăng Nhập / Sign In" 22px/700 centered |
| **Inputs** | .input, full width, label .label ở trên |
| **Submit** | .btn-primary, full width |
| **Links** | 14px/400, amber, hover: underline |
| **Divider** | "hoặc / or" với 2 đường kẻ ngang `#27272A` |

**EN:** Centered card on amber glow gradient, full-width inputs, social login divider.

### Auth / Register / Đăng Ký

| Element | Spec |
|---------|------|
| **Layout** | Giống Login (consistent auth UX) |
| **Fields** | Email, password, confirm password, name |
| **Submit** | .btn-accent (Indigo — phân biệt với Login) |
| **Terms** | 12px/400 caption, link amber |
| **Success** | Chuyển hướng đến Setup Wizard |

**EN:** Same layout as Login but with Indigo accent submit button to distinguish from Login.

### Setup Wizard / Thiết Lập

| Element | Spec |
|---------|------|
| **Layout** | Stepper dạng horizontal (desktop) / vertical (mobile) |
| **Step indicator** | Circle 32px, .badge-amber (active), .badge-gray (inactive), check icon (complete) |
| **Step title** | 18px/600, current step name |
| **Card** | .card, max 600px centered |
| **Inputs** | API key fields với ẩn/hiện toggle, .input |
| **Help text** | 13px/400 caption, muted, link icon đến docs |
| **Navigation** | Back (ghost) + Next (primary) |
| **Completion** | Confetti + "Chúc Mừng! / Congratulations!" 28px/700 amber |

**EN:** Horizontal stepper, amber active step, API key inputs with show/hide toggle, back/next navigation.

### Settings / Cài Đặt

| Element | Spec |
|---------|------|
| **Layout** | Left sidebar menu (200px) + main content |
| **Section headers** | 22px/700 with amber left border (giống Dashboard) |
| **Form groups** | .card, mỗi nhóm setting một card riêng |
| **Form labels** | .label (IBM Plex Sans 13px uppercase) |
| **Inputs** | .input |
| **Toggle/Switch** | Amber `#D97706` when active, `#27272A` track |
| **Save button** | .btn-primary |
| **Cancel** | .btn-ghost |
| **Danger zone** | Red border `#EF4444`, destructive button, confirmation required |

**EN:** Sidebar menu settings, card-per-section layout, amber toggles, danger zone with confirmation.

### Billing / Thanh Toán

| Element | Spec |
|---------|------|
| **Current plan card** | .card-featured (amber border), hiển thị tier hiện tại |
| **Plan name** | 22px/700 |
| **Price** | 28px/700 amber |
| **Usage meter** | Progress bar: track `#27272A`, fill `#D97706`, label 13px/500 right |
| **Invoice table** | .card style, table rows, date + amount + status badge |
| **Status badge** | paid=badge-green, pending=badge-amber, failed=badge-destructive |
| **Payment methods** | Card list với remove button, add button (btn-secondary) |
| **Upgrade CTA** | .btn-accent (Indigo) — "Nâng Cấp / Upgrade" |
| **Cancel** | .btn-ghost destructive, confirmation dialog |

**EN:** Featured current plan card, usage progress bar, invoice table with status badges, upgrade via Indigo CTA.

---

## Style Guidelines / Nguyên Tắc Thiết Kế

**Style:** Retro-future Saigon — 1960s letterpress meets 2026 AI

**EN:** 1960s Saigon print shop meets modern AI automation.

**Keywords / Từ Khoá:**
- Ấm áp / Warm
- Chữ in / Letterpress
- Cơ khí / Mechanical
- AI hiện đại / Modern AI
- Màu hổ phách / Amber tones
- Sang trọng nhưng gần gũi / Premium yet approachable

**Textures & Effects:**
- Overlay noise nhẹ trên background
- Inset shadow cho chữ lớn (letterpress effect)
- Amber glow cho CTA
- Grain texture trên surface

**Animation / Hoạt Ảnh:**
- Mechanical easing `cubic-bezier(0.6, 0.0, 0.4, 1.0)`
- Staggered fade-in-up cho sections
- No parallax, no overscroll
- Hover scale nhẹ (1.02) cho cards, không làm shift layout

### Page Pattern / Mẫu Trang

**Pattern Name:** Saigon Factory

- **Conversion Strategy / Chiến Lược:** Warm CTA (amber glow), không ép buộc, value-first messaging
- **Primary CTA:** Nút Amber có glow effect
- **Section Order / Thứ Tự:** 1. Hero (AI value prop), 2. Trust signals, 3. Features, 4. Pricing, 5. FAQ, 6. Final CTA

---

## Anti-Patterns / Cấm Sử Dụng

| ❌ Anti-Pattern | Why / Lý Do |
|----------------|-------------|
| Neon/bright colors | Phá vỡ vibe ấm áp Saigon / Breaks warm Saigon vibe |
| Blue primary (#2563EB) | Sai brand identity — dùng Indigo (#6366F1) làm accent, không phải primary |
| Light/pink/purple | Sai theme — Saigon Factory là dark mode với amber |
| Plus Jakarta Sans | Sai font — dùng Inter + IBM Plex Sans |
| Emojis as icons | Thiếu chuyên nghiệp — dùng SVG icons (Lucide, Heroicons) |
| Scale transforms on hover | Gây layout shift |
| Instant state changes | Thiếu mechanical feel — dùng 150-250ms easing |

### Additional Forbidden Patterns / Thêm:

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio (test on dark bg)
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y
- ❌ **Light mode in new components** — Saigon Factory is dark-mode only

---

## Pre-Delivery Checklist / Danh Sách Kiểm Tra

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms mechanical easing)
- [ ] Dark mode: text contrast 4.5:1 minimum (white on dark)
- [ ] Focus states visible for keyboard navigation (amber ring)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] Amber glow effects use `rgba(217, 119, 6, ...)` not raw orange
- [ ] Surface elements use `#18181B` not `#0F0F11` (that's background)

---

## Design Tokens Summary / Tóm Tắt

```css
:root {
  /* Colors */
  --color-primary: #D97706;
  --color-on-primary: #FFFFFF;
  --color-accent: #6366F1;
  --color-on-accent: #FFFFFF;
  --color-background: #0F0F11;
  --color-surface: #18181B;
  --color-surface-hover: #1F1F23;
  --color-border: #27272A;
  --color-foreground: #F4F4F5;
  --color-muted: #A1A1AA;
  --color-destructive: #EF4444;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-info: #3B82F6;
  --color-ring: #D97706;

  /* Typography */
  --font-headline: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-label: 'IBM Plex Sans', sans-serif;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.6);
  --shadow-amber: 0 4px 20px rgba(217, 119, 6, 0.15);

  /* Easing */
  --ease-mechanical: cubic-bezier(0.6, 0.0, 0.4, 1.0);
}
```
