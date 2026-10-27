# 02_UX_SPEC.md — Sophia Creative Assembly Line UX & Visual Specification

**Document Code:** `docs/design/anatomy/02_UX_SPEC.md`  
**Design System:** `"Director's Control Deck"` (`src/app/globals.css`)  
**Metaphor:** Industrial Precision Isometric Workstation (Pure 2D Vector SVG)  
**Target Audience:** Non-Technical CEOs & Founders (Bilingual VI / EN)  

---

## 1. Visual Metaphor & Isometric Projection Geometry

The **Sophia Creative Assembly Line** visualizes an autonomous AI video and affiliate factory as a physical, precision-engineered workstation table. Rather than abstract boxes or deceptive fake terminals, the CEO sees a transparent, 5-station conveyor bed operating with clear mechanical gates:

* **Projection Standard**: 2:1 Isometric Technical Projection (`viewBox="0 0 960 360"`).
* **Base Plinth**: Rigid steel/slate isometric chassis with subtle coordinate grid lines and directional rails linking Station 1 through Station 5.
* **5 Canonical Stations**:
  1. **Station 01 — `intake_brief` (Tiếp nhận & Định vị / Brief & Niche Intake)**:
     - *Visual*: Isometric input hopper & prism scanner.
     - *Meaning*: Validates niche compliance (CEX / Global SaaS), jurisdiction rules, and campaign objective.
  2. **Station 02 — `script_planning` (Kịch bản & Phân cảnh / Script & Storyboard)**:
     - *Visual*: Dual-layer blueprint drafting table with AI node matrix.
     - *Meaning*: Generates bilingual hooks, storyboard scenes, and regulatory FTC/MiCA disclosures.
  3. **Station 03 — `ceo_approval_gate` (Khóa phê duyệt CEO / CEO Approval Gate)**:
     - *Visual*: Heavy cryptographic vault gate with SHA-256 seal indicator and Kill-Switch interlock.
     - *Meaning*: Enforces human-in-the-loop sign-off bound to the SHA-256 payload digest before any paid media render occurs.
  4. **Station 04 — `media_render` (Tổng hợp Video & Giọng nói / Media Render Engine)**:
     - *Visual*: Multi-track optical render chamber (Inngest background worker).
     - *Meaning*: Synthesizes voiceover (ElevenLabs BYOK), visual frames, and subtitles asynchronously.
  5. **Station 05 — `publish_ledger` (Phân phối & Sổ cái Domain B / Syndication & Ledger)**:
     - *Visual*: Broadcast transmission tower coupled with an immutable ledger vault.
     - *Meaning*: Publishes to authorized channels and reconciles S2S postbacks in the Domain B ledger (100% workspace-owned, 0% platform fee).

---

## 2. Semantic State Visual Grammar (Non-Color-Alone Encoding)

Every station encodes its status via **three redundant signals**: (1) Isometric Glyph/Badge Icon, (2) Border/Surface Token Color, and (3) Explicit Bilingual Text Pill.

| Semantic State (`StationState`) | Icon / Glyph | Primary Color Token (`globals.css`) | Text Label (VI / EN) | Motion Behavior (Default vs `prefers-reduced-motion`) |
|---|---|---|---|---|
| `not_started` | Hollow Circle `○` | `--muted-foreground` (`#6B7280`) | Chưa chạy / Not Started | Static |
| `queued` | Clock / Hourglass `◷` | `--primary` (`#4338CA` / `#6366F1`) | Đang chờ / Queued | Subtle opacity pulse (disabled on reduced motion) |
| `running` | Gear / Pulse `⚙` | `--primary` (`#4338CA` / `#6366F1`) | Đang xử lý / Running | Conveyor rail dash flow (static solid line on reduced motion) |
| `needs_approval` | Shield Lock `⛨` | `--accent` (`#D97706` / `#F59E0B`) | Chờ CEO duyệt / Needs Approval | Amber highlight ring |
| `succeeded` | Checkmark `✓` | Emerald (`#059669` / `#10B981`) | Hoàn tất / Verified | Static crisp border |
| `failed` | Alert Triangle `!` | `--destructive` (`#F43F5E`) | Cảnh báo lỗi / Failed | Static high-contrast alert frame |
| `unknown` | Question `•` | `--muted-foreground` | Không xác định / Unknown | Static |

---

## 3. Responsive Breakpoints & Touch Ergonomics

* **Desktop & Tablet (`>= 640px`)**:
  - Full interactive isometric SVG canvas (`viewBox="0 0 960 360"`) with clickable/focusable station nodes.
  - Below the SVG canvas, an **Active Station Inspector Bar** displays the selected station's plain-language explanation, technical mechanism (e.g., `SHA-256 Payload Binding`), and live telemetry metrics (cost, tokens, phase).
* **Mobile (`< 640px`)**:
  - Compact isometric overview header + **Vertical 5-Station Step Cards** with minimum `48px` height (`>= 44x44px` WCAG target).
  - Tapping any station expands its plain-language inspector details without horizontal scrolling.

---

## 4. Accessibility (WCAG 2.1 AA) & Reduced Motion Contract

* **Keyboard Navigation**: Every station is exposed as an interactive `<button>` with `aria-pressed={isSelected}` and descriptive `aria-label` combining station number, title, and current status.
* **Contrast**: Text labels use `#0B0F19` on `#FFFFFF`/`#F8F9FC` in Light mode (>15:1 contrast) and `#F8FAFC` on `#11131F` in Dark mode (>14:1 contrast).
* **Motion Safety**: CSS animations use `motion-safe:animate-*` and SVG `<animate>` elements are omitted in favor of CSS classes gated by `@media (prefers-reduced-motion: no-preference)`.
