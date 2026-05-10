# Phase 06 — Sentry Wiring + Error Boundaries + 404 (M3 + M7)

## Context Links

- Plan overview: `./plan.md`
- Existing Sentry config: `sentry.server.config.ts`, `sentry.client.config.ts` (verify presence)
- Next.js error boundary docs: `app/[locale]/dashboard/error.tsx`, `app/[locale]/dashboard/not-found.tsx`

## Overview

- **Priority:** P1
- **Effort:** 0.5d
- **Status:** pending
- **Description:** Sentry config files exist but the `dashboard/error.tsx` boundary is not calling `Sentry.captureException`. Errors are swallowed by Next.js default page. Also no `not-found.tsx` at `/dashboard` root → bad URL crashes. Wire both.

## Key Insights

- Next.js 16 App Router calls `error.tsx` on any rendering error in the segment subtree. We must explicitly call `Sentry.captureException(error)` inside the client component's `useEffect`.
- `Sentry.captureUnderscoreErrorException` from `@sentry/nextjs` is provided for this exact use case as of Next 13+.
- `not-found.tsx` matches when nothing else does AND when `notFound()` is called.
- Both files must be Client Components (`'use client'`) to use hooks.

## Requirements

### Functional
- F1. `dashboard/error.tsx` MUST call `Sentry.captureException(error)` on mount with `error.digest` attached as a tag.
- F2. `dashboard/error.tsx` MUST render translated copy ("Something went wrong" + Retry button) — pulls from `dashboard.errorBoundary.*` keys.
- F3. New `dashboard/not-found.tsx` rendering translated 404 with link back to `/dashboard`.
- F4. Sentry DSN MUST be active in production (verify env var `SENTRY_DSN` set in wrangler vars).

### Non-Functional
- NF1. Each file <100 LOC.
- NF2. EN + VI keys for `dashboard.errorBoundary.title/description/retry` and `dashboard.notFound.title/description/back`.
- NF3. No `:any`.

## Architecture

```
src/app/[locale]/dashboard/error.tsx        (UPDATE — wire Sentry)
src/app/[locale]/dashboard/not-found.tsx    (NEW — translated 404)
src/messages/en.json + vi.json              (add errorBoundary + notFound keys)

Optional: src/app/global-error.tsx          (catch-all top-level — only if missing)
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/error.tsx`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/messages/en.json`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/messages/vi.json`

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/not-found.tsx`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/__tests__/error.test.tsx` (lightweight render + Sentry mock assert)

### Delete
None.

## Implementation Steps

1. Verify `sentry.client.config.ts` exists and has `Sentry.init({ dsn: ... })`. If missing → set up minimal init (defer to Phase 07 if it requires Sentry account work).
2. Read current `dashboard/error.tsx`. If it's the Next.js default scaffold, replace body:
   ```tsx
   'use client';
   import * as Sentry from '@sentry/nextjs';
   import { useEffect } from 'react';
   import { useTranslations } from 'next-intl';

   export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
     const t = useTranslations('dashboard.errorBoundary');
     useEffect(() => { Sentry.captureException(error, { tags: { digest: error.digest } }); }, [error]);
     return (
       <div className="p-8 text-center">
         <h2 className="text-xl font-semibold">{t('title')}</h2>
         <p className="mt-2 text-muted-foreground">{t('description')}</p>
         <button onClick={reset} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded">
           {t('retry')}
         </button>
       </div>
     );
   }
   ```
3. Create `dashboard/not-found.tsx`:
   - Server component
   - Translated 404 + link to `/dashboard`.
4. Add EN + VI keys.
5. Test: render error.tsx in vitest with mocked Sentry, assert `captureException` called once with the error.
6. `npm run build` + `npm test`.
7. Manual smoke: visit `/dashboard/garbage-route` → 404 page (not crash); throw inside a dashboard page (temporarily) → error.tsx renders + Sentry event in dashboard.

## Todo List

- [ ] Verify Sentry config files present + DSN set
- [ ] Wire `Sentry.captureException` in `dashboard/error.tsx`
- [ ] Add translated error boundary copy
- [ ] Create `dashboard/not-found.tsx`
- [ ] Add EN + VI keys
- [ ] Test: error.tsx Sentry mock assertion
- [ ] `npm run build` + `npm test`
- [ ] Code review pass
- [ ] `npm run deploy:full` + SHA verify
- [ ] Manual: visit /dashboard/xxxx → 404 OK
- [ ] Manual: trigger temp throw → Sentry event lands in dashboard

## Success Criteria

- [ ] Error in dashboard subtree → user sees translated banner with Retry, Sentry event captured.
- [ ] Bad URL `/dashboard/<garbage>` shows 404 page, not 500/crash.
- [ ] Sentry dashboard shows new event from production within 1 min of triggering.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `SENTRY_DSN` env var not set in wrangler.toml | M | M | Run `npx wrangler secret list` to verify; add via `npx wrangler secret put SENTRY_DSN` if missing. |
| `useTranslations` SSR/CSR boundary issue in error.tsx (must be client) | L | L | `error.tsx` is REQUIRED client component by Next.js — already 'use client'. |
| Sentry capture creates infinite loop if Sentry init itself errors | L | M | Wrap captureException in try/catch silently. |
| `not-found.tsx` shadows existing route conflict | L | L | Place under `[locale]/dashboard/` only — not at app root. |

## Security Considerations

- DO NOT include `error.message` in the rendered UI (might leak internal data). Show generic copy; full error goes to Sentry only.
- `Sentry.captureException` already strips PII headers; verify integration includes `denyUrls` for any localhost dev.

## Next Steps

- Phase 07 may add Sentry release tracking (deploy SHA → release tag) for source-map symbolication. Out of scope here.
