# Sophia AI Factory Bootstrap - Best Practices 2026

**Date:** 2026-03-08
**Project:** Sophia AI Factory (Next.js + Remotion + Polar.sh + Supabase)

---

## 1. Next.js 15+ App Router Best Practices

### Top 10 Practices

1. **Server Components by Default** - Use Server Components for data fetching, authentication, and business logic. Only use `"use client"` when you need interactivity (hooks, event handlers, browser APIs).

2. **Route Handlers for APIs** - Use `app/api/[route]/route.ts` for all API endpoints. Export `GET`, `POST`, `PUT`, `DELETE` methods directly.

3. **Streaming with Suspense** - Use `next/streaming` for incremental rendering. Wrap slow components in `<Suspense fallback={<Loading />}>`.

4. **Data Fetching Pattern**:
```typescript
// app/api/data/route.ts
export async function GET() {
  const { data, error } = await supabase.from('items').select('*')
  if (error) throw error
  return Response.json(data)
}
```

5. **Nested Layouts for Section Isolation** - Create nested `@folder/layout.tsx` for grouped routes with shared layout.

6. **Error Boundaries** - Create `error.tsx` at any level to catch errors in child routes:
```typescript
// app/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error, reset: () => void }) {
  return <button onClick={reset}>Try again</button>
}
```

7. **Parallel Routes for Dashboard** - Use `@dashboard/layout.tsx` and `@settings/layout.tsx` for independent route trees.

8. **Middleware Optimization** - Keep `middleware.ts` lightweight. Use `matcher` to limit scope:
```typescript
export const config = { matcher: ['/dashboard/:path*', '/admin/:path*'] }
```

9. **Font Optimization** - Use `next/font` with `subsets` and `display: 'swap'`:
```typescript
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap' })
```

10. **Metadata API** - Use static `metadata` export for SEO:
```typescript
export const metadata = { title: 'Page', description: '...' }
```

### Anti-Patterns

- ❌ Using `getServerSideProps` in App Router
- ❌ Client-side routing with `window.location`
- ❌ Overusing `"use client"` (causes hydration overhead)
- ❌Large server component bundles (split code with lazy loading)

---

## 2. TypeScript Strict Mode Patterns

### Top 10 Practices

1. **Enable Strict Mode** in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

2. **Never Use `any`** - Use `unknown` for unclear types, `never` for unreachable code.

3. **Controller Pattern for APIs**:
```typescript
type UserController = {
  getUser: (id: string) => Promise<User | null>
  createUser: (data: CreateUserDto) => Promise<User>
}
```

4. **Discriminated Unions for State**:
```typescript
type AsyncState<T> =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
```

5. **Utility Types** for composition:
- `ReturnType<T>`, `PromiseReturnType<T>`
- `Exclude<T, U>`, `Extract<T, U>`
- `Partial<T>`, `Required<T>`, `Readonly<T>`
- `Omit<T, K>`, `Pick<T, K>`

6. **Layout Define_Type Names** - Use PascalCase for types, camelCase for values.

7. **Zod for Runtime Validation** (beyond TypeScript):
```typescript
const UserSchema = z.object({ id: z.string(), name: z.string() })
type User = z.infer<typeof UserSchema>
```

8. **Module Augmentation** for third-party types:
```typescript
// types/next-auth.d.ts
declare module 'next-auth' {
  interface User { tier: 'basic' | 'premium' | 'enterprise' }
}
```

9. **Type Guards** for narrowing:
```typescript
function isError(value: unknown): value is Error {
  return value instanceof Error
}
```

10. **Separate Domain Models** from API/DB models to prevent coupling.

---

## 3. Testing Pyramid (Vitest + Playwright)

### Top 10 Practices

1. **Pyramid Distribution** - 70% Unit, 20% Integration, 10% E2E.

2. **Unit Tests with Vitest**:
```typescript
// lib/auth.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCurrentUser } from './auth'

vi.mock('@lib/supabase/server', () => ({ createServerClient: vi.fn() }))

describe('getCurrentUser', () => {
  it('returns user when authenticated', async () => {
    // test implementation
  })
})
```

3. **Integration Tests** - Test API routes with Supabase:
```typescript
// app/api/users/route.test.ts
import { test, expect } from 'vitest'
import { GET } from './route'

test('GET /api/users returns 200', async () => {
  const request = new Request('https://example.com/api/users')
  const response = await GET(request)
  expect(response.status).toBe(200)
})
```

4. **E2E Tests with Playwright**:
```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test('user can log in with magic link', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[email]', 'test@example.com')
  await page.click('button[type=submit]')
  await expect(page.locator('[role=alert]')).toBeVisible()
})
```

5. **Mock Supabase Client**:
```typescript
const mockSupabase = {
  from: vi.fn().mockReturnThis,
  select: vi.fn().mockResolvedValue({ data: [], error: null }),
  insert: vi.fn().mockReturnThis,
  eq: vi.fn().mockReturnThis,
}
```

6. **Coverage Target** - Aim for 80%+ line coverage for critical paths.

7. **Test Files Near Source** - `src/lib/auth.ts` → `src/lib/auth.test.ts`.

8. **Setup/Teardown** - Use `beforeAll`/`afterAll` for database setup.

9. **Error Case Testing** - Test all error paths explicitly.

10. **Snapshot Testing** - Use for stable UI components (Remotion frames).

---

## 4. Performance Optimization

### Top 10 Practices

1. **Build Time Optimization**:
```typescript
// vite.config.ts (if using Vite alongside Next)
export default defineConfig({
  build: { sourcemap: false },
  optimizeDeps: { include: ['react', 'react-dom'] }
})
```

2. **Code Splitting**:
```typescript
const PremiumFeatures = dynamic(() => import('./PremiumFeatures'), {
  ssr: false,
  loading: () => <Spin />
})
```

3. **Bundle Size Target** - Keep initial JS < 200KB gzipped.

4. **Image Optimization**:
```typescript
import Image from 'next/image'
<Image src={poster} width={1920} height={1080} priority alt="Thumbnail" />
```

5. **LCP Optimization**:
- Use `priority` prop for above-the-fold images
- Preload critical fonts: `<link rel="preload" as="font">`
- Use WebP/AVIF formats
- Implement viewport lbs for lazy loading

6. **Font Optimization**:
```typescript
import { Inter } from 'next/font/google'
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
```

7. **Request Batching** - Use SWR or React Query for data caching.

8. **Remotion Rendering** - Render off-thread, use `AudioAnalyzer` component for audio processing.

9. **Bundle Analysis**:
```bash
next build --analyz
```

10. **Monitoring** - Use Vercel Analytics, Sentry for error tracking.

---

## 5. Security Headers, CSP, Rate Limiting

### Top 10 Practices

1. **Vercel Security Headers** (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=()" }
      ]
    }
  ]
}
```

2. **Content Security Policy**:
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [{
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://polar.sh https://supabase.co;"
    }]
  }]
}
```

3. **Rate Limiting** (Vercel Edge Config):
```typescript
// middleware.ts
export const config = { matcher: '/api/:path*', skip: ['/api/health'] }

export async function middleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for')
  // Implement rate limit check
}
```

4. **Authentication Headers**:
```typescript
{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
```

5. **Remove Security Headers**:
```typescript
{ "key": "X-Powered-By", "value": "Next.js" } // Remove in production
```

6. **Supabase RLS** - Enable on ALL tables:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);
```

7. **Input Validation** - Zod on all API routes.

8. **CORS Configuration**:
```json
{
  "trailingSlash": false,
  "redirects": [{ "source": "/api/:path*", "destination": "/api/:path*" }]
}
```

9. **Secret Management** - Use Vercel Environment Variables, never commit `.env`.

10. **HTTPS Enforcement** - Vercel auto-enables, verify in dashboard.

---

## 6. CI/CD Pipeline Optimization

### Top 10 Practices

1. **GitHub Actions Workflow**:
```yaml
name: CI/CD
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm test
```

2. **Caching Strategy**:
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm, .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-
```

3. **Build Job**:
```yaml
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npx next build
```

4. **Deploy to Vercel**:
```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

5. **Parallel Test Execution**:
```yaml
- run: npm test -- --workers=2
```

6. **Test Coverage Check**:
```yaml
- run: npm test -- --coverage
- run: npx -y check-tests-coverage --min=80
```

7. **PR Preview Deploy**:
```yaml
on: pull_request:
steps:
  - run: npx vercel --preview --token=${{ secrets.VERCEL_TOKEN }}
```

8. **Flaky Test Detection** - Retry failed tests once.

9. **Build Time Monitoring** - Track build duration across runs.

10. **Rollback Procedure** - Git tag + Git revert for hotfixes.

---

## 7. Code Organization & Modularization

### Top 10 Practices

1. **Feature-First Folder Structure**:
```
apps/sophia-ai-factory/src/
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   ├── billing/
│   └── video/
├── shared/
│   ├── ui/
│   ├── lib/
│   └── hooks/
└── app/
    ├── (auth)/
    ├── (dashboard)/
    └── api/
```

2. **Service Layer Pattern**:
```typescript
// features/billing/services/PolarService.ts
export class PolarService {
  async createCheckoutSession(userId: string, tier: Tier) {
    // implementation
  }
}
```

3. **Repository Pattern**:
```typescript
// features/users/repositories/UserRepository.ts
export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const { data } = await supabase.from('users').select('*').eq('id', id)
    return data?.[0] ?? null
  }
}
```

4. **Zod Schemas** in dedicated `schemas/` folder:
```
src/lib/schemas/
├── auth.ts
├── video.ts
└── billing.ts
```

5. **API Route Organization**:
```
app/api/
├── [resource]/
│   ├── route.ts        # GET/POST/PUT/DELETE
│   ├── validation.ts   # Zod schema
│   └── service.ts      # Business logic
```

6. **Error Handling**:
```typescript
// shared/lib/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) { super(message) }
}
```

7. **Custom Hooks** for component logic:
```typescript
// shared/hooks/useSupabaseAuth.ts
export function useSupabaseAuth() {
  // auth logic
}
```

8. **Configuration Management**:
```typescript
// shared/config/index.ts
export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  polarPublicKey: process.env.NEXT_PUBLIC_POLAR_PUBLISHABLE_KEY,
}
```

9. **Type exports**:
```typescript
// types/index.ts
export * from './user'
export * from './billing'
export * from './video'
```

10. **Document Architecture** - Keep `docs/architecture.md` updated.

---

## Tools Recommended

| Category | Tools |
|----------|-------|
| **Testing** | Vitest, Playwright, React Testing Library |
| **Type Safety** | TypeScript, Zod, tRPC |
| **Performance** | Next.js Image, Font Awesome, Lighthouse |
| **Security** | Vercel Security Headers, Supabase RLS, Helmet |
| **CI/CD** | GitHub Actions, Vercel |
| **Monitoring** | Sentry, Vercel Analytics, Logflare |
| **Code Quality** | ESLint, Prettier, TypeScript |

---

## Unresolved Questions

1. **Remotion + App Router** - Should video generation be in `/app/api` or separate edge function?
2. **Polar Webhook Handling** - Should webhooks be processed in API routes or separate worker?
3. **Streaming Videos** - How to implement chunked delivery with Next.js caching?
4. **Test Isolation** - How to structure tests for supabase SSR client?
5. **Monorepo Expansion** - When to split Remotion rendering to separate service?

---

## Quick Reference Checklist

```
[ ] 0 `console.log` in production
[ ] 0 `: any` types
[ ] All tables have RLS enabled
[ ] CSP headers configured
[ ] Rate limiting on API routes
[ ] Tests pass with 80%+ coverage
[ ] Build < 10s
[ ] LCP < 2.5s
[ ] Zod validation on all inputs
[ ] Error boundaries at all levels
```

---

**Report Generated:** 2026-03-08
**Next Steps:** Review with team, prioritize anti-pattern fixes, update project documentation.
