---
phase: 4
title: "RaaS SDK + API Docs"
priority: P2
status: pending
effort: 4h
---

# Phase 4 — RaaS SDK + API Docs

## Context Links
- [RaaS API Endpoints](../../docs/system-architecture.md) — Section 7
- [API Key Manager](../../lib/raas/api-key-manager.ts)
- [Rate Limiter](../../lib/raas/rate-limiter.ts)

## Overview

Create `@sophia/raas-sdk` npm package for external API consumers. Add OpenAPI spec and `/docs/api` page for interactive docs.

## Key Insights

- External API uses Bearer token auth (sk_live_ prefix)
- 8 endpoints: 5 external (`/api/v1/`) + management endpoints
- Rate limiting: sliding window per API key
- Webhook delivery with HMAC-SHA256 signing
- SDK should be thin wrapper — fetch-based, zero deps, tree-shakeable

## Requirements

### Functional
- SDK: TypeScript package with typed methods for all `/api/v1/` endpoints
- SDK: Auto-handles Bearer auth, rate limit headers, error parsing
- OpenAPI 3.1 spec covering all public endpoints
- `/docs/api` page with interactive API explorer (Scalar or similar)

### Non-functional
- SDK bundle < 10KB minified
- Zero runtime dependencies
- Works in Node.js, Deno, Bun, browser

## Architecture

```
@sophia/raas-sdk (npm package)
├── src/
│   ├── client.ts          — SophiaClient class
│   ├── missions.ts        — missions.create(), missions.get(), missions.list()
│   ├── types.ts           — Mission, MissionResult, etc.
│   └── index.ts           — barrel export
├── package.json
├── tsconfig.json
└── README.md

/docs/api (Next.js page)
├── openapi.yaml           — OpenAPI 3.1 spec
└── page.tsx               — Scalar API reference component
```

## Related Code Files

### Files to create
- `packages/raas-sdk/src/client.ts` — main SDK client
- `packages/raas-sdk/src/missions.ts` — mission operations
- `packages/raas-sdk/src/types.ts` — shared types
- `packages/raas-sdk/src/index.ts` — barrel
- `packages/raas-sdk/package.json`
- `packages/raas-sdk/tsconfig.json`
- `packages/raas-sdk/README.md`
- `public/openapi.yaml` — OpenAPI 3.1 spec
- `app/docs/api/page.tsx` — API docs page

## Implementation Steps

1. Create `packages/raas-sdk/` directory structure
2. Define types matching `types/raas.ts` (Mission, MissionResult, etc.)
3. Implement `SophiaClient`:
   ```typescript
   const sophia = new SophiaClient({ apiKey: 'sk_live_...' });
   const mission = await sophia.missions.create({
     command: 'sales:battlecard',
     params: { competitor: 'Acme' },
   });
   const result = await sophia.missions.waitForResult(mission.id);
   ```
4. Add convenience methods: `waitForResult()` (polling), `cancel()`, `list()`
5. Write OpenAPI 3.1 spec (`public/openapi.yaml`)
6. Create `/docs/api` page using Scalar or Redoc for rendering
7. Write SDK tests
8. Configure `package.json` with proper exports map

## Todo List

- [ ] Create SDK directory structure
- [ ] Implement SophiaClient + missions module
- [ ] Export types
- [ ] Write OpenAPI 3.1 spec
- [ ] Create /docs/api page
- [ ] Write SDK unit tests
- [ ] Test SDK against local API

## Success Criteria

- `npm pack` produces valid `@sophia/raas-sdk` tarball
- SDK types match API response shapes
- OpenAPI spec validates via `swagger-cli validate`
- `/docs/api` page renders interactive docs
- SDK tests pass

## Risk Assessment

- **API shape changes** — SDK types must stay in sync with server types
- **Scalar/Redoc bundle size** — use CDN script tag, not npm import
