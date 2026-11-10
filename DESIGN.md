# DESIGN.md — ZEN DESIGN OS v1.0 (Sophia AI Factory)

> **Canonical Design Contract & AI Design Exchange Interface**
> **Architecture**: Google Design × Material 3 Expressive × AI-Native UX × Cloudflare-First Architecture
> **Token Specification**: W3C Design Tokens Community Group (DTCG) Format 2025.10 (`src/seed/design-tokens/zen-design-tokens.dtcg.json`)
> **Runtime Authority**: `apps/sophia-ai-factory/src/app/globals.css` (highest CSS authority per `.claude/rules/sophia-design-authority.md`)
> **Theme Mode**: Progressive Dual-Theme (`defaultTheme="dark"` — *Director's Control Deck* + First-Class Light Mode — *Executive Studio Ivory* + High-Contrast Mode)
> **Motion Governance**: Founder Addendum #07.1 (`docs/design/zen-design-os/ZEN-MOTION-ADOPTION-MATRIX.md`)

---

## 1. Executive Philosophy & Brand Identity

**Visual Direction**: **PREMIUM · QUIET · EXPRESSIVE · AI-NATIVE · HIGH-TRUST · ACCESSIBLE**

Sophia AI Factory is an AI-native creative and revenue operations platform built for non-technical SME Founders and CEOs running automated YouTube/TikTok/Reels video factories and affiliate empires.

### Core Design Principles
1. **Clarity Before Decoration**: Every screen communicates three things immediately: *(a) current system state, (b) the single recommended next action, and (c) expected business outcome*.
2. **Outcome Before Technology**: Surface completed missions, verified revenue, compliance approvals, and video artifacts rather than internal multi-agent plumbing.
3. **Progressive Disclosure**: First-time Founders see a calm, guided path (e.g., 3 core keys in Setup Wizard); advanced provider tuning and raw SQL/D1 telemetry remain tucked inside expandable drawers.
4. **Contextual Intelligence (Google Next Interface)**:
   - *Living Layouts*: Context-sensitive readiness banners and adaptive inspector panels that respond to workspace state without disorienting layout shifts.
   - *Ambient Communication*: Subtle, high-trust status pills, latency readouts, and deterministic progress steps for AI activity.
   - *Continuous Collaboration*: Explicit human-in-the-loop intervention points, compliance gates (FTC / MiCA / VN52), and resumable approval queues.
5. **Trust-First Interaction**: BYOK credential entry, encryption status, billing tier activation, and social publishing require transparent state indicators and explicit human confirmation.
6. **Expressive Restraint**: Motion, tonal surface depth, and accent chroma communicate hierarchy and state transitions — never gratuitous visual noise.
7. **Accessibility by Default**: Full WCAG 2.2 AA contrast compliance across both Dark and Light themes, visible `:focus-visible` rings, 44×44px touch targets on mobile, and strict `prefers-reduced-motion: reduce` support.

---

## 2. Three Evaluated Directions & Canonical Selection

Per **FOUNDER DECISION — SUPREME COMMAND #07**, **Direction B (Expressive AI-Native)** is locked as the canonical default, synthesizing the operational density of Direction A and the studio canvas ergonomics of Direction C:

| Direction | Archetype | Primary Strength | Role in Zen Design OS v1.0 |
|---|---|---|---|
| **Direction A** | **Quiet Executive Operations** | High-density KPI scanability, calm neutral surfaces, crisp tabular telemetry, zero-mock truth states | Incorporated into **Pilot B (`/[locale]/dashboard`)** KPI grid, D1 Sources lineage drawer, and activity ledger |
| **Direction B (CANONICAL DEFAULT)** | **Expressive AI-Native** | Material 3 Expressive tonal hierarchy, tactile surface elevation, Living Layout next-step guidance, and clear human-AI collaboration states | **Canonical system contract across all Sophia routes**, unifying Setup Wizard, Operations Dashboard, and Niche Studio |
| **Direction C** | **Creative Studio Focus** | Immersive dark-stage media preview (`9:16`, `16:9`, `1:1`), timeline scrubber, and compact parameter inspector | Incorporated into **Pilot C (`/[locale]/dashboard/niche-studio`)** artifact canvas, compliance player, and timeline preview |

---

## 3. Dual-Theme Material 3 Color Architecture

Zen Design OS v1.0 maps Material 3's tonal surface hierarchy and semantic roles onto Sophia's brand DNA. Both themes satisfy **WCAG 2.2 AA** (≥ 4.5:1 normal text, ≥ 3.0:1 large text and UI components).

### 3.1 Semantic Surface Hierarchy (Material 3 Tonal Elevation)

Instead of heavy drop shadows or opaque borders, depth is communicated through five stepped surface containers:

| Semantic Token | CSS Custom Property | Dark Mode (*Director's Control Deck*) | Light Mode (*Executive Studio Ivory*) | Usage |
|---|---|---|---|---|
| `surface-dim` | `--surface-dim` | `#06070B` | `#EEF1F7` | Deep recessed backdrop, modal underlays |
| `surface` / `background` | `--surface` / `--background` | `#090A10` | `#F8F9FC` | Primary application canvas |
| `surface-bright` | `--surface-bright` | `#1E2235` | `#FFFFFF` | Highlighted interactive surface |
| `surface-container-lowest` | `--surface-container-lowest` | `#07080D` | `#FFFFFF` | Input wells (Dark) / Elevated pure cards (Light) |
| `surface-container-low` | `--surface-container-low` | `#0D0F18` | `#F3F5FA` | Secondary grouping regions, sidebar rail |
| `surface-container` / `card` | `--surface-container` | `#11131F` | `#FFFFFF` | Standard cards, modules, Setup Wizard container |
| `surface-container-high` | `--surface-container-high` | `#171A2B` | `#ECEFF6` | Hover states, active drawers, popovers |
| `surface-container-highest` | `--surface-container-highest` | `#1E2235` | `#E2E7F1` | Selected chips, sticky headers, tooltips |
| `on-surface` / `foreground` | `--on-surface` | `#F8FAFC` (18.9:1) | `#0B0F19` (18.1:1) | Primary body & display typography |
| `on-surface-variant` | `--on-surface-variant` | `#94A3B8` (6.8:1) | `#475569` (7.2:1) | Secondary labels, captions, helper text |
| `outline` | `--outline` | `#333852` (3.2:1) | `#94A3B8` (3.1:1) | Input borders, interactive control boundaries |
| `outline-variant` | `--outline-variant` | `#1E2235` | `#E2E8F0` | Subtle structural dividers, table hairlines |

### 3.2 Brand & Semantic Accents

| Role | CSS Token | Dark Mode Value | Light Mode Value | Meaning & Governance |
|---|---|---|---|---|
| **Primary (Electric Indigo)** | `--primary` | `#6366F1` (`on-primary`: `#FFFFFF`) | `#4338CA` (`on-primary`: `#FFFFFF`) | Primary CTAs, active navigation, focus rings, verified links |
| **Primary Container** | `--primary-container` | `#1E1B4B` (`on`: `#E0E7FF`) | `#E0E7FF` (`on`: `#1E1B4B`) | Selected navigation pills, active step badges |
| **Secondary (AI Violet)** | `--secondary-accent` | `#A855F7` | `#7E22CE` | AI synthesis, multi-agent reasoning, hook variants |
| **Tertiary (Cinema Amber)** | `--tertiary` / `--warning` | `#F59E0B` | `#B45309` (text) / `#D97706` (icon) | Studio accents, quota pacing, pending human approval |
| **Success (Emerald)** | `--success` | `#10B981` | `#047857` (text) / `#059669` (badge) | Verified BYOK keys, live D1 truth state, completed renders |
| **Error (Crimson Rose)** | `--error` / `--destructive` | `#F43F5E` | `#BE123C` | Auth failure, invalid API key, kill-switch, failed job |
| **Info (Cyan Telemetry)** | `--info` | `#06B6D4` | `#0E7490` | Latency readouts, webhook trace metadata |

### 3.3 Dedicated Dark Stage Invariant (Studio Media Preview)
Video viewports (`9:16` Shorts, `16:9` YouTube, `1:1` Social artboards) and timeline frame stages represent physical cinema screens. They use `--studio-stage-bg: #090A10` and `--studio-stage-fg: #F8FAFC` so video previews maintain accurate color grading in both Dark and Light application themes, while surrounding inspector controls, forms, and headers adapt cleanly to the active theme.

---

## 4. Typography & Vietnamese Diacritic Engineering

Sophia enforces a strict **3-Font Bilingual Hierarchy** with generous vertical clearance for Vietnamese stacked diacritics (`ắ`, `ậ`, `ể`, `ỗ`, `ự`):

1. **Display (`--font-display`)**: `'Archivo'`, `'Be Vietnam Pro'`, sans-serif.
   - Variable width axis (`font-variation-settings: "wdth" 104`) for cockpit headers and hero KPI figures.
   - Never use `Inter` for display headlines.
2. **UI & Body (`--font-sans`)**: `'Be Vietnam Pro'`, `'Plus Jakarta Sans'`, system-ui, sans-serif.
   - Engineered specifically for Vietnamese legibility at 12px–16px alongside English SaaS terminology.
3. **Telemetry & Monospace (`--font-mono`)**: `'JetBrains Mono'`, monospace.
   - `font-variant-numeric: tabular-nums` mandatory on all financial figures, latency badges (`142ms`), frame counters, and masked API keys.

### Type Scale
| Role | Token | Size | Line Height | Weight | Tracking |
|---|---|---|---|---|---|
| Display Hero | `--type-display-lg` | `clamp(2rem, 3.8vw, 3.25rem)` | `1.12` (1.18 VI) | `800` | `-0.035em` |
| Page Title | `--type-headline-lg` | `clamp(1.5rem, 2.2vw, 2rem)` | `1.22` | `700` | `-0.025em` |
| Section Header | `--type-title-lg` | `1.125rem` (18px) | `1.35` | `600` | `-0.015em` |
| Card Title | `--type-title-md` | `0.9375rem` (15px) | `1.4` | `600` | `-0.01em` |
| Body Default | `--type-body-md` | `0.875rem` (14px) | `1.55` | `400` | `0em` |
| Caption / Helper | `--type-body-sm` | `0.75rem` (12px) | `1.5` | `500` | `0.01em` |
| Telemetry Eyebrow | `--type-label-mono` | `0.6875rem` (11px) | `1.35` | `600` | `0.08em` (uppercase) |

---

## 5. Layout, Spatial Grid & Touch Ergonomics

- **4-Layer Clean Architecture Alignment**:
  - `src/seed/design-tokens/`: Pure DTCG token definitions & contrast math (zero domain knowledge).
  - `src/seed/components/ui/`: Accessible Radix/shadcn primitives & zero-dependency motion wrappers.
  - `src/tree/components/`: Domain-reusable workflows (Setup Wizard, BYOK Doctrine Banner).
  - `src/forest/dashboard/` & `src/forest/theme/`: Application shell, TopBar, Sidebar, ThemeToggle, White-Label branding.
- **Responsive Breakpoints**:
  - **Mobile (`375px–767px`)**: Single-column stack, collapsible mobile drawer (`DashboardMobileDrawer`), minimum `44×44px` touch targets, sticky bottom or full-width primary CTAs.
  - **Tablet (`768px–1023px`)**: Persistent 280px sidebar or compact rail, 2-column Bento grid.
  - **Desktop (`1024px–1440px+`)**: 280px sidebar + fixed TopBar (`h-16`) + 12-column content workspace (`max-w-7xl`).

---

## 6. Zen Motion Governance (Founder Addendum #07.1)

Full matrix: `docs/design/zen-design-os/ZEN-MOTION-ADOPTION-MATRIX.md`.

### Motion Token Contract
| Token | Value | Purpose |
|---|---|---|
| `--motion-duration-instant` | `80ms` | Button press, toggle switch, focus ring |
| `--motion-duration-fast` | `150ms` | Hover states, tooltip reveal, dropdown menu |
| `--motion-duration-normal` | `240ms` | Drawer slide, tab switch, card elevation |
| `--motion-duration-deliberate` | `400ms` | Page transition (`PageTransition`), wizard step change |
| `--motion-duration-cinematic` | `600ms` | Scroll reveal (`ScrollReveal`), onboarding celebration |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Material 3 standard spatial easing |
| `--motion-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | Sophia industrial press easing (entrances & drawers) |
| `--motion-ease-decelerate` | `cubic-bezier(0, 0, 0, 1)` | Entering elements |
| `--motion-ease-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Exiting elements |

### Governance Rules
1. **CSS / Tailwind Transitions (`DEFAULT`)**: Used for 95%+ of UI interactions. Zero JS bundle overhead.
2. **Existing Zero-Dependency Primitives (`REUSE`)**: `PageTransition`, `FadeInView`, `ScrollReveal`, and `AnimatedCounter` in `src/seed/components/ui/` use native `IntersectionObserver` + `requestAnimationFrame` + `matchMedia('(prefers-reduced-motion: reduce)')`.
3. **GSAP (`CONDITIONAL PILOT`)**: Permitted only via dynamic import for complex timeline scrubbing if needed; prohibited in core layout/navigation and prohibited from building Webflow-competing visual animation builders.
4. **Lenis (`HOLD`)**: Do **not** enable smooth-scroll hijacking on authenticated SaaS routes (`/setup-wizard`, `/dashboard`, `/dashboard/niche-studio`). Native browser scrolling, keyboard PageUp/PageDown, and nested table/drawer scrolling must remain 100% native.
5. **React Bits (`REFERENCE / SELECTIVE ADOPTION`)**: Never install as a package dependency (`MIT + Commons Clause`). Any inspired pattern must be clean-room authored in TypeScript using Zen tokens and WCAG reduced-motion guards.

---

## 7. Stitch Prompt Block (Copy-Paste Design Exchange)

Use this block when generating or updating screens in Google Stitch (`https://stitch.withgoogle.com`):

```text
SYSTEM: ZEN DESIGN OS v1.0 — SOPHIA AI FACTORY
DIRECTION: Expressive AI-Native (Material 3 Tonal Hierarchy + Director's Control Deck)
MODES: Dual-Theme (Dark Default #090A10 canvas / #11131F surface-container; Light Executive Studio Ivory #F8F9FC canvas / #FFFFFF surface-container)
ACCENTS: Primary Electric Indigo (#6366F1 dark / #4338CA light), Secondary AI Violet (#A855F7 / #7E22CE), Tertiary Cinema Amber (#F59E0B / #D97706), Success Emerald (#10B981 / #059669), Error Rose (#F43F5E / #BE123C)
TYPOGRAPHY: Display = Archivo (wdth 104, 700-800), UI/Body = Be Vietnam Pro (400-600, Vietnamese diacritic safe), Telemetry/Numbers = JetBrains Mono (tabular-nums)
GEOMETRY: Cards rounded-2xl (16px) with 1px subtle outline-variant border (#1E2235 dark / #E2E8F0 light); Buttons & Inputs rounded-xl (12px); Status Pills rounded-full
UX DOCTRINE: Non-tech SME CEO persona. Clarity before decoration. Zero fabricated metrics (explicit Live / Verified Empty / Unavailable states). Progressive disclosure for BYOK keys and D1 SQL lineage. WCAG 2.2 AA contrast.
```
