# Sophia Proposal - System Architecture

**Version:** 1.0
**Last Updated:** 2026-03-10

---

## 1. Overview

Sophia Proposal là một static landing page built với Next.js 16 và React 19, được thiết kế để giới thiệu AI Video Factory platform.

### Key Characteristics
- **Type:** Static Marketing Site
- **Architecture:** Single-page Application (SPA)
- **Rendering:** Static Site Generation (SSG)
- **Deployment:** Cloudflare Pages Edge Network

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Pages Edge Network (CDN)        │
│            - Global caching                             │
│            - HTTPS/SSL termination                      │
│            - Compression (Brotli)                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│             Next.js 16 Application                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  App Router (app/)                               │   │
│  │  ├─ page.tsx (Main landing page)                │   │
│  │  ├─ layout.tsx (Root layout)                    │   │
│  │  └─ components/                                  │   │
│  │     ├─ sections/ (10 section components)        │   │
│  │     └─ layout/ (MobileNav)                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Build Process                                   │   │
│  │  - TypeScript compilation                        │   │
│  │  - Tree shaking                                  │   │
│  │  - Code splitting                                │   │
│  │  - Static optimization                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

### Section Components (10 total)

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| Hero | Above-fold value prop | framer-motion |
| Workflow | 4-step process | framer-motion |
| Features | Platform capabilities | lucide-react |
| AffiliateDiscovery | 18 affiliate programs | lucide-react |
| Pricing | 4-tier subscription | framer-motion |
| TechStack | Technology showcase | lucide-react |
| ROICalculator | Interactive ROI | react hooks |
| Affiliates | Success stories | framer-motion |
| FAQ | Common questions | framer-motion |
| Footer | Links + legal | lucide-react |

### Component Pattern

```typescript
'use client'

import { motion } from 'framer-motion'
import { IconName } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export const SectionComponent = ({ title, description }: Props) => {
  return (
    <section className="py-24 px-4 bg-[#0A0A0F]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>{title}</h2>
      </motion.div>
    </section>
  )
}
```

---

## 4. Data Flow

```
┌─────────────────┐
| affiliate-data  │
|   .ts           │
└────────┬────────┘
         │
         │ Export: affiliatePrograms[]
         │
         ▼
┌─────────────────────────┐
│  AffiliateDiscovery.tsx │
│  - Import data          │
│  - Map to cards         │
│  - Render UI            │
└─────────────────────────┘
```

### Data Structure

```typescript
interface AffiliateProgram {
  id: string
  name: string
  category: string
  commission: string
  description: string
  link: string
  color: 'cyan' | 'purple' | 'pink'
}
```

---

## 5. Styling Architecture

### Tailwind CSS v4

- **Configuration:** `postcss.config.mjs`
- **Global styles:** `app/globals.css`
- **Utility-first:** Inline className

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-inter` | Geist | Body text |
| `--font-space` | Geist_Mono | Headings |
| `bg-[#0A0A0F]` | Dark bg | Sections |
| `text-primary` | Cyan | CTAs |

---

## 6. Animation Strategy

### Framer Motion

All animations use Framer Motion with `LazyMotion` pattern:

```typescript
// LazyMotionProvider.tsx
import { LazyMotion, domAnimation } from 'framer-motion'

export const LazyMotionProvider = ({ children }) => (
  <LazyMotion features={domAnimation}>
    {children}
  </LazyMotion>
)
```

### Animation Types

| Type | Pattern | Example |
|------|---------|---------|
| Fade in | `opacity: 0 → 1` | Hero section |
| Slide up | `y: 20 → 0` | Feature cards |
| Hover | `scale: 1 → 1.05` | CTA buttons |

---

## 7. Build & Deployment

### Build Process

```bash
npm run build
# → TypeScript compile
# → Next.js static optimization
# → Output: .next/
```

### Deployment Flow

```
git push origin master
    ↓
GitHub webhook
    ↓
Cloudflare Pages auto-deploy
    ↓
Build + Test
    ↓
Edge Network cache invalidate
    ↓
Global propagation (~30s)
```

---

## 8. Testing Architecture

### Vitest Configuration

```
sophia-proposal/
├── vitest.config.ts    # Test configuration
├── tests/
│   └── setup.ts        # Jest-dom matchers
└── app/
    └── **/*.test.tsx   # Component tests
```

### Test Pattern

```typescript
import { render, screen } from '@testing-library/react'
import { Component } from './Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByText(/title/i)).toBeInTheDocument()
  })
})
```

---

## 9. Quality Gates

| Gate | Tool | Threshold |
|------|------|-----------|
| Linting | ESLint | 0 errors |
| Types | TypeScript | 0 errors |
| Tests | Vitest | 100% pass |
| Coverage | Vitest | 80%+ |
| Build | Next.js | Success |

---

## 10. File Structure

```
sophia-proposal/
├── app/
│   ├── components/
│   │   ├── sections/
│   │   │   ├── Hero.tsx
│   │   │   ├── Hero.test.tsx
│   │   │   ├── Workflow.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── AffiliateDiscovery.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── TechStack.tsx
│   │   │   ├── ROICalculator.tsx
│   │   │   ├── Affiliates.tsx
│   │   │   ├── FAQ.tsx
│   │   │   └── Footer.tsx
│   │   └── layout/
│   │       └── MobileNav.tsx
│   ├── lib/
│   │   └── affiliate-data.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── tests/
│   └── setup.ts
├── docs/
│   ├── project-overview-pdr.md
│   ├── development-roadmap.md
│   ├── code-standards.md
│   └── system-architecture.md
├── plans/
│   └── reports/
├── vitest.config.ts
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── next.config.ts
```

---

## 11. Dependencies

### Production

| Package | Purpose |
|---------|---------|
| next 16.1.6 | Framework |
| react 19.2.3 | UI library |
| framer-motion 12.34.3 | Animations |
| lucide-react 0.563.0 | Icons |
| tailwind-merge 3.5.0 | Class merging |
| clsx 2.1.1 | Conditional classes |

### Development

| Package | Purpose |
|---------|---------|
| vitest 3.2.4 | Test runner |
| @testing-library/react | Component tests |
| @testing-library/jest-dom | DOM matchers |
| typescript 5.9.3 | Type checking |
| eslint 9.39.3 | Linting |

---

## 12. Performance Optimization

### Implemented

- ✅ Code splitting (automatic)
- ✅ Tree shaking (automatic)
- ✅ Image optimization (next/image)
- ✅ Font optimization (next/font)
- ✅ CSS purging (Tailwind)

### Future

- ⏳ React Server Components
- ⏳ Partial Prerendering (PPR)
- ⏳ Edge runtime for dynamic content
