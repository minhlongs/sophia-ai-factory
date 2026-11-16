# SOPHIA AI FACTORY x ANATOMY
## SUPREME MASTER COMMAND 01 - Evidence-Driven Interactive UX Integration

**Execution target:** Claude Code CLI, inside the existing `minhlongs/sophia-ai-factory` repository.
**Mission:** Inspect the ACTUAL repository first, then ship a focused, production-quality, bilingual interactive visualization of Sophia's creative workflow using the Anatomy Agent Skill where justified. Commit and PUSH A FEATURE BRANCH only after verification. Do not deploy to production, merge, or hand over to customers.
**Autonomy:** Implement end to end within the authorized branch and safe local environment. Do not ask for routine approvals. Stop and report if a material security, release, or evidence gate cannot be satisfied.
**Output language:** Vietnamese for the founder report; bilingual Vietnamese and English for customer-facing UI.

---

# 0. HIGHEST-PRIORITY SAFETY AND SOURCE CONTRACT

You are acting as Principal Product Designer, Staff Frontend Engineer, Security Reviewer, Accessibility Lead, and Release Engineer. Your goal is NOT a flashy re-skin. It is a correct, trustworthy, calm, legible, exceptionally polished interactive explanation of Sophia's actual system.

Source-of-truth order (resolve conflicts and cite concrete files):
1. Current checked-out source, runtime types, tests, route tree and package scripts.
2. Repo `AGENTS.md` and root `CLAUDE.md`.
3. Canonical `apps/sophia-ai-factory/CLAUDE.md` and `apps/sophia-ai-factory/.claude/rules/*`.
4. Actual current UI, design tokens, i18n dictionaries, CI and deployment workflows.
5. Verified business docs, ADRs and evidence records.
6. Anatomy's actual pinned `SKILL.md`, references, examples and license.
7. This command's proposed design defaults (only where they do not conflict with evidence).

Known repository constraints to independently reconfirm:
- Product app: `apps/sophia-ai-factory/` (repo root `package.json` is primarily tooling).
- Next.js 16 App Router, React, TypeScript, Cloudflare Workers deployment.
- Architectural tiers `seed -> tree -> forest -> land`; respect exact direction rules.
- Better Auth; D1 is primary, `createServerClient()` is synchronous; i18n is `next-intl` with `[locale]`, Vietnamese and English.
- Inngest owns long-running creative jobs. Do not reproduce the workflow engine in React.
- Protected: Setup Wizard/BYOK, Telegram bot, NOWPayments IPN, tier/billing/auth, admin and tenant isolation.
- Canonical imports documented in the app CLAUDE.md; verify they exist before using them.
- Pushing to `main` may auto-deploy via `.github/workflows/deploy.yml`.
- Previous founder release posture: no customer handover without forensic proof and a real creative-job run.
- Public landing currently makes quantitative social-proof claims; verify numbers before keeping or expanding them.

**Hard prohibitions:** no direct push to `main`, no merge, no production deployment, no `EMERGENCY_CF_DIRECT=1`, no production DB mutations, no migrations without explicit need and separate authorization, no changes to checkout/entitlements/credentials, no external publication of project screenshots or source to Anatomy gallery, no invented metrics, fake users, fake real-time telemetry, fictitious testimonials, or unsupported provider claims. Do not silently change global branding or redesign protected flows. No automatic use of `--no-verify`, `--force`, `git reset --hard`, `git clean -fd`, or deletion of existing user work.

---

# 1. PHASE ZERO - REAL REPOSITORY FORENSICS, BEFORE CODING

Execute safe read-only discovery first. Show evidence from commands, not assumptions:

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
git worktree list
node --version
```

1. Confirm this is the correct Sophia repo and the working tree is clean. If it is dirty, preserve all user edits; use an isolated worktree/feature branch from an appropriate known commit only if safe. Do not touch other repositories.
2. Read fully: root `README.md`, `AGENTS.md`, `CLAUDE.md`, app `CLAUDE.md`, and the app rules for layer architecture, no-tech/BYOK, cross-layer orchestration, handover and deploy verification. Read `docs/code-standards.md`, `docs/testing.md`, the currently authoritative UI/UX docs, current package scripts, `.github/workflows/deploy.yml`, and task-ID/hook conventions. Report contradictions and use the nearest verified source.
3. Inventory all ACTUAL app routes (`page.tsx`, `layout.tsx`, route groups, locale redirects), navigation and shared shells; list intended audiences, permissions, server/client ownership, data dependencies, and current states. Treat route paths cited here as search hints, not proof of existence.
4. Search existing visual/UI building blocks: `components`, `land` presentation, design tokens, Tailwind config or global CSS, fonts, color mode, icon system, cards, tabs, dialogs, sidebars, notifications, status badges, skeletons, media queries, and any existing charts/diagrams/visual explainers. Reuse rather than duplicate.
5. Locate canonical creative-job schemas, event names, stage/state enums, status transitions, read selectors, allowed human approval actions and ownership checks. Trace data from API/server action -> service -> UI. Be exact about what can be shown without data leaks.
6. Locate existing `messages/vi.json`, `messages/en.json`, `src/navigation.ts` and locale-aware links. Confirm actual locale conventions and all covered UI states.
7. Run or capture current approved baseline commands from the APP DIRECTORY; do not invent package scripts. Record known failures before any changes.
8. If the app can be launched with safe local fixtures, capture BEFORE screenshots for existing marketing, relevant authenticated workflow and setup screens (only using legitimate local test fixtures). Do not login to production or bypass authentication just to capture a screen.
9. Do not treat docs' stale test counts or historic SHA as today's proof. Record actual HEAD, exact files opened, relevant types, scripts and tests.

Create `docs/design/anatomy/01_SOURCE_AUDIT.md` containing a table:
`Claim | Actual source file:line | Finding | Confidence | Implication | Action`.
Add route inventory:
`Actual route | Audience | Existing component | Source of data | Protected? | Proposed integration | Regression test`.
Mark any inaccessible or unverified source as UNKNOWN; never guess.

**Gate G0:** If you cannot identify the canonical existing creative-job states, do not connect the illustration to live data. A clearly labeled conceptual/educational-only view is permitted. If the architecture, repo identity, or safe branch is unclear, stop before edits.

---

# 2. ANATOMY SKILL INTEGRITY / SUPPLY-CHAIN GATE

Read `https://github.com/wheresryan22/anatomy` documentation (or already installed local skill) and inspect its **actual** `SKILL.md`, license, reference guides, React support, geometry audit, and browser scripts. Verify the version/commit being used. The upstream skill builds isometric interactive SVG with optional WebGL and experimental 3D; it is not a UI framework, router, charting library or domain-state engine.

Prefer existing local installation if present and trustworthy. If missing, inspect the upstream repository and command behavior before a project-scoped installation, e.g.:

```bash
npx skills add wheresryan22/anatomy -a claude-code
```

Do not use `-g`; do not run an unexamined install script; respect repo skill-directory conventions. Do not vendor its entire ~10 MB example tree or ship development verification tooling to the browser. If only a tiny subset of the MIT-licensed kit is needed, document provenance/license and choose the smallest maintainable integration. Check dependency, package, lockfile and Cloudflare compatibility before importing anything. No 3D/WebGL initially; use SVG + React for the first release candidate. If Anatomy cannot be vetted, do not install it; implement nothing risky and report HOLD.

**Gate G1:** Confirm that the Anatomy integration does not execute external network requests in the browser, access customer secrets, weaken CSP, require operator-provided credentials, or publish anything externally. Test scripts and local headless Chrome may run only against trusted local output, not arbitrary remote pages.

---

# 3. PRODUCT DECISION - WHAT TO BUILD, AND WHAT NOT TO BUILD

Name the feature **Sophia Creative Workflow Explainer** (working title; adapt naming to existing product copy). Its job: let a non-technical CEO understand what Sophia can do, where a creative job is in the process, which stage needs attention, and what is or is not proven.

Primary scenario A: first-time visitor on the actual EXISTING marketing homepage, without account access. A visual explanation of the product's verified workflow; this is an **illustration**, never fake live progress. Integrate in the current hero media position or one adjacent product-workflow section, whichever preserves the site's existing hierarchy and accessibility.

Secondary scenario B: logged-in user in the EXISTING relevant creative-job/detail surface, ONLY if a canonical job status read path and authorized route already exist. Show a READ-ONLY, evidence-derived progress diagram linked to actual statuses. If not verified, do not create fake dashboards or fabricate a new API. Document a deferred integration contract instead.

Tertiary scenario C: relevant setup/help context, only if existing UI has room for a tiny static explainer; DO NOT redesign wizard steps or expose/modify keys. Auth, pricing, payments, admin and Telegram are regression surfaces, not redesign targets.

This is NOT a new AI orchestration layer, new workflow builder, new design system, game, dashboard chart replacement, or wholesale product redesign. Avoid a broad landing-page rewrite unless directly necessary for accuracy and verified conversion clarity. Never let a diagram imply a workflow step, publishing capability, ROI, content volume, provider readiness, or autonomy level that source code and tests do not establish.

Produce a one-page design decision record: target users, one user problem, two verified product stories, excluded surfaces, component placement, why Anatomy helps, alternatives considered, risk, expected measurable impact, and rollback plan.

---

# 4. CANONICAL INTERACTION MODEL - ONE SOURCE OF TRUTH

Design a pure presentation adapter from canonical, ALREADY-EXISTING creative-job types. Do not create a second status engine, storage schema, new cron, animation-driven state mutation or invented status transitions.

Use an explicit view model conceptually like this (adapt to actual types, no unsafe casts):

```
WorkflowView = {
  mode: 'illustration' | 'verified-job',
  title: localized string,
  source: verified domain selector or documented static explanatory metadata,
  steps: [{ id, localizedLabel, localizedDescription, canonicalState, semanticState,
            allowedActions, evidenceRef?, lastUpdatedAt? }],
  selectedStepId,
  isReadOnly: true
}
```

Never expose internal IDs, URLs, or metadata when authorization forbids them. `verified-job` MUST have server-side auth and tenant checks in the existing data-fetch path. Do not set it from a client-only toggle. The illustration is a separate literal mode with visible label `Illustrative workflow / Minh hoa quy trinh`, not a simulated customer job.

Suggested semantic PRESENTATION STATES, only after mapping every real canonical status exhaustively:
- `not_started`: neutral/inactive; `Chua bat dau` / `Not started`.
- `queued`: ready/waiting; `Dang cho` / `Queued`.
- `running`: active, restrained motion; `Dang xu ly` / `In progress`.
- `needs_input`: actionable, amber; `Can bo sung` / `Needs input`.
- `needs_approval`: paused, requires authorized human review; `Can phe duyet` / `Needs approval`.
- `succeeded`: verified completed with evidence; `Hoan tat` / `Completed`.
- `failed`: blocked, error summary with no secret leakage; `That bai` / `Failed`.
- `canceled`: stopped, no progress animation; `Da huy` / `Canceled`.
- `unknown`: honest fallback; `Chua xac minh` / `Unknown`.

These labels are semantic examples, not a command to add these states to backend enums. For real UI, write correct Vietnamese diacritics in translations and use actual domain wording. If canonical transitions differ, the canonical model wins. Provide an exhaustive unit test ensuring no real state silently maps to `succeeded` or `running`. For a missing or partially loaded job use safe unknown/empty states, never green-check defaults.

The diagram's visual parts, progress indicator, textual status, detail readout and accessibility description MUST derive from the exact same view model. No `Math.random`, fake timers, synthetic completion, optimistic success, speculative costs, unverified counters, or animation that changes actual process state. Mutations such as retry/approve/publish are OUT OF SCOPE unless the preexisting authorized handler, confirmations, idempotency and guards are verified and explicitly part of an approved enhancement.

---

# 5. ANATOMY VISUAL CONCEPT - SOPHIA CREATIVE ASSEMBLY LINE

Create ONE flagship isometric technical object, not a generic workflow flowchart: a compact, modern "creative assembly line" on a clear workstation bed, where a single creative-job card passes through real verified stations. It should resemble a precise machine: chassis, readable rails, small labeled consoles, stages, coherent connection geometry and calm indicator lights. The operating mechanism MUST be legible even as a still image.

The following station candidates are ONLY a vocabulary, not assumed verified stages: Intake/Idea -> Script/Planning -> Voice/Media -> Assembly -> Human Review -> Export/Publish. Inspect actual workflow code and collapse, rename, omit or reorder stations to match verified behavior. If a concept is future-only, NEVER include it in a present-tense live diagram. Visual design should favor 4-6 meaningful stations, not an unreadable 10-20 stage miniature.

Geometry and depth:
- Use one consistent isometric projection, one lighting direction, depth-sorted faces, coherent thickness and scale, no physically impossible wire endpoints, floating cards or intersecting apparatus.
- A heavy but unobtrusive base, subtle material contrast, exactly one focal moving job token, intentional empty space around labels and controls.
- Each station has unique geometry AND a visible text name; never communicate state through color alone.
- Path links are physically connected, with visible entry/exit and a clear direction. The job token never travels through failed/blocked stations in a way that implies success.
- Avoid over-detailed screws and decorations at the expense of comprehension or performance.
- Avoid realistic customer faces, stock avatars, speculative partner logos, and photo-real hero stock art.
- Use 2D SVG first, not Canvas/WebGL/3D unless a measured need and explicit approval appear later.

Design states of the physical device:
1. Idle/illustration: subtle static lighting and a visibly labeled conceptual process.
2. Step selected: station receives precise focus outline and detail card updates.
3. Running verified job: ONLY relevant stage has subtle 1.5-3 s looping activity, all completed stages remain still.
4. Waiting input/approval: movement stops at that station; actionable info in accompanying text, not a fake approval button.
5. Failed: movement stops, clear error icon and concise non-sensitive explanation.
6. Completed: only verified success shows complete path and terminal outcome.
7. No data / unknown: diagram and text explicitly say status unavailable rather than filling with optimistic progress.
8. Reduced motion / printing / JavaScript disabled: explanatory still or static list remains useful.

Use Anatomy's official kit for geometry and its `--audit` and Chrome check scripts where compatible. Inspect the actual API signatures rather than guessing method names. React output should be SSR-safe for static structure, with a small isolated client island for selection/motion. No DOM injection of untrusted stage labels into raw SVG or HTML.

---

# 6. PIXEL-LEVEL UI SYSTEM - FOLLOW CURRENT SOPHIA FIRST

Before touching a pixel, inventory actual font families, weights, semantic colors, shadows, container widths, breakpoints and dark/light support. PRESERVE existing design language. The numbers below are implementation targets only for a scope that has no conflicting local pattern; do not start a second global design system.

## 6.1 Grid and layout

- Desktop 1440 px viewport: existing shell max width preferred; otherwise a 1200-1280 px content region, 12-column grid with 24 px gutters, consistent left alignment.
- Desktop hero: visual left/right split as appropriate to the current design; target text column 42-48%, illustration 52-58%, 40-64 px gap; do not crop the object or bury CTA.
- Tablet 768-1023 px: reduced gap 24-32 px, with either two balanced columns or vertical stacking when labels are illegible.
- Mobile 320-767 px: text, CTA, then illustration in reading order; ONE scroll column, no sideways pan to discover the main action; render a simplified apparatus plus a vertically stacked accessible station list if needed.
- Validate at widths 320, 375, 390, 768, 1024, 1280 and 1440 px. At 200% zoom, text and controls must remain usable.
- Marketing section: 64-104 px vertical breathing room on desktop, 40-56 px mobile, following established site rhythm.
- Workflow figure card: desktop aspect ratio roughly 1.35-1.65, mobile roughly 1.05-1.25 or auto height as needed; do not force image scaling that destroys labels. Use `viewBox` and responsive sizing.
- In authenticated UI, inherit existing sidebar/header/dashboard grids; the explainer must never force existing columns to overflow or hide a primary task.

## 6.2 Typography and copy

- Keep current Sophia font, heading hierarchy and text tokens; do not add a display font.
- If no documented scale exists: desktop headline `clamp(2.5rem, 4.2vw, 4rem)`, tight but legible leading; section titles ~28-40 px; normal body 15-17 px; labels at least 12 px with sufficient contrast; touch descriptions 14-16 px.
- Ensure Vietnamese accents never clip; inspect uppercase letter spacing, line height, and long translations on 320 px.
- One primary CTA per visual viewport. Secondary `Explore workflow` / `Kham pha quy trinh` may scroll to the explainer without replacing existing account-start CTA.
- Public marketing language: simple customer outcomes, no developer jargon like `Inngest`, `R2`, `D1`, `seed/forest`, `webhook` or `BYOK` unless translated into understandable benefit in help text.
- Do not promise "automated publishing", "unlimited generation", "instant revenue", "100% autonomous", "verified provider" or any volume of creators/videos without current evidence.
- Inspect the homepage's `10,000+ creators` and `1M+ videos generated` claims: require a current verifiable source; if none, flag and replace with source-grounded neutral copy within approved marketing scope, without asserting fabricated adoption metrics.

## 6.3 Color and visual tokens

- Prefer existing semantic tokens: background, foreground, border, primary, muted, destructive, success and warning.
- Suggested scoped mapping (only if no equivalent exists): `--anatomy-canvas`, `--anatomy-ink`, `--anatomy-rail`, `--anatomy-surface`, `--anatomy-accent`, `--anatomy-warning`, `--anatomy-danger` mapped to EXISTING tokens.
- Isometric materials: at most 3-4 coherent surface values, no rainbow stage colors, no oversized gradients and no glows obscuring labels.
- Error/red, attention/amber and success/green always have accompanying icon and visible text.
- Meet WCAG AA 4.5:1 contrast for normal text, 3:1 for large text and meaningful UI boundaries (as applicable). Respect forced colors/high contrast.
- Support theme modes only if app already does; no surprise global color-mode switch.

## 6.4 Component micro-detail

- Figure frame: current card border radius or 16-24 px only if consistent; subtle border, restrained shadow, ample 20-32 px internal padding (16-20 px phone).
- Station labels: readable at native width, maximum two lines, no clipping; show full label in details and accessible text; never require hover on touch.
- Selected state: visible outline and consistent station emphasis; active icon does not jitter as labels change.
- Progress indicator: semantic text such as `Step 2 of 5` only if the verified model really defines 5 steps; otherwise omit ordinal.
- Status chips: one concise word/phrase + status icon + screen-reader label. No ambiguous green `READY` when the workflow is unverified.
- Detail panel desktop: side panel adjacent/below figure with station name, what it does, verified state, concise evidence/time if available, and allowed action links (if existing). Mobile: inline accordion under the figure with title + status on the trigger.
- Error copy: action-oriented, no stack traces, no raw request payloads, no secret/token fragments. Show existing request/reference ID only if safe.
- Placeholder/empty: purposeful explanation and a legitimate next action; no generic "No data" dead-end when setup not completed.
- Use existing button, skeleton, tooltip, alert, link and dialog components, with correct locale-aware navigation.

---

# 7. PAGE-BY-PAGE CHANGE CONTRACT

## A. Existing public homepage (`[locale]` as actually implemented)

**DO:** Integrate one hero illustration or one adjacent process-explainer section. Preserve header, login/get-started links, current navigation, metadata/SEO, and current page speed. Use a descriptive heading, one-sentence outcome, one main CTA, and a brief "How it works" interaction. The hero must explain Sophia more clearly in 5 seconds than the current visual.

**Desktop interaction:** 4-6 stations visible in one frame; selection by click or keyboard reveals a short contextual readout. Hover offers gentle geometry emphasis but never hides essential copy. The first frame must be understandable without interaction. A `View steps` text link jumps to an accessible ordered explanation.

**Mobile interaction:** compact non-3D SVG + stacked step disclosures; touch buttons >=44x44 CSS px, generous 8-12 px vertical separation, no scroll hijacking, no hover-only labels. CTAs must not be pushed behind a full-screen animation.

**Truth:** the public marketing diagram is explicitly conceptual. Do not animate real-looking job percentages, add user counters, or imply current background work.

## B. Existing authenticated creative-job / workflow screen (ONLY IF IT EXISTS)

**DO:** Provide a read-only process pane near existing job status, preserving existing task completion controls. Bind to a verified, authorized selector; never fetch directly from a new client-side privileged endpoint. A refresh/update is permitted only by the site's existing data policy, no artificial progress timer.

**Data:** canonical job ID and stage states stay server-owned. If background refresh exists, show a small `Updated at` label only with real timestamps and localized timezone formatting; do not display "Live" if merely stale polling. If the verified workflow model is insufficient, deliver only a presentational component story/test and document this integration as BLOCKED, not as shipped.

**Privacy:** no cross-tenant data, no provider credential, signed asset URL, debug trace or billing number exposed in the view model.

## C. Existing Setup Wizard / BYOK

**DO:** Regression-test and leave intact. Optional tiny inline help icon or explainer is allowed ONLY if a verified component already exists and change is clearly needed. Never modify data entry, key storage, encryption, provider certification, validations, submit paths or completion guards for visual reasons.

## D. Login, payments, tier, admin, Telegram, localization

**DO:** Zero functional change. Confirm routes, forms, callbacks, permission gates and translation completeness still work. No redesign, no fake states, no auth bypass to generate screenshots.

---

# 8. MOTION, INTERACTION AND ACCESSIBILITY SPEC

Implement predictable, deliberate motion. The apparatus should feel engineered, not like a video-game animation.

- Default hover/press transitions: ~120-180 ms.
- Stage selection/detail swaps: ~180-240 ms.
- Verified-running stage loop: gentle and infrequent, about 1.5-3 s, not a progress percentage simulator.
- No autoplay video, cursor follower, parallax scroll hijack, animated backgrounds, blinking alerts or perpetual whole-page movement.
- Respect `prefers-reduced-motion: reduce` immediately, including when changed at runtime; freeze meaningful movement without hiding information.
- Pause animation when tab is hidden or component out of viewport. Avoid persistent full-frame `requestAnimationFrame` work during idle.
- Keyboard: visible focus; Tab traverses actual controls in logical order; Enter/Space activate; arrow keys only when using a legitimate tabs/radio pattern; Escape closes an opened disclosure/dialog if the chosen design uses one.
- Screen readers: one descriptive title, concise long description/ordered textual alternative, accurate `aria-current`/`aria-expanded` when applicable, status updates announced politely and only when truly changed, SVG decorative parts `aria-hidden` if an equivalent description exists.
- Focus indicators at least 2 CSS px with adequate contrast; tooltips are not the sole source of instructions.
- Ensure touch/pen, reduced motion, screen readers, keyboard-only, 200% zoom, and Vietnamese/English all reach the same information.
- Use `aria-live` sparingly; do not announce every animation frame.
- All links and buttons must have real actions. No placeholder CTA, fake upload or demonstration that writes fake jobs.

---

# 9. REACT / NEXT.JS / EDGE IMPLEMENTATION RULES

- Use App Router patterns compatible with the installed Next.js version. Read local `node_modules/next/dist/docs/` where repo rules require it; do not rely on memory of old Next.js APIs.
- Make static isometric apparatus server-renderable. Isolate event handlers and motion inside a minimal `use client` component; lazy-load the interactive portion only if it improves actual performance and does not create layout shift.
- SVG must be responsive with stable `viewBox`, deterministic IDs/pattern IDs, accessible labels, coherent z-order, no hydration mismatch or uncontrolled direct DOM edits.
- Prefer existing app styling, navigation, and i18n; all new visible text must have keys in both locale dictionaries, including labels, tooltips, errors, status semantics, accessibility text, feature-disabled copy and mobile explanations.
- Use reusable presentational components only; avoid a shadow store, duplicate APIs, new queue, new DB table, or new provider SDK.
- Preserve imports and layer boundaries. Do not add new primitives to deprecated/forbidden legacy folders. Verify where UI components belong before creating files.
- Avoid `any`, dangerous raw HTML, client-side secrets, unsupported runtime APIs, unsafe event handlers and unbounded SVG node growth. Follow existing logger policy; no production console logging.
- Integrate behind an existing feature flag system if one is present. Otherwise use a simple, auditable flag with default OFF in production; make local/staging preview possible without changing production environment. Do not leak auth/config data in flag checks.
- Avoid new network calls on marketing pages. Client code must work on Cloudflare Workers/Next.js build target.
- Preserve CSP, headers, source maps, server actions, router boundaries and package locks unless the change is truly justified and reviewed.
- Keep implementation scoped: avoid changes to billing/auth/Telegram/DB migrations and any provider adapter. If such changes unexpectedly appear in `git diff`, treat as a blocking incident.

---

# 10. REQUIRED DESIGN ARTIFACTS

Write these into `docs/design/anatomy/` using actual source evidence, not generic summaries:

1. `01_SOURCE_AUDIT.md`: precise inspected files, route/component/state mapping, discrepancies, latest SHA and all unknowns.
2. `02_UX_SPEC.md`: user jobs-to-be-done, information architecture, before/after hierarchy, placement choice, exact states and interactions, mobile/desktop behavior, keyboard and screen-reader narration, localization sample, copying rules and failure cases.
3. `03_COMPONENT_CONTRACT.md`: public props, real type derivation, illustration vs verified-job modes, exhaustive mapping tests, feature flag, security boundaries, SSR/client ownership and fallbacks.
4. `04_VISUAL_QA.md`: before/after screenshot paths, viewport and theme matrix, accessibility results, contrast checks, geometry audit results, known residual defects.
5. `05_RELEASE_EVIDENCE.md`: baseline/current SHA, exact code diff, test commands and results, local performance before/after, branch/commit/remote, PR URL if created, production unchanged, rollout and rollback plan.

Keep all images under a documented local QA location; do not commit private screenshots, test logins, tokens, customer data or generated heavy output. If a screenshot cannot be taken, explicitly write NOT VERIFIED.

---

# 11. VERIFICATION MATRIX - NO FAKE GREEN

Do not claim completion until there is concrete evidence of the following:

A. Functionality
- Conceptual explainer loads and works with no user session.
- Illustrative mode is permanently distinguishable from genuine job telemetry.
- Each step activates correct detail via pointer, touch and keyboard.
- All real states map correctly; unknown/failed/paused never animate as completed.
- Optional live integration uses existing auth/tenant checks; no user can inspect another tenant's job.
- Existing primary CTA, sign-in, setup and other preserved workflows remain unchanged.

B. UX and visual
- Compare BEFORE/AFTER screenshots for 320, 375/390, 768, 1024, 1280 and 1440 px; no horizontal overflow, clipped SVG, unreadable Vietnamese, overlaid CTA or awkward focus order.
- Verify both `vi` and `en`; verify any existing light/dark theme variants.
- Respect actual existing breakpoints; stage labels and selected detail must be legible.
- Motion works and stops appropriately; snapshot/print/no-JS fallback remains useful.
- No unsupported adoption/revenue stats or 3rd-party capability assertions.

C. Accessibility
- Run existing axe/Lighthouse/Playwright audit tools where installed; zero critical/serious accessibility violations in changed surfaces.
- Manual tab sequence, focus visibility, Enter/Space, Escape (if applicable), touch targets >=44 px, reduced-motion, 200% zoom and explanatory text alternative.
- Check WCAG AA text and meaningful graphical contrast against actual background.

D. Technical
- Run the repo's actual existing scripts for TypeScript, lint, layer boundaries, i18n validation, relevant unit/integration tests, build and browser E2E; record exact commands and counts without guessing.
- `git diff --check` clean; no dirty generated artifacts, accidental lockfile churn or unexplained unrelated modifications.
- Anatomy geometry audit (`node ... --audit`) passes on the actual generated model; where available use its Chrome capture/drive/line checks and inspect the resulting PNGs. Do not call a screenshot geometry audit a proof of business logic.
- No new API key, external network dependency, third-party iframe, uncontrolled fetch, operator secret, bundle-bloating 3D mode or production console logging.
- Compare page performance locally. Targets: no meaningful regression in LCP or INP; CLS <0.1 in controlled tests; keep incremental client JS as small as reasonable and explain measured cost. Do not invent benchmarks if no reliable runner exists.
- Check Next.js server rendering and hydration, Cloudflare build compatibility, locale redirects and existing protected flows.

E. Release boundary
- Review `git diff --stat` and `git diff` to ensure only approved feature files and docs changed.
- Verify the feature is OFF on production defaults. Never assert a new live SHA or a successful production deploy.
- If a required test cannot execute for environmental reasons, show `BLOCKED/NOT VERIFIED`; do not report PASS from absence of evidence.

**STOP/NO-GO:** incompatible skill/license, unclear canonical stage semantics, cross-tenant/security risk, severe contrast/accessibility defect, broken protected flow, unreviewed dependency, unrecoverable test regression, unknown local edits, or an unexpected attempt to alter production deployment.

---

# 12. COMMIT, PUSH, PR - EXACT RELEASE DISCIPLINE

User authorizes work and a safe branch push, NOT a production release.

1. Before changes, create a feature branch based on the verified clean base. Suggested name `feat/sophia-anatomy-workflow-explainer` (add a suffix if name already exists). If current workspace has unrelated local edits, preserve them and use safe isolated worktree. Never overwrite or discard.
2. Commit only scoped files. Observe existing commit-message task-ID / CLEO hook conventions; locate a valid task ID or create a scoped task record by repository convention. Do not disable hooks to force success.
3. On verified PASS, push ONLY `origin <feature-branch>` with normal non-force `git push -u origin <feature-branch>`. Do not push `main`, modify `deploy.yml`, invoke `workflow_dispatch`, run Wrangler deployment or use emergency deployment flags.
4. Create a draft PR against `main` if GitHub CLI is already authenticated and safe, but do not merge. Otherwise provide the compare URL or exact manual PR instructions without claiming a PR exists.
5. Report exact branch, commit SHA, remote confirmation, PR URL if real, all test results, screenshots, code-review findings and remaining risks. Verify `main` is unchanged by your work. If push/auth fails, report local commit as complete but remote as NOT PUSHED.
6. The founder must make a separate later decision on enabling the flag, production deployment and customer handover, informed by actual creative-job evidence and audit status.

---

# 13. REQUIRED FOUNDER-FACING FINAL REPORT (IN VIETNAMESE)

Produce one concise but evidence-complete report in the following exact order:

**A. Verdict:** `PASS - FEATURE BRANCH PUSHED`, `PASS - LOCAL ONLY`, `HOLD`, or `NO-GO` (do not conflate code green with production green).
**B. Source audit:** actual HEAD, app entrypoints, route and component inventory, canonical job state locations, docs conflicts.
**C. Delivered UI/UX:** exact pages/locations modified, desktop/mobile behavior, both locales, visual state logic, screenshots/paths.
**D. Security:** auth, tenant, BYOK/payment/Telegram protections, no unreviewed network calls, no fake production data.
**E. Test evidence:** commands + actual numeric results, a11y, viewport matrix, geometry audit, build, baseline comparison.
**F. Git/PR:** branch, commit, push output, PR URL if verified.
**G. Risks and defects:** severity, precise file:line, remediation and decision required.
**H. Production posture:** explicitly state `PRODUCTION NOT DEPLOYED`, feature flag status, and whether customer handover is still blocked.
**I. Founder decision request:** at most one clear next gate, such as approve staging preview; do not silently advance release.

**Operating principle:** Evidence before engineering. Mechanism before animation. Real state before visual state. Trust before conversion. No production push. No invented green.

START NOW WITH PHASE ZERO. Read the repository, produce the source audit, then implement and validate the smallest high-value Anatomy integration safely. Do not stop at a plan if a safe implementation can be completed in the current authorized branch. Do not report any action as executed without tool output proving it.
