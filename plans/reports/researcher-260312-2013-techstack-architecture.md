# Tech Stack & Architecture Research Report

**Project:** SOPHIA Proposal (AI Video Factory)
**Date:** 2026-03-12
**Researcher:** af02ef4080eb66fb3

---

## 1. Core Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15.3.0 (16.x docs) | Static site generation |
| UI Library | React | 19.2.3 | Component rendering |
| Language | TypeScript | 5.9.3 | Type safety |
| Test Runner | Vitest | 3.2.4 | Unit/integration tests |
| Styling | Tailwind CSS | 4.2.1 | Utility-first CSS |
| Animation | Framer Motion | 12.34.3 | Motion effects |
| Icons | Lucide React | 0.563.0 | Icon library |
| Validation | Zod | 4.3.6 | Input validation |
| Deployment | Vercel / Cloudflare Pages | - | Edge hosting |

**Note:** Architecture doc states Next.js 16, but `package.json` shows 15.3.0 — version mismatch.

---

## 2. Architecture Patterns

### Static Export Configuration
```typescript
// next.config.ts
output: 'export'
images: { unoptimized: true, disableStaticImages: true }
distDir: 'out'
```

**Implications:**
- No SSR/ISR — pure static HTML/CSS/JS
- Images must be pre-optimized (no `next/image` optimization)
- Deployable to any CDN (Vercel, Cloudflare Pages, Netlify)

### Client-Side Auth Pattern
```typescript
// Allowed: setState in useEffect for initial auth state
// eslint.config.mjs disables "react-hooks/set-state-in-effect"
```

**Use Case:** JWT token storage, session management on client.

### Component Architecture
- **10 Section Components:** Hero, Workflow, Features, AffiliateDiscovery, Pricing, TechStack, ROICalculator, Affiliates, FAQ, Footer
- **Pattern:** `'use client'` + Framer Motion + Lucide icons
- **File Size Limit:** <200 lines per component (enforced by code standards)

---

## 3. Security Patterns

### Security Headers (via `lib/security-headers.ts`)
```typescript
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Deployment:** Headers applied at Cloudflare Pages edge level via `public/_headers`.

### Input Validation with Zod
```typescript
// Used in: polar-config.ts, webhook handlers
// Pattern: Schema-based validation with descriptive errors
```

### Polar.sh Payment Integration
```typescript
// app/lib/polar-config.ts
export const PolarConfig = {
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
  productId: process.env.POLAR_PRODUCT_ID,
  baseUrl: 'https://api.polar.sh',
}
```

**Files:**
- `app/lib/polar-config.ts` — Config + validation
- `app/lib/polar-webhook-handler.ts` — Webhook processing
- `app/lib/polar-webhook-handler.test.ts` — Webhook tests

---

## 4. Testing Strategy

### Vitest Configuration (`vitest.config.ts`)
```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
  coverage: {
    thresholds: { global: { lines: 50 } }  // Current: 50% target
  }
}
```

### Test Files (7 total)
| File | Type | Coverage |
|------|------|----------|
| `utils.test.ts` | Utility functions | - |
| `llm-types.test.ts` | Type definitions | - |
| `llm-client.test.ts` | API client | - |
| `affiliate-data.test.ts` | Data validation | - |
| `polar-webhook-handler.test.ts` | Webhook logic | - |
| `usage-metering.test.ts` | Usage calculations | - |
| `license-page.test.tsx` | Component test | E2E-ish |

### Coverage Targets (per `development-roadmap.md`)
- Q1 2026: 50% (current target)
- Q2 2026: 70%
- Q3 2026: 80%
- Q4 2026: 90%

---

## 5. Build & Deployment

### Build Pipeline
```bash
npm run build
# → TypeScript compile
# → Static optimization
# → Output: .next/ → out/
```

### Quality Gates
| Gate | Tool | Threshold |
|------|------|-----------|
| Linting | ESLint | 0 errors |
| Types | TypeScript | 0 errors |
| Tests | Vitest | 100% pass |
| Coverage | Vitest | 50%+ (current) |
| Build | Next.js | Success |

### Deployment Flow
```
git push → Vercel/GitHub Actions → Build → Edge Cache Invalidation → Global (~30s)
```

---

## 6. File Structure
```
app/
├── components/          # UI components
├── lib/                 # Utilities + services
│   ├── polar-config.ts
│   ├── polar-webhook-handler.ts
│   ├── security-headers.ts
│   └── *.test.ts       # Test files
├── admin/               # Admin dashboard
└── page.tsx            # Main landing
```

---

## 7. Unresolved Questions

1. **Next.js Version Mismatch:** Docs say 16.x, `package.json` shows 15.3.0 — which is correct?
2. **E2E Testing:** No Playwright/Cypress detected — only unit tests with Vitest. Is E2E planned?
3. **CI/CD Provider:** Docs mention both Vercel and Cloudflare Pages — which is primary?
4. **Backend API:** References to `https://api.sophia.agencyos.network` — where is backend hosted?
5. **Type Coverage:** Current threshold is 50% lines — is there a plan to increase to 80%+?

---

## Sources

- `docs/system-architecture.md` — Architecture overview
- `docs/code-standards.md` — Code quality rules
- `docs/development-roadmap.md` — Testing targets
- `package.json` — Dependencies
- `tsconfig.json` — TypeScript config
- `vitest.config.ts` — Test configuration
- `eslint.config.mjs` — Linting rules
- `next.config.ts` — Build config
- `lib/security-headers.ts` — Security patterns
- `app/lib/polar-config.ts` — Payment integration
