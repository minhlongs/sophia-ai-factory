# Design Guidelines — Sophia AI Factory

> Authoritative Design System & Component Guidelines for Sophia AI Factory.
> Aligned with `apps/sophia-ai-factory/src/app/globals.css` and `.claude/rules/sophia-design-authority.md`.

---

## 1. Visual Theme & Palette (Obsidian Cyber-Glass)

Sophia AI Factory utilizes the **Obsidian Cyber-Glass** design system: a balance of high-contrast enterprise precision with sleek cybernetic accents. It supports both high-readability Functional Light Mode and immersive Dark Obsidian Mode.

### Core Color Tokens (derived from `src/app/globals.css`)

| Token | Light Value | Dark Value | Role & Usage |
|---|---|---|---|
| `--primary` | `hsl(246, 80%, 60%)` (`#4F46E5`) | `hsl(246, 80%, 64%)` (`#6366F1`) | Electric Indigo — Primary actions, active navigation, focus rings |
| `--accent` | `hsl(38, 92%, 50%)` (`#F59E0B`) | `hsl(38, 92%, 50%)` (`#F59E0B`) | Cyber Amber — Warnings, pacing countdowns, jitter offsets, quotas |
| `--secondary` | `hsl(260, 70%, 60%)` (`#9333EA`) | `hsl(260, 70%, 65%)` (`#A855F7`) | Vibrant Violet — AI workflows, syndication pipelines |
| `--background` | `hsl(0, 0%, 100%)` (`#FFFFFF`) | `hsl(240, 18%, 4%)` (`#08090D`) | Canvas background |
| `--card` | `hsl(0, 0%, 100%)` (`#FFFFFF`) | `hsl(240, 16%, 9%)` (`#12141F`) | Surface containers |
| `--border` | `hsl(240, 6%, 90%)` (`#E2E8F0`) | `hsl(240, 14%, 16%)` (`#222536`) | Subtle structural borders |
| `--destructive` | `hsl(350, 89%, 60%)` (`#F43F5E`) | `hsl(350, 89%, 60%)` (`#F43F5E`) | Crimson Rose — Kill switches, copyright flags, auth failures |
| `--emerald` | `hsl(160, 84%, 39%)` (`#059669`) | `hsl(160, 84%, 45%)` (`#10B981`) | Verified tokens, live channels, successful dispatches |

### Glass & Atmosphere Tokens
* **Subtle Glass Border**: `border border-slate-200/80 dark:border-slate-800/80`
* **Card Glow**: `shadow-sm hover:shadow-[0_4px_24px_rgba(79,70,229,0.08)] transition-all duration-200`
* **Glow Accents**: Electric Indigo highlights for active processing, Amber pulse for cooldown timers.

---

## 2. Typography Hierarchy

Per repo design authority (`sophia-design-authority.md`), **Inter display is prohibited**.
* **Body & Controls**: `Inter`, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
* **Display & Metrics**: `Outfit` or clean geometric sans for high-impact metric counters and cockpit headlines.
* **Bilingual Diacritic Support**: Full Latin-Extended & Vietnamese character support (ă, â, đ, ê, ô, ơ, ư and all 5 tonal marks).

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display Hero | 32px (2rem) | Bold (700) | 1.2 | Cockpit title, primary stat counters |
| Section Header | 20px (1.25rem) | SemiBold (600) | 1.35 | Module headers (Channel Grid, Pacing Queue) |
| Card Subheader | 15px (0.9375rem) | Medium (500) | 1.4 | Channel handles, video clip titles |
| Body / Labels | 13px - 14px | Regular (400) / Medium (500) | 1.5 | Metadata labels, telemetry values, explanations |
| Micro / Caption | 11px - 12px | Medium (500) / SemiBold (600) | 1.4 | Badges, anti-detection metrics, jitter readouts |

---

## 3. Social Direct Publisher & Channel Manager Specifications

The **Social Direct Publisher & Channel Manager** is the mission-control cockpit for autonomous multi-platform syndication (TikTok, YouTube Shorts, Instagram Reels).

### Module Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Cockpit Header: Status Bar • Master Kill-Switch • Quick Stats • VN/EN Switch│
├────────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Channel Management Grid     │ 2. Live Publishing Pacing Queue             │
│   • TikTok (Active / OAuth)    │   • Active Cooldown Timers (Live ticking)   │
│   • YouTube Shorts (Active)    │   • Daily Quota Meters (e.g. 2/4 today)     │
│   • Instagram Reels (Active)   │   • Anti-Detection Fingerprint Card         │
│   • Token Health & Auto-Renew  │   • Organic Jitter Window (45-90 min)       │
├────────────────────────────────┴─────────────────────────────────────────────┤
│ 3. Video Publication Staging & Dispatch Panel                                │
│   • 9:16 Vertical Preview Player with Platform Safe-Zone Overlays            │
│   • Multi-Platform Target Toggles & Custom Metadata                          │
│   • Jitter Offset Calculation Indicator (+07m 34s randomized)                │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. Webhook & Copyright Monitor                                               │
│   • Real-Time Event Cards: Published (Green) • In-Flight • Hold/Flagged       │
│   • Audio Copyright Clearance (Content ID / TikTok Sound Check)              │
│   • Webhook Payload & Callback Inspector Drawer                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Channel Management Grid
* **BYOK Self-Service Paradigm**: Zero operator friction. Customers configure OAuth client credentials or 1-click authorize directly.
* **Health Indicators**:
  * `HEALTHY` (Green badge): Token lifetime > 12 hours.
  * `RENEWING` (Indigo pulse): Proactive background refresh in-flight.
  * `EXPIRING_SOON` (Amber badge): Token lifetime < 6 hours.
  * `REVOKED / DISCONNECTED` (Rose badge): Immediate reconnect CTA.
* **Per-Channel Safety Score**: 0-100 rating based on upload cadence, shadowban markers, and audience engagement retention.

### 3.2 Live Publishing Pacing Queue
* **Pacing Heuristics** (`tree/social/syndication/social-syndication-pacer.ts`):
  * **Daily Cap**: Strict 4 uploads / channel / calendar day.
  * **Interval**: Minimum 3-hour channel cooldown.
  * **Global Stagger**: 45 to 90 minutes randomized interval across multi-account clusters.
* **Randomized Jitter Offset**:
  * Mathematical jitter: $\Delta t = \text{base} \pm \mathcal{U}(3\text{m}, 14\text{m})$.
  * Visual representation: Cyber Amber pill indicator showing the organic variance added to prevent algorithmic detection.
* **Anti-Detection Fingerprint Visualizer**:
  * Real-time hardware spoofing signature card showing:
    - Target Residential Proxy Pool (`VN-SGN-Tier1`, `US-WDC-Tier1`, etc.)
    - Canvas Fingerprint Noise (`#0x8F4A2C` hash)
    - Spoofed WebGL GPU (`Apple M2 / Metal`, `NVIDIA RTX 4070`)
    - Viewport Dimensions (`390 x 844 pt` mobile portrait)
    - WebRTC IP leak suppression (`Disabled / Tunnel Only`)

### 3.3 Video Publication Staging & Dispatch Panel
* **9:16 Vertical Video Safe-Zone Guides**:
  * Toggleable guide lines displaying native UI obstacles:
    - TikTok: Bottom caption block (160px), Right avatar & interaction column (80px), Top header tab (88px).
    - Instagram Reels: Bottom audio marquee & description (140px), Right action icons (64px).
    - YouTube Shorts: Bottom channel name & sound remix button, Right thumb actions.
* **Multi-Platform Metadata Dispatch**:
  * Platform-specific caption adaptation (character count limits, hashtag suggestions).
  * Video tag insertion & affiliate product link embed fields.

### 3.4 Webhook & Copyright Monitor
* **Tri-State Status Architecture**:
  * `PUBLISHED` (Emerald): HTTP 200 / Video Live URL received / Engagement webhooks connected.
  * `PROCESSING` (Electric Indigo): Upload chunking / Platform server ingestion / Transcoding.
  * `HOLD_FLAGGED` (Crimson Rose / Amber): Copyright sound match, region restriction, or metadata policy review.
* **Remediation Workflows**:
  * One-click audio track swap with pre-cleared Royalty-Free library.
  * Pitch shift +1.2% re-render shortcut.
  * Manual claim dispute assistant.

---

## 4. Accessibility & Responsive Standards

* **Contrast Ratios**: All text meets WCAG 2.1 AA (≥ 4.5:1 for body text, ≥ 3.0:1 for large display headers).
* **Touch Targets**: Minimum 44×44px interactive areas for all touch devices and mobile actions.
* **Keyboard Navigation**: Explicit focus rings (`ring-2 ring-indigo-500 ring-offset-2`).
* **Motion Sensitivity**: Respects `prefers-reduced-motion` with graceful zero-animation fallbacks.
* **Breakpoints**:
  * Mobile: `375px - 767px` (Stacked cards, drawer modals)
  * Tablet: `768px - 1023px` (2-column grid, persistent playback)
  * Desktop: `1024px - 1440px+` (4-column cockpit layout with side-by-side video stager and queue)

---

## 5. Bilingual Localization (VN / EN)

All labels, tooltips, status badges, and help text must be available in both Vietnamese and English.
* Example terms:
  * *Channel Management* / *Quản Lý Kênh Liên Kết*
  * *Pacing Queue* / *Hàng Đợi Điều Tiết Đăng Tải*
  * *Anti-Detection Fingerprint* / *Dấu Vân Tay Chống Phát Hiện*
  * *Jitter Offset* / *Độ Lệch Ngẫu Nhiên (Jitter)*
  * *Safe Zone Overlay* / *Vùng An Toàn Hiển Thị*
  * *Copyright Clearance* / *Kiểm Duyệt Bản Quyền Âm Thanh*
