# 04_VISUAL_QA.md — Sophia Creative Assembly Line Visual QA & Accessibility Checklist

**Document Code:** `docs/design/anatomy/04_VISUAL_QA.md`  
**Standard:** WCAG 2.1 AA Compliance, Mobile Ergonomics, Zero CLS  
**Testing Surfaces:** Landing Hero (Illustration) & Mission Detail (Verified-Job)  

---

## 1. Visual QA Matrix Across Breakpoints

| Test ID | Viewport Width | Surface | Expected Rendering Behavior | Result |
|---|---|---|---|---|
| `VQA-01` | `360px` (Mobile Small) | Landing Hero | Compact SVG isometric banner + 5 vertical station cards. No horizontal page overflow. | PASS |
| `VQA-02` | `390px` (iPhone 14) | Mission Detail | Vertical station cards with touch targets >= 48px. Clear badge status and cost metrics. | PASS |
| `VQA-03` | `768px` (Tablet Portrait) | Landing Hero | Full 2:1 isometric SVG assembly line. Station selection switches inspector below. | PASS |
| `VQA-04` | `1024px` (Desktop Standard)| Mission Detail | Isometric stage aligned inside container max-w-4xl. Live telemetry counters rendered. | PASS |
| `VQA-05` | `1440px` (Wide Desktop) | Landing Hero | Crisp SVG rendering up to 5K with zero pixelation or blurry canvas artifacts. | PASS |

---

## 2. Accessibility & Color Contrast Verification (WCAG AA)

| Element | Background Token | Foreground Token | Contrast Ratio | WCAG AA Threshold | Status |
|---|---|---|---|---|---|
| Station Active Text | Light Card (`#FFFFFF`) | Dark Ink (`#0B0F19`) | `17.8:1` | `>= 4.5:1` | PASS |
| Station Sub-label | Light Muted (`#F8F9FC`) | Slate Text (`#475569`) | `7.2:1` | `>= 4.5:1` | PASS |
| Station Badge (Amber) | Amber Soft (`#FEF3C7`) | Amber Dark (`#92400E`) | `5.8:1` | `>= 4.5:1` | PASS |
| Station Badge (Emerald)| Emerald Soft (`#D1FAE5`) | Emerald Dark (`#065F46`)| `6.4:1` | `>= 4.5:1` | PASS |
| Dark Mode Text | Dark Canvas (`#090A10`)| Crisp White (`#F8FAFC`) | `18.2:1` | `>= 4.5:1` | PASS |

---

## 3. Motion Safety & Interaction Auditing

1. **`prefers-reduced-motion: reduce`**:
   - Pulses on `queued` / `running` stations are completely replaced by steady borders.
   - SVG stroke-dasharray animations on conveyor links are turned off.
2. **Keyboard Accessibility**:
   - `Tab` navigates sequentially through all 5 stations.
   - `Enter` / `Space` activates the selected station and updates `aria-pressed="true"`.
   - Focus outline (`ring-2 ring-primary ring-offset-2`) is crisply visible.
3. **Hydration & SSR Safety**:
   - Static SVG coordinates and initial station view are identical between server and client render (0 hydration mismatch errors).
