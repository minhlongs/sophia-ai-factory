# Phase 3: Create LLM Client

**Date:** 2026-03-11
**Priority:** MEDIUM
**Status:** PLANNED

---

## Context

- Parent Plan: [plan.md](./plan.md)
- Dependencies: Phase 2 complete

---

## Overview

Tạo LLM client module để các components dễ dàng gọi API.

---

## Requirements

### Functional
- `generate(prompt, options)` function
- Support streaming
- Error handling
- Timeout config

### Non-functional
- TypeScript typed
- Retry logic
- Cancelable requests

---

## Related Code Files

**Create:**
- `lib/llm-client.ts`
- `lib/llm-types.ts`

---

## Implementation Steps

1. Create types:
   ```typescript
   // lib/llm-types.ts
   export interface LLMOptions {
     model?: string
     maxTokens?: number
     temperature?: number
     stream?: boolean
   }

   export interface LLMResponse {
     text: string
     model: string
     usage: { tokens: number }
   }
   ```

2. Create client:
   ```typescript
   // lib/llm-client.ts
   export async function generate(
     prompt: string,
     options: LLMOptions = {}
   ): Promise<LLMResponse> {
     const response = await fetch('/api/generate', {
       method: 'POST',
       body: JSON.stringify({ prompt, ...options })
     })

     if (!response.ok) throw new Error('LLM request failed')
     return response.json()
   }
   ```

---

## Todo List

- [ ] Create `lib/llm-types.ts`
- [ ] Create `lib/llm-client.ts`
- [ ] Add streaming support
- [ ] Add retry logic
- [ ] Export from `lib/index.ts`

---

## Success Criteria

```typescript
// Usage example
import { generate } from '@/lib/llm-client'

const result = await generate('Hello', { model: 'llama3.2:3b' })
console.log(result.text)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Network failures | Medium | Retry with backoff |
| Long responses | Low | Stream chunks |
| Memory leaks | Medium | AbortController |

---

## Security Considerations

- Sanitize prompts (prevent injection)
- Limit response length
- Don't log sensitive data

---

## Next Steps

→ Phase 4: Build UI Components
