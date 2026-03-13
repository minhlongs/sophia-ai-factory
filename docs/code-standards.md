# Sophia Proposal - Code Standards

**Version:** 1.0
**Last Updated:** 2026-03-10

---

## 1. TypeScript Standards

### Strict Mode
Always enabled - No `any` types allowed.

```typescript
// ✅ GOOD
interface User {
  id: string
  name: string
  email: string
}

// ❌ BAD
const user: any = {}
```

### File Naming
- **Components:** PascalCase (`Hero.tsx`, `Pricing.tsx`)
- **Utilities:** kebab-case (`affiliate-data.ts`, `roi-calculator.ts`)
- **Tests:** `*.test.tsx`

---

## 2. React Standards

### Component Structure
```typescript
'use client'

import { motion } from 'framer-motion'
import { IconName } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export const ComponentName = ({ title, description }: Props) => {
  return (
    <section className="py-24 px-4">
      <h2>{title}</h2>
    </section>
  )
}
```

### Rules
- Always use functional components
- Use `use client` only when needed (animations, state)
- Destructure props in function signature
- Keep components <200 lines

---

## 3. Styling Standards

### Tailwind CSS v4
```typescript
// ✅ GOOD
<div className="flex items-center gap-4 bg-primary/10 p-6 rounded-xl" />

// ❌ BAD
<div style={{ display: 'flex', alignItems: 'center' }} />
```

### Animation (Framer Motion)
```typescript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

---

## 4. Testing Standards

### Vitest + React Testing Library
```typescript
import { render, screen } from '@testing-library/react'
import { Hero } from './Hero'

describe('Hero', () => {
  it('renders heading', () => {
    render(<Hero />)
    expect(screen.getByText(/AI Video Factory/i)).toBeInTheDocument()
  })
})
```

### Coverage Target
- **Minimum:** 80%
- **Critical paths:** 100%

---

## 5. Git Standards

### Commit Format
```
<type>(<scope>): <description>

feat(proposal): add ROI calculator component
fix(hero): resolve mobile layout overflow
docs(readme): update deployment guide
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Test additions
- `chore:` Maintenance

---

## 6. Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] No `any` types
- [ ] No `console.log` in production code
- [ ] No TODO/FIXME comments
- [ ] All tests passing
- [ ] ESLint clean
- [ ] Build successful
- [ ] Mobile responsive

---

## 7. Quality Gates (CI/CD)

| Gate | Threshold | Action |
|------|-----------|--------|
| ESLint | 0 errors | Block merge |
| TypeScript | 0 errors | Block merge |
| Tests | 100% pass | Block merge |
| Coverage | 80%+ | Warning |
| Build | Success | Block merge |

---

## 8. File Structure

```
app/
├── components/
│   ├── sections/      # Page sections
│   └── layout/        # Layout components
├── lib/               # Utilities
└── tests/             # Test files
```

---

## 9. Best Practices

### YAGNI
Don't add features until needed.

### KISS
Keep it simple - prefer readability over cleverness.

### DRY
Extract reusable utilities, but avoid premature abstraction.

### Performance
- Lazy load heavy components
- Optimize images (WebP, lazy loading)
- Minimize re-renders (React.memo, useMemo)
