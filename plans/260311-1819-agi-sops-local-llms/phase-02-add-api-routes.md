# Phase 2: Add API Routes

**Date:** 2026-03-11
**Priority:** HIGH
**Status:** PLANNED

---

## Context

- Parent Plan: [plan.md](./plan.md)
- Dependencies: Phase 1 complete

---

## Overview

Thêm Next.js API route để proxy requests đến Ollama local.

---

## Requirements

### Functional
- POST `/api/generate` endpoint
- Accept `{ prompt: string, model?: string }`
- Return `{ response: string }`
- Support streaming (optional)

### Non-functional
- Response time < 3s
- Error handling robust

---

## Architecture

```
Client → /api/generate → Ollama (localhost:11434)
```

---

## Related Code Files

**Create:**
- `app/api/generate/route.ts`

---

## Implementation Steps

1. Create API route:
   ```typescript
   // app/api/generate/route.ts
   export async function POST(req: Request) {
     const { prompt, model = 'llama3.2:3b' } = await req.json()

     const response = await fetch('http://localhost:11434/api/generate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ model, prompt })
     })

     const data = await response.json()
     return Response.json({ response: data.response })
   }
   ```

2. Add types:
   ```typescript
   // lib/types.ts
   export interface GenerateRequest {
     prompt: string
     model?: string
   }

   export interface GenerateResponse {
     response: string
   }
   ```

---

## Todo List

- [ ] Create `app/api/generate/route.ts`
- [ ] Add TypeScript types
- [ ] Add error handling
- [ ] Test with curl
- [ ] Add rate limiting (optional)

---

## Success Criteria

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello"}'
# Returns: {"response":"Hi there!"}
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ollama not running | High | Clear error message |
| Timeout | Medium | Set timeout, retry |
| CORS issues | Low | Add CORS headers |

---

## Security Considerations

- Validate input (max length)
- Rate limit per IP
- Don't expose Ollama directly

---

## Next Steps

→ Phase 3: Create LLM Client
