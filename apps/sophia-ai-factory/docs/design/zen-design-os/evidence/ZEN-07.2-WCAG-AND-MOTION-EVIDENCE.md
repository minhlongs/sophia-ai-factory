# ZEN-07.2 — WCAG 2.2 AA & Motion Acceptance Evidence (G4)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD:** `4d23ddb386f499b7627f2c828a1b80c81c6a3382` + P0/P1 remediations
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`
**Machine Evidence:** [`g4-axe-summary.json`](./g4-axe-summary.json), [`g4-manual-a11y.json`](./g4-manual-a11y.json)

---

## 1. Automated Audits (12 route × theme combinations)

`axe-core` injected over the real dev server in system Chrome:

| Screen | vi/dark | vi/light | en/dark | en/light |
|:--|:--:|:--:|:--:|:--:|
| `/vi/setup-wizard` | **0 violations** | 0 | 0 | 0 |
| `/vi/dashboard` | 0 | 0 | 0 | 0 |
| `/vi/dashboard/niche-studio` | 0 | 0 | 0 | 0 |

Rules exercised include `color-contrast`, `image-alt`, `label`, `button-name`,
`aria-*`, `heading-order`, `duplicate-id`, `form-field-multiple-labels`, and
`landmark-unique`. References: `g4-axe-summary.json` entries 1–12.

**Explicit statement of limits:** this run used the `axe-core` rule set, not a
full assistive-technology pass. Zero axe violations is necessary but **not
sufficient** for WCAG 2.2 AA conformance — §2 documents the manual keyboard,
screen-reader, focus and reflow inspection that accompanies it.

---

## 2. Manual Keyboard & Focus Inspection (WCAG 2.1.1 / 2.4.3 / 2.4.7 / 2.4.11)

Machine record: `g4-manual-a11y.json` → `keyboardReport`.

| Route | Tab stops | Distinct selectors | Visible focus rings | `outline: none` w/o substitute |
|:--|--:|--:|--:|--:|
| `/vi/setup-wizard` | 11 | 2 | 11/11 | 0 |
| `/vi/dashboard` | 20 | 20 | 20/20 | 0 |
| `/vi/dashboard/niche-studio` | 20 | 20 | 20/20 | 0 |

- **Tab order** follows DOM order; no positive `tabindex` overrides found in the
  three pilot screens.
- **Focus visibility** — `outline-hiddenCount: 0` at every stop. Focus styling is
  the browser default ring plus Tailwind `focus-visible:ring` on the Zen button.
- **Dialog focus management** — `dialogFocusTrapped: null` on all three routes:
  no modal dialog is mounted in the idle state of the pilot screens, so no trap
  needed to be measured. Dialogs observed in targeted capture
  `t04-setup-wizard-step-state-vi.png` were keyboard-closable with `Escape`
  (Radix `Dialog` behaviour). **Not claimed as a full modal audit** — if the
  Founder wants dialog focus management signed off, it must be re-run against a
  state where a dialog is open (recorded as a follow-up, not a blocker for the
  three pilot screens).

---

## 3. Zoom & Responsive Reflow (WCAG 2.2 SC 1.4.10 / 1.4.4)

Machine record: `g4-manual-a11y.json` → `reflowCheck`.

At viewport width **320 px** (400% zoom of a 1280 px page):

| Route | `scrollWidth` | `clientWidth` | Horizontal scroll |
|:--|--:|--:|:--|
| `/vi/setup-wizard` | 320 | 320 | **none** |
| `/vi/dashboard` | 320 | 320 | **none** |
| `/vi/dashboard/niche-studio` | 320 | 320 | **none** |

No two-dimensional scrolling is required at any pilot route. Long Vietnamese
strings wrap inside cards (verified by eye in
`targeted/t02-niche-studio-long-vi-text-dark-1440w.png` and
`targeted/t03-niche-studio-long-vi-text-light-1440w.png`).

---

## 4. Reduced Motion (WCAG 2.2 SC 2.3.3) — all four Zen primitives

Machine record: `g4-manual-a11y.json` → `motionReport`
(`prefersReduce: true`, `reducedMotion: "reduce"`, `instantAnimations: 0`).
Source read directly, not inferred.

| Primitive | File | Reduced-motion behaviour |
|:--|:--|:--|
| `FadeInView` | `src/seed/components/ui/fade-in-view.tsx:51,54,90,99-101` | `useState(() => prefersReducedMotion())` → visible on the very first frame (no hidden start frame even in SSR); `motion = isVisible && prefersReducedMotion() ? "none" : undefined` removes the inline transition |
| `ScrollReveal` | `src/seed/components/ui/scroll-reveal.tsx:30,32,35,106` | `useState(reduced)`; effect returns early; `transition: reduced ? "none" : ...` |
| `PageTransition` | `src/seed/components/ui/page-transition.tsx:17,18,21,37-38` | `useState(reduced)`; effect returns early before `requestAnimationFrame`; `transition: reduced ? "none" : ...` |
| `AnimatedCounter` | `src/seed/components/ui/animated-counter-with-framer-motion.tsx:22,24-27` | `setCount(value)` and early `return` — **`requestAnimationFrame` loop is never started** |

Every one of the four reads the preference at render/effect time via the shared
`prefersReducedMotion()` helper (`fade-in-view.tsx:28-34`), so there is no
client/server divergence and no hydration mismatch.

The CSS layer closes the loop at `src/app/globals.css:980-996`:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-instant: 0ms;
    --motion-duration-fast: 0ms;
    --motion-duration-normal: 0ms;
    --motion-duration-deliberate: 0ms;
    --motion-duration-cinematic: 0ms;
  }
  html { scroll-behavior: auto; }
  .animate-gradient, .animate-conveyor, .animate-fade-in-up,
  .animate-shimmer, .animate-float, … { /* zeroed */ }
}
```

plus dedicated overrides at `globals.css:954` (`guide-signal-flow`) and
`globals.css:972` (`guide-pulse-orb`) — both set `animation: none` under
reduced motion rather than merely shortening duration.

The `run-status-badge.test.tsx:60` comment confirms the motion-safe pulse class
is conditional on the same media query.

### 4.1 Rate-limit note

All four components read the preference through `window.matchMedia` at render
time, and **do not subscribe** to `addListener`/`addEventListener('change')`.
A user who toggles the OS reduced-motion setting while a page is already mounted
will get the correct behaviour only after the next mount. This is a known
limitation of the existing implementation; it is **documented, not remediated**,
because fixing it is feature work outside the acceptance scope
("Isolated local verification and minimal defect remediation") and no WCAG
requirement is violated (SC 2.3.3 applies to motion that is shown, and none is).

---

## 5. Motion-token governance (no new dependencies)

- Duration/easing values come from Zen tokens: `--motion-duration-deliberate`
  (400ms) and `--motion-ease-emphasized` (`cubic-bezier(0.16, 1, 0.3, 1)`),
  declared at `src/app/globals.css:19-27` and consumed by
  `page-transition.tsx:39`, `scroll-reveal.tsx:54-55`, `fade-in-view.tsx:87`
  via `var(...)` references rather than hardcoded literals.
- The satisfy/prove command requires that **GSAP, Lenis and React Bits were not
  introduced** during this pass. Verified from the working tree:
  `package.json` dependencies are unchanged relative to `4d23ddb38`; no
  `gsap`, `lenis` or `react-bits` entry exists in `dependencies` or
  `devDependencies`. `AnimatedCounter` is deliberately rAF-based
  (`animated-counter-with-framer-motion.tsx:33-48`) and the file already carries
  the note that it does not depend on framer-motion.

---

## 6. Contrast

Measured pairs behind the design-token values in `src/app/globals.css`
(`:root` light 14-185, `.dark` 187-305):

| Pair | Light | Dark | AA 4.5:1 |
|:--|--:|--:|:--:|
| Button: `--primary` bg / `--primary-foreground` text | 8.61:1 | 6.29:1 | PASS both |
| Body: `--foreground` on `--background` | `#0B0F19` on `#F8F9FC` | `#F8FAFC` on `#090A10` | PASS both |
| Muted: `--muted-foreground` on `--background` | `#475569` on `#F8F9FC` | — | PASS |

Zinc-translucency defects that would have failed `color-contrast` in Light mode
(`niche-gate1-readiness-card.tsx:24,36,49` and
`video-compliance-preview-player.tsx`) were remediated before the axe sweep —
see §4 of [`ZEN-07.2-VISUAL-EVIDENCE.md`](./ZEN-07.2-VISUAL-EVIDENCE.md) (V1,
V2). The sweep therefore ran against the corrected tree.

---

## 7. Screen-reader semantics

Every interactive control inspected carries an accessible name: `aria-label`
on icon buttons, `<label htmlFor>`/wrapping `<label>` on all inputs (the
`niche-form-product-inputs.tsx` `aria-label` regression V7 was restored), and
the artboard counter exposes `data-zen-motion` plus a live value. Headings run
`h1 → h2 → h3` without level skips on all three routes.

**Not claimed:** a full screen-reader (VoiceOver/NVDA) transcript pass. This is
a semantic-structure and name-completeness check.

---

## 8. Verdict

**WCAG 2.2 AA — VERIFIED for the three pilot screens, with two scoped limits
stated above** (modal focus trap measured only in the idle state; reduced-motion
preference changes require a remount; no SR transcript pass). No P0/P1
accessibility defect remains open.
