# Sophia AI Factory -- Guide UI/UX Design Specification

**Date:** 2026-03-27
**Author:** UI/UX Designer
**Target:** 2026 SaaS documentation standard (Stripe / Linear / Vercel tier)
**Stack:** Next.js 16 App Router, Tailwind CSS 4, Lucide Icons, Radix UI, next-intl

---

## 1. Design Philosophy

Current state: all 7 guide pages dump raw markdown into `GuideContentRenderer` (a `prose prose-invert` ReactMarkdown wrapper). No structured components, no interactivity, no visual hierarchy beyond heading sizes.

Target state: purpose-built React components per content type. Each page becomes a composed layout of semantic, reusable guide components -- zero raw markdown rendering. Content stays inline in page files (no CMS), but rendered through rich typed components.

Inspiration references: Stripe Docs (step-by-step cards, tabbed code blocks), Linear Docs (clean dark theme, sidebar with active indicators), Vercel Docs (callout boxes, feature grids), Tailwind Docs (search, breadcrumbs).

---

## 2. Design Tokens (Existing + New)

### 2a. Use Existing CSS Variables (DO NOT duplicate)

| Token | Dark Value | Usage |
|---|---|---|
| `--background` | `#020817` | Page bg |
| `--foreground` | `#f8fafc` | Primary text |
| `--muted` | `#1e293b` | Card/surface bg |
| `--muted-foreground` | `#94a3b8` | Secondary text |
| `--border` | `#1e293b` | Borders |
| `--neon-cyan` | `#00f0ff` | Primary accent, links, active states |
| `--neon-purple` | `#7000ff` | Secondary accent, gradients |
| `--neon-pink` | `#ff00ff` | Tertiary accent (sparingly) |

### 2b. New Semantic Tokens (add to globals.css inside `.dark {}`)

```css
/* Guide-specific semantic tokens */
--guide-surface: #0f172a;          /* Slightly lighter than bg for cards */
--guide-surface-hover: #1a2332;    /* Card hover state */
--guide-success: #10b981;          /* Green for success callouts */
--guide-warning: #f59e0b;          /* Amber for warning callouts */
--guide-danger: #ef4444;           /* Red for danger callouts */
--guide-info: var(--neon-cyan);    /* Cyan for info callouts */
```

Add to `@theme inline {}`:
```css
--color-guide-surface: var(--guide-surface);
--color-guide-surface-hover: var(--guide-surface-hover);
--color-guide-success: var(--guide-success);
--color-guide-warning: var(--guide-warning);
--color-guide-danger: var(--guide-danger);
--color-guide-info: var(--guide-info);
```

### 2c. Spacing Scale (use Tailwind defaults)

| Use Case | Class |
|---|---|
| Section gap | `space-y-12` or `gap-12` |
| Card internal padding | `p-6` |
| Between items in a list | `space-y-4` |
| Icon-to-text gap | `gap-3` |
| Page top padding | `pt-8 md:pt-12` |
| Page horizontal padding | `px-4 md:px-8 lg:px-12` |

### 2d. Typography Scale

| Element | Classes |
|---|---|
| Page title (h1) | `text-3xl md:text-4xl font-bold tracking-tight` |
| Page subtitle | `text-lg text-muted-foreground mt-2 max-w-2xl` |
| Section heading (h2) | `text-2xl font-semibold tracking-tight` |
| Subsection heading (h3) | `text-lg font-semibold` |
| Body text | `text-sm md:text-base text-muted-foreground leading-relaxed` |
| Code inline | `text-sm font-mono text-neon-cyan bg-muted/50 px-1.5 py-0.5 rounded` |
| Label/caption | `text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold` |

---

## 3. Component Inventory

All new components live in `src/components/guide/`. Each file under 200 lines.

### 3a. `guide-page-header.tsx`

Page title + subtitle with gradient accent line.

```
Props:
  title: string
  subtitle: string
  breadcrumbs?: { label: string; href: string }[]
```

Structure:
```tsx
<div className="mb-10">
  {/* Breadcrumbs */}
  <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
    <Link href="/guide" className="hover:text-neon-cyan transition-colors">Guide</Link>
    <ChevronRight className="w-3 h-3" />
    <span className="text-foreground">{current}</span>
  </nav>

  {/* Title with left accent bar */}
  <div className="flex items-start gap-4">
    <div className="w-1 h-10 rounded-full bg-gradient-to-b from-neon-cyan to-neon-purple shrink-0 mt-1" />
    <div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-lg text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>
    </div>
  </div>
</div>
```

### 3b. `guide-step-card.tsx`

Numbered step card for sequential instructions.

```
Props:
  stepNumber: number
  title: string
  children: ReactNode
  icon?: LucideIcon
```

Structure:
```tsx
<div className="relative flex gap-4 md:gap-6">
  {/* Number badge */}
  <div className="flex flex-col items-center shrink-0">
    <div className="flex items-center justify-center w-9 h-9 rounded-full
      bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-bold">
      {stepNumber}
    </div>
    {/* Connector line (hidden on last item via CSS) */}
    <div className="w-px flex-1 bg-border/60 mt-2" />
  </div>

  {/* Content */}
  <div className="pb-8 flex-1 min-w-0">
    <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
      {icon && <icon className="w-4 h-4 text-neon-cyan" />}
      {title}
    </h3>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
      {children}
    </div>
  </div>
</div>
```

Use `last:` modifier on the connector line: the parent wrapping all steps adds `[&>*:last-child_.connector]:hidden`.

### 3c. `guide-callout.tsx`

Alert/callout boxes with 4 variants.

```
Props:
  variant: "info" | "tip" | "warning" | "danger"
  title?: string
  children: ReactNode
```

Visual mapping:
| Variant | Left border | Icon | BG | Text color |
|---|---|---|---|---|
| info | `border-l-neon-cyan` | `Info` | `bg-neon-cyan/5` | `text-neon-cyan` |
| tip | `border-l-guide-success` | `Lightbulb` | `bg-guide-success/5` | `text-guide-success` |
| warning | `border-l-guide-warning` | `AlertTriangle` | `bg-guide-warning/5` | `text-guide-warning` |
| danger | `border-l-guide-danger` | `AlertCircle` | `bg-guide-danger/5` | `text-guide-danger` |

Structure:
```tsx
<div className={cn(
  "rounded-lg border-l-4 p-4 my-4",
  variantStyles[variant].container
)}>
  <div className="flex items-start gap-3">
    <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", variantStyles[variant].icon)} />
    <div>
      {title && <p className={cn("font-semibold text-sm mb-1", variantStyles[variant].title)}>{title}</p>}
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  </div>
</div>
```

### 3d. `guide-code-block.tsx`

Code block with syntax label and copy button.

```
Props:
  code: string
  language?: string
  label?: string  (e.g. "Terminal", "URL", "Command")
```

Structure:
```tsx
<div className="rounded-xl border border-border/60 bg-muted/30 overflow-hidden my-4">
  {/* Header bar */}
  <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20">
    <span className="text-xs font-mono text-muted-foreground">{label || language}</span>
    <button
      onClick={copyToClipboard}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-neon-cyan transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  </div>

  {/* Code content */}
  <pre className="p-4 overflow-x-auto">
    <code className="text-sm font-mono text-foreground/90">{code}</code>
  </pre>
</div>
```

### 3e. `guide-feature-card.tsx`

Card with icon, title, description. For feature grids.

```
Props:
  icon: LucideIcon
  title: string
  description: string
  href?: string  (makes it a link card)
```

Structure:
```tsx
<Component className={cn(
  "group rounded-xl border border-border/40 bg-guide-surface p-5",
  "transition-all duration-200",
  href && "hover:border-neon-cyan/30 hover:bg-guide-surface-hover cursor-pointer"
)}>
  <div className={cn(
    "flex items-center justify-center w-10 h-10 rounded-lg mb-3",
    "bg-neon-cyan/10 text-neon-cyan"
  )}>
    <Icon className="w-5 h-5" />
  </div>
  <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
  {href && (
    <div className="mt-3 flex items-center gap-1 text-xs text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity">
      Learn more <ArrowRight className="w-3 h-3" />
    </div>
  )}
</Component>
```

Grid layout on pages: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

### 3f. `guide-command-table.tsx`

Interactive command reference table with search/filter.

```
Props:
  commands: {
    command: string
    description: string
    example: string
    category?: string
  }[]
```

Structure:
```tsx
<div className="space-y-4">
  {/* Search bar */}
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <input
      placeholder="Search commands..."
      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border/60
        bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground/50
        focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20
        transition-colors"
    />
  </div>

  {/* Command cards (not a table -- cards are more scannable) */}
  <div className="space-y-2">
    {filteredCommands.map(cmd => (
      <div key={cmd.command} className="rounded-lg border border-border/40 bg-guide-surface p-4
        hover:border-neon-cyan/20 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <code className="text-sm font-mono text-neon-cyan font-semibold">{cmd.command}</code>
          {cmd.category && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60
              bg-muted/50 px-2 py-0.5 rounded-full">{cmd.category}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{cmd.description}</p>
        {cmd.example && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground/50">Example:</span>
            <code className="text-xs font-mono text-foreground/70 bg-muted/40 px-2 py-0.5 rounded">
              {cmd.example}
            </code>
          </div>
        )}
      </div>
    ))}
  </div>
</div>
```

### 3g. `guide-accordion.tsx`

FAQ accordion using Radix Collapsible or native `<details>`.

```
Props:
  items: { question: string; answer: ReactNode }[]
  category?: string
```

Structure (using native `<details>` for zero JS overhead):
```tsx
<div className="space-y-2">
  {category && (
    <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
      {category}
    </h3>
  )}
  {items.map((item, i) => (
    <details key={i} className="group rounded-lg border border-border/40 bg-guide-surface
      open:border-neon-cyan/20 transition-colors">
      <summary className="flex items-center justify-between p-4 cursor-pointer
        list-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-foreground pr-4">{item.question}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0
          transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
        {item.answer}
      </div>
    </details>
  ))}
</div>
```

### 3h. `guide-integration-card.tsx`

Rich integration setup card with expandable steps.

```
Props:
  name: string
  icon: LucideIcon | string (emoji)
  description: string
  pricing: string
  setupTime: string
  steps: string[]
  videoId?: string
```

Structure:
```tsx
<div className="rounded-xl border border-border/40 bg-guide-surface overflow-hidden">
  {/* Header */}
  <div className="p-6 pb-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neon-purple/10">
        {typeof icon === 'string' ? <span className="text-xl">{icon}</span> : <Icon className="w-5 h-5 text-neon-purple" />}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{name}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>

    {/* Meta badges row */}
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 text-muted-foreground px-2.5 py-1 rounded-full">
        <DollarSign className="w-3 h-3" /> {pricing}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs bg-muted/50 text-muted-foreground px-2.5 py-1 rounded-full">
        <Clock className="w-3 h-3" /> {setupTime}
      </span>
    </div>
  </div>

  {/* Video (if present) */}
  {videoId && <YouTubeEmbed videoId={videoId} title={name} />}

  {/* Steps */}
  <div className="p-6 pt-4 border-t border-border/20">
    <h4 className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold mb-3">
      Setup Steps
    </h4>
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className="flex items-center justify-center w-5 h-5 rounded-full
            bg-neon-cyan/10 text-neon-cyan text-[10px] font-bold shrink-0 mt-0.5">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  </div>
</div>
```

### 3i. `guide-progress-stepper.tsx`

Horizontal progress indicator for multi-step flows (e.g. Getting Started).

```
Props:
  steps: { label: string; completed?: boolean; active?: boolean }[]
```

Structure:
```tsx
<div className="flex items-center gap-0 overflow-x-auto pb-2 mb-8">
  {steps.map((step, i) => (
    <div key={i} className="flex items-center">
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-colors",
          step.completed && "bg-neon-cyan text-background border-neon-cyan",
          step.active && "border-neon-cyan text-neon-cyan bg-neon-cyan/10",
          !step.completed && !step.active && "border-border text-muted-foreground"
        )}>
          {step.completed ? <Check className="w-4 h-4" /> : i + 1}
        </div>
        <span className={cn(
          "text-[10px] mt-1.5 whitespace-nowrap",
          step.active ? "text-neon-cyan font-medium" : "text-muted-foreground"
        )}>{step.label}</span>
      </div>
      {i < steps.length - 1 && (
        <div className={cn(
          "w-8 md:w-16 h-px mx-1",
          step.completed ? "bg-neon-cyan" : "bg-border"
        )} />
      )}
    </div>
  ))}
</div>
```

### 3j. `guide-link-card.tsx`

Navigation cards for "Next Steps" sections at bottom of each page.

```
Props:
  title: string
  description: string
  href: string
  icon: LucideIcon
```

Structure:
```tsx
<Link href={href} className="group flex items-center gap-4 rounded-xl border border-border/40
  bg-guide-surface p-4 hover:border-neon-cyan/30 hover:bg-guide-surface-hover transition-all">
  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0">
    <Icon className="w-5 h-5" />
  </div>
  <div className="flex-1 min-w-0">
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <p className="text-xs text-muted-foreground truncate">{description}</p>
  </div>
  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-neon-cyan
    group-hover:translate-x-1 transition-all shrink-0" />
</Link>
```

Use in 2-column grid: `grid grid-cols-1 md:grid-cols-2 gap-3`

### 3k. `guide-table.tsx`

Styled data table with zebra striping.

```
Props:
  headers: string[]
  rows: (string | ReactNode)[][]
  compact?: boolean
```

Structure:
```tsx
<div className="rounded-xl border border-border/40 overflow-hidden my-4">
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-muted/30 border-b border-border/40">
        {headers.map(h => (
          <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider
            font-semibold text-muted-foreground">{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} className={cn(
          "border-b border-border/20 last:border-0",
          i % 2 === 1 && "bg-muted/10"
        )}>
          {row.map((cell, j) => (
            <td key={j} className="px-4 py-3 text-muted-foreground">{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### 3l. `guide-section.tsx`

Section wrapper with optional anchor ID and divider.

```
Props:
  id?: string
  title: string
  subtitle?: string
  children: ReactNode
```

Structure:
```tsx
<section id={id} className="scroll-mt-20">
  <div className="flex items-center gap-3 mb-4">
    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
    {id && (
      <button onClick={() => copyAnchorLink(id)} className="opacity-0 group-hover:opacity-100
        text-muted-foreground hover:text-neon-cyan transition-all">
        <Link2 className="w-4 h-4" />
      </button>
    )}
  </div>
  {subtitle && <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{subtitle}</p>}
  {children}
</section>
```

---

## 4. Sidebar Enhancement

The existing sidebar in `layout.tsx` is functional. Enhancements:

### 4a. Active State Improvement

Current active state is good. Add a subtle left-bar indicator:

```tsx
// Active link addition
isActive && "relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-5 before:rounded-full before:bg-neon-cyan"
```

### 4b. Section Dividers

Group sidebar links with section headers:

```tsx
const sidebarGroups = [
  {
    label: "Getting Started",
    links: [
      { href: "/guide", label: t('guide.sidebar.getting_started'), icon: BookOpen },
      { href: "/guide/how-it-works", label: t('guide.sidebar.how_it_works'), icon: Map },
    ]
  },
  {
    label: "Reference",
    links: [
      { href: "/guide/screens", label: t('guide.sidebar.screen_guide'), icon: Monitor },
      { href: "/guide/commands", label: t('guide.sidebar.commands'), icon: Terminal },
      { href: "/guide/integrations", label: t('guide.sidebar.integrations'), icon: Link2 },
    ]
  },
  {
    label: "Help",
    links: [
      { href: "/guide/telegram", label: t('guide.sidebar.telegram'), icon: MessageCircle },
      { href: "/guide/faq", label: t('guide.sidebar.faq'), icon: HelpCircle },
    ]
  }
];
```

Section header: `<div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold px-3 pt-4 pb-1">{group.label}</div>`

### 4c. Sidebar Footer

Add a subtle footer with version/last-updated info:

```tsx
<div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/20">
  <p className="text-[10px] text-muted-foreground/40">Last updated: March 2026</p>
</div>
```

---

## 5. Page-by-Page Layout Specifications

### 5a. `/guide` -- Getting Started

**Layout:**
1. `GuidePageHeader` -- title: "Getting Started", subtitle: "Your first steps with Sophia AI Factory"
2. `GuideProgressStepper` -- 5 steps: Access Dashboard / Setup API Keys / Create Campaign / View Results / Get Help
3. **Step 1: Access Dashboard** -- `GuideSection` + `GuideStepCard` (5 sub-steps) + `GuideCallout variant="tip"` for signup note
4. **Step 2: Setup API Keys**
   - `GuideCallout variant="info"` explaining what API keys are
   - Three sub-sections (2a/2b/2c) each using `GuideStepCard` with numbered sub-steps
   - Each sub-section has a `GuideCallout variant="tip"` explaining the service purpose
5. **Step 3: Create First Campaign** -- `GuideStepCard` with 7 steps + `GuideCallout variant="info"`
6. **Step 4: View & Download** -- `GuideStepCard` with 6 steps
7. **Step 5: Need Help** -- `GuideFeatureCard` grid (3-col) linking to support channels
8. **Next Steps** -- `GuideLinkCard` grid (2-col) linking to Telegram, How It Works, Pricing

### 5b. `/guide/how-it-works` -- How the Platform Works

**Layout:**
1. `GuidePageHeader` -- title: "How It Works", subtitle: "Your journey from signup to published video"
2. **Welcome section** -- body text with a `GuideFeatureCard` grid (5 items) showing Sophia capabilities (find products, write scripts, create voice, create avatar, publish)
3. **Journey Map** -- Replace ASCII art with visual step flow:
   - Use a vertical `GuideStepCard` chain: Landing > Signup > Setup Wizard > Dashboard > Telegram Bot
   - Each step has brief description + time estimate badge
4. **Quick Flow** -- Horizontal pipeline visualization using `GuideProgressStepper` (Login > Choose Template > Enter Content > Wait 3-5m > Download)
5. **Status Colors** -- `GuideTable` with colored badge dots: `<span className="inline-block w-2 h-2 rounded-full bg-guide-warning" />` etc.
6. **Support** -- `GuideTable`
7. **Next Steps** -- `GuideLinkCard` grid

### 5c. `/guide/commands` -- AI Commands Reference

**Layout:**
1. `GuidePageHeader` -- title: "Telegram Bot Commands", subtitle: "Complete reference for @Sophia_Bbot"
2. **Quick Start** -- `GuideStepCard` chain (4 steps): Open Telegram > Search @Sophia_Bbot > Press Start > Link email
3. **Command Reference** -- `GuideCommandTable` with all 6 commands, searchable
4. **Creating Videos via Telegram** -- `GuideStepCard` chain (5 steps)
5. **Pro Tips** -- `GuideCallout variant="tip"` for each tip
6. **Next Steps** -- `GuideLinkCard` grid

### 5d. `/guide/screens` -- UI Screenshots Guide

**Layout:**
1. `GuidePageHeader` -- title: "Screen-by-Screen Guide", subtitle: "Complete walkthrough of every Sophia interface"
2. **Table of Contents** -- `GuideTable` with page names, URLs, and link to section anchors
3. **Per-screen sections (9 total)** -- Each uses `GuideSection` with:
   - URL displayed in `GuideCodeBlock` (label: "URL")
   - `GuideTable` for component breakdown
   - `GuideCallout variant="info"` for user action tips
   - Status colors section uses colored dots (same as how-it-works)
4. **Next Steps** -- `GuideLinkCard` grid

### 5e. `/guide/integrations` -- API Integrations

**Layout:**
1. `GuidePageHeader` -- title: "Platform Integrations", subtitle: "Connect Sophia to AI services in under 5 minutes"
2. **Integration cards** -- 4x `GuideIntegrationCard` in a `space-y-8` stack
   - Keep existing data structure (integrations array)
   - Each card rendered via `GuideIntegrationCard` component
3. **Next Steps** -- `GuideLinkCard` grid

**Note:** This page already has custom rendering (not using GuideContentRenderer). Refactor to use the new components while preserving the data structure.

### 5f. `/guide/telegram` -- Telegram Bot Setup

**Layout:**
1. `GuidePageHeader` -- title: "Telegram Bot Setup", subtitle: "Control your campaigns from your phone with @Sophia_Bbot"
2. **Install Telegram** -- `GuideStepCard` chain (5 steps) + `GuideCallout variant="tip"` ("Already have Telegram? Skip this")
3. **Connect to @Sophia_Bbot** -- `GuideStepCard` chain (11 steps)
4. **Commands Reference** -- Per-command sections:
   - `/campaign` -- `GuideStepCard` chain (6 steps)
   - `/status` -- body text + status colors with dots
   - `/results`, `/start`, `/stop`, `/help` -- brief descriptions in `GuideFeatureCard` grid
5. **Summary Table** -- `GuideTable` with all commands
6. **Usage Tips** -- `GuideCallout variant="tip"` for each tip
7. **Need Help** -- `GuideLinkCard` grid

### 5g. `/guide/faq` -- FAQ

**Layout:**
1. `GuidePageHeader` -- title: "Frequently Asked Questions", subtitle: "Quick answers to common questions"
2. **FAQ sections by category** -- Each category is a `GuideSection`:
   - Category 1: Overview (4 questions)
   - Category 2: API Keys (2 questions)
   - Category 3: Campaigns (2 questions)
   - Category 4: Telegram Bot (1 question)
   - Category 5: Payment (1 question)
   - Category 6: Support -- `GuideTable` instead of accordion
   - Category 7: Data Ownership -- `GuideCallout variant="info"` with bullet list
3. Each category uses `GuideAccordion` component
4. **Still Have Questions?** -- `GuideLinkCard` to Telegram and email support

---

## 6. File Structure

```
src/components/guide/
  guide-page-header.tsx        (breadcrumbs + title + subtitle)
  guide-step-card.tsx          (numbered step with connector line)
  guide-callout.tsx            (info/tip/warning/danger boxes)
  guide-code-block.tsx         (code with copy button)
  guide-feature-card.tsx       (icon + title + desc card)
  guide-command-table.tsx      (searchable command cards)
  guide-accordion.tsx          (FAQ accordion)
  guide-integration-card.tsx   (rich integration setup card)
  guide-progress-stepper.tsx   (horizontal step indicator)
  guide-link-card.tsx          (next-steps navigation card)
  guide-table.tsx              (styled data table)
  guide-section.tsx            (section wrapper with anchor)
  guide-content-renderer.tsx   (KEEP for backward compat, phase out)
  youtube-embed.tsx            (KEEP as-is)
```

**Total new files: 12** (all under 200 lines each)

---

## 7. Implementation Priority

### Phase 1 -- Foundation (build components)
1. Add guide-specific CSS tokens to `globals.css`
2. Build `guide-page-header.tsx`
3. Build `guide-section.tsx`
4. Build `guide-callout.tsx`
5. Build `guide-step-card.tsx`
6. Build `guide-code-block.tsx`
7. Build `guide-table.tsx`
8. Build `guide-link-card.tsx`

### Phase 2 -- Specialized components
9. Build `guide-feature-card.tsx`
10. Build `guide-command-table.tsx`
11. Build `guide-accordion.tsx`
12. Build `guide-integration-card.tsx`
13. Build `guide-progress-stepper.tsx`

### Phase 3 -- Page conversions (one at a time)
14. Convert `/guide` (Getting Started) -- most critical, first impression
15. Convert `/guide/faq` -- uses accordion, validates it works
16. Convert `/guide/commands` -- uses command table
17. Convert `/guide/integrations` -- already partially custom, refactor
18. Convert `/guide/telegram` -- uses step cards heavily
19. Convert `/guide/how-it-works` -- uses journey flow
20. Convert `/guide/screens` -- most content-heavy, last

### Phase 4 -- Sidebar & polish
21. Refactor sidebar with grouped sections
22. Add breadcrumbs to all pages
23. Mobile responsiveness QA pass
24. Accessibility audit (focus states, aria labels, color contrast)

---

## 8. Accessibility Checklist

- All interactive elements have visible focus states: `focus-visible:ring-2 focus-visible:ring-neon-cyan/50 focus-visible:outline-none`
- Accordion uses `<details>/<summary>` for native keyboard support
- Code copy button has aria-label: `aria-label="Copy code to clipboard"`
- Color contrast: neon-cyan (`#00f0ff`) on dark bg (`#020817`) = ratio 10.2:1 (AAA)
- Color contrast: muted-foreground (`#94a3b8`) on dark bg = ratio 5.7:1 (AA)
- Touch targets: all buttons/links min 44x44px on mobile
- All icons have `aria-hidden="true"`, text labels provided separately
- Tables have proper `<thead>/<tbody>` structure
- Steps use ordered list semantics where applicable

---

## 9. i18n Considerations

- All static text in components uses `useTranslations('guide')` from next-intl
- Component props accept translated strings from page files
- Page files import `useTranslations` and pass translated strings to components
- RTL: not needed (Vietnamese and English are LTR)
- Vietnamese font support: Geist Sans supports Vietnamese diacriticals -- verified

---

## 10. Performance Notes

- `GuideAccordion` uses native `<details>` -- zero JS
- `GuideCodeBlock` lazy-loads copy functionality (useState only when needed)
- `GuideCommandTable` uses client-side filtering with `useDeferredValue` for search
- No markdown parsing at runtime -- all content is JSX
- Remove `react-markdown` dependency from guide pages (keep for any other usage)
- Images/videos use native `loading="lazy"`

---

## 11. Migration Strategy

**Approach:** Convert one page at a time. Keep `GuideContentRenderer` functional during migration.

1. Build all components first (Phase 1-2)
2. Convert pages one by one, replacing `const content = \`...\`` with structured JSX
3. After all pages converted, `GuideContentRenderer` can be deprecated
4. Each conversion = one focused commit

**DO NOT:** Break existing pages during migration. Each page conversion is atomic.

---

## Unresolved Questions

1. Should sidebar include a search input at top? (Would need search index across guide content)
2. Should guide pages support light mode? Currently forced dark -- the tokens above assume dark only.
3. Should we add "Was this helpful?" feedback at bottom of each page? (Requires API endpoint)
4. Video tutorials: should we add video embeds to Getting Started and Telegram pages? (Currently only on Integrations)
