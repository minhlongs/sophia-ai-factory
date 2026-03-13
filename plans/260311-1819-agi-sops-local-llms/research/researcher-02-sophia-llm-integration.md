# Research: Sophia LLM Integration Points

**Date:** 2026-03-11
**Researcher:** Main Agent

---

## Current State

**Sophia Proposal** là static landing page:
- Next.js 16 + React 19
- Static Site Generation (SSG)
- Không có backend API
- Không có LLM integration

---

## Required Changes for Local LLMs

### 1. Add API Layer
```
app/
├── api/
│   └── generate/
│       └── route.ts    # Edge Function
```

### 2. Environment Config
```bash
# .env.local
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama-3.2-3b
LLM_API_KEY=ollama
```

### 3. LLM Client Module
```typescript
// lib/llm-client.ts
export async function generate(prompt: string) {
  const response = await fetch(process.env.LLM_BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ prompt })
  })
  return response.json()
}
```

---

## Implementation Phases

| Phase | Task | Complexity |
|-------|------|------------|
| 1 | Setup Ollama local | LOW |
| 2 | Add API routes | MEDIUM |
| 3 | Create LLM client | MEDIUM |
| 4 | Build UI components | HIGH |
| 5 | Write SOPs docs | LOW |

---

## Files to Create

1. `app/api/generate/route.ts`
2. `lib/llm-client.ts`
3. `.env.example`
4. `docs/agi-sops.md`
5. `docs/local-llm-setup.md`

---

## Unresolved Questions

1. Use Edge Functions or serverless?
2. Support multiple models?
3. Streaming responses?
