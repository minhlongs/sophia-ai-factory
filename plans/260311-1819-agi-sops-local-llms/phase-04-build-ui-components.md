# Phase 4: Build UI Components

**Date:** 2026-03-11
**Priority:** MEDIUM
**Status:** PLANNED

---

## Context

- Parent Plan: [plan.md](./plan.md)
- Dependencies: Phase 3 complete

---

## Overview

Xây dựng UI components cho user tương tác với local LLM.

---

## Requirements

### Functional
- Chat input component
- Response display component
- Loading states
- Error states

### Non-functional
- Responsive design
- Accessible (WCAG)
- Animated (Framer Motion)

---

## Architecture

```
<LLMChat>
  ├─ <ChatInput />
  ├─ <ChatMessages>
  │   └─ <ChatMessage /> x N
  └─ <ChatStatus />
```

---

## Related Code Files

**Create:**
- `app/components/LLMChat.tsx`
- `app/components/ChatInput.tsx`
- `app/components/ChatMessages.tsx`
- `app/components/ChatMessage.tsx`

---

## Implementation Steps

1. Create base chat component:
   ```tsx
   // app/components/LLMChat.tsx
   'use client'

   export function LLMChat() {
     const [messages, setMessages] = useState([])
     const [loading, setLoading] = useState(false)

     const send = async (prompt: string) => {
       setLoading(true)
       const response = await generate(prompt)
       setMessages([...messages, { role: 'user', content: prompt }, response])
       setLoading(false)
     }

     return (
       <div>
         <ChatMessages messages={messages} />
         <ChatInput onSend={send} disabled={loading} />
       </div>
     )
   }
   ```

2. Add to page:
   ```tsx
   // app/page.tsx
   import { LLMChat } from './components/LLMChat'

   export default function Page() {
     return <LLMChat />
   }
   ```

---

## Todo List

- [ ] Create `LLMChat.tsx`
- [ ] Create `ChatInput.tsx`
- [ ] Create `ChatMessages.tsx`
- [ ] Add loading animations
- [ ] Add error boundaries

---

## Success Criteria

- User can type and send messages
- Responses display correctly
- Loading state shows during generation
- Errors display gracefully

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slow responses | Medium | Show progress indicator |
| Long text overflow | Low | Word wrap, scroll |
| Mobile keyboard | Medium | Adjust viewport |

---

## Security Considerations

- Sanitize user input (XSS prevention)
- Rate limit submissions
- Don't store sensitive prompts

---

## Next Steps

→ Phase 5: Write SOPs Docs
