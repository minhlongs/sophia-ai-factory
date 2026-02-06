# 84TEA - Vietnamese Ancient Tea Brand Guidelines

## 🎯 PROJECT MISSION

Bootstrap 84tea với Material Design 3 (MD3) 100/100 chuẩn.
Chuẩn hoá nhận diện thương hiệu trà cổ thụ Việt Nam dành cho nhượng quyền SEA.

---

## 🎨 MD3 COLOR TOKENS (REQUIRED)

### Primary Palette - Imperial Green

```css
--md-sys-color-primary: #1b5e20; /* Imperial Green - Primary brand */
--md-sys-color-on-primary: #ffffff;
--md-sys-color-primary-container: #a5d6a7; /* Light green container */
--md-sys-color-on-primary-container: #0d3911;
```

### Secondary Palette - Gold Leaf

```css
--md-sys-color-secondary: #c5a962; /* Gold Leaf - Accent */
--md-sys-color-on-secondary: #3a2e00;
--md-sys-color-secondary-container: #f5e6ba; /* Light gold container */
--md-sys-color-on-secondary-container: #231c00;
```

### Tertiary Palette - Deep Rosewood

```css
--md-sys-color-tertiary: #4e342e; /* Deep Rosewood */
--md-sys-color-on-tertiary: #ffffff;
--md-sys-color-tertiary-container: #d7ccc8;
--md-sys-color-on-tertiary-container: #1b0c07;
```

### Surface & Background

```css
--md-sys-color-surface: #fbf8f3; /* Ivory Silk */
--md-sys-color-on-surface: #4e342e;
--md-sys-color-surface-variant: #e8e1d9;
--md-sys-color-on-surface-variant: #49454f;
--md-sys-color-outline: #79747e;
--md-sys-color-outline-variant: #cac4d0;
```

### Error & States

```css
--md-sys-color-error: #b3261e;
--md-sys-color-on-error: #ffffff;
--md-sys-color-error-container: #f9dedc;
--md-sys-color-on-error-container: #410e0b;
```

---

## ✍️ MD3 TYPOGRAPHY

### Font Families

```css
--md-sys-typescale-display-font: "Playfair Display", serif; /* Headlines */
--md-sys-typescale-body-font: "Inter", sans-serif; /* Body text */
```

### Typography Scale (MD3 Standard)

```css
/* Display */
--md-sys-typescale-display-large: 57px / 64px;
--md-sys-typescale-display-medium: 45px / 52px;
--md-sys-typescale-display-small: 36px / 44px;

/* Headline */
--md-sys-typescale-headline-large: 32px / 40px;
--md-sys-typescale-headline-medium: 28px / 36px;
--md-sys-typescale-headline-small: 24px / 32px;

/* Title */
--md-sys-typescale-title-large: 22px / 28px;
--md-sys-typescale-title-medium: 16px / 24px;
--md-sys-typescale-title-small: 14px / 20px;

/* Body */
--md-sys-typescale-body-large: 16px / 24px;
--md-sys-typescale-body-medium: 14px / 20px;
--md-sys-typescale-body-small: 12px / 16px;

/* Label */
--md-sys-typescale-label-large: 14px / 20px;
--md-sys-typescale-label-medium: 12px / 16px;
--md-sys-typescale-label-small: 11px / 16px;
```

---

## 📦 MD3 COMPONENTS (REQUIRED)

### Buttons

- **Filled Button**: Primary actions (Mua ngay, Đăng ký)
- **Tonal Button**: Secondary actions (Xem thêm, Tìm hiểu)
- **Outlined Button**: Tertiary actions
- **Text Button**: Minimal emphasis
- **FAB**: Cart, Quick order

### Cards

- **Elevated Card**: Product cards, Franchise benefits
- **Filled Card**: Featured sections
- **Outlined Card**: Info cards, Comparison table

### Navigation

- **Top App Bar**: Logo left, Nav center, CTA right
- **Navigation Drawer**: Mobile menu
- **Bottom Navigation**: Mobile shortcuts
- **Tabs**: Product categories

### Inputs

- **Filled Text Field**: Forms
- **Outlined Text Field**: Search
- **Dropdown Menu**: Quantity, Options

### Feedback

- **Snackbar**: Cart added, Success
- **Dialog**: Confirm order
- **Progress Indicator**: Loading states

---

## 🍵 84TEA BRAND ELEMENTS

### Logo Usage

- Primary: 84tea wordmark in Imperial Green
- On dark: 84tea in Gold Leaf
- Minimum clear space: 8px

### Iconography

- Style: Material Symbols Rounded
- Weight: 400
- Size: 24px (default), 20px (compact), 48px (feature)

### Image Style

- Product photos: Lifestyle with Vietnamese tea culture
- Store images: Modern minimalist tea house aesthetic
- People: Diverse Asian representation

### Voice & Tone

- Vietnamese: Formal but warm (dạ/thưa style)
- English: Premium but approachable
- Keywords: Cổ thụ, Truyền thống, Năng lượng tự nhiên

---

## 📱 RESPONSIVE BREAKPOINTS (MD3)

```css
--md-sys-breakpoint-compact: 0-599px; /* Mobile */
--md-sys-breakpoint-medium: 600-839px; /* Tablet portrait */
--md-sys-breakpoint-expanded: 840-1199px; /* Tablet landscape */
--md-sys-breakpoint-large: 1200-1399px; /* Desktop */
--md-sys-breakpoint-extra-large: 1400px+; /* Large desktop */
```

---

## 🏪 FRANCHISE VISUAL STANDARDS

### Store Types

1. **Kiosk** (10-15m²): Mall locations, minimal footprint
2. **Express** (25-40m²): Street-front, takeaway focused
3. **Lounge** (50-80m²): Full tea experience, seating

### Interior Elements

- Wall color: Ivory Silk (#FBF8F3)
- Accent wall: Imperial Green (#1B5E20)
- Furniture: Natural wood + brass accents
- Lighting: Warm white (2700-3000K)

### Signage

- Main: Illuminated 84tea logo
- Menu board: Digital or printed MD3 cards
- Price tags: Gold Leaf on Ivory background

---

## 🚀 BOOTSTRAP COMMANDS

```bash
# Start fresh Next.js project with MD3
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Install MD3 dependencies
npm install @fontsource/playfair-display @fontsource/inter

# Dev server
npm run dev
```

---

## ✅ ACCEPTANCE CRITERIA

- [ ] All colors use MD3 token system
- [ ] Typography follows MD3 scale exactly
- [ ] All components use MD3 patterns
- [ ] Responsive layout follows MD3 breakpoints
- [ ] Dark mode support with MD3 color scheme
- [ ] WCAG AA accessibility compliance
- [ ] Page load < 3s on 4G
- [ ] Lighthouse Performance > 90

---

## 📁 FILE STRUCTURE

```
src/
├── app/
│   ├── layout.tsx          # MD3 providers, fonts
│   ├── page.tsx             # Homepage
│   ├── products/            # Product pages
│   ├── franchise/           # Franchise pages
│   └── globals.css          # MD3 tokens
├── components/
│   ├── ui/                  # MD3 base components
│   ├── layout/              # Navigation, Footer
│   └── products/            # Product cards
└── lib/
    └── theme.ts             # MD3 theme config
```

---

**Last Updated**: 2026-02-05
**Version**: 1.0.0
**Maintainer**: 84tea Brand Team


---

## 🚀 AGENT TEAMS + BMAD (Feb 2026)

**Enabled:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**Workflow:** `/plan:hard` → `"Gọi team thực hiện plan này"`
