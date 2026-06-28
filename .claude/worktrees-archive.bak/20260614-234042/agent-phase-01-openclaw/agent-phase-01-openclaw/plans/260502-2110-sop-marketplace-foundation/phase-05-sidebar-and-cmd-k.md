# Phase 05 — Agent Sidebar + Cmd+K Palette + Chat API

## Context Links

- Plan: [./plan.md](./plan.md)
- Depends: Phases 01-04 (templates, executor, install, run APIs all available)
- Research: `plans/reports/research-260502-2110-3-critical-questions.md` (Q1 — sidebar + Cmd+K consensus)
- Research: `plans/reports/research-260502-2104-deepseek-r1-local-autonomous-coding.md` (Path B BYO local LLM)
- Existing layout: `apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx`
- Existing mission engine: `apps/sophia-ai-factory/src/lib/missions/dispatcher.ts`
- Existing BYOK creds: `apps/sophia-ai-factory/src/lib/credentials/*` (provider='local_llm' supported per research)

## Overview

- Priority: P1
- Status: completed
- Effort: 20h
- Description: Right-rail collapsible sidebar with chat to R1 (or BYO local LLM, or Claude fallback) plus "Show Work" reasoning expansion. Cmd+K command palette for power-user actions. New `/api/v1/agent-chat` endpoint that routes chat through mission engine. Wire into all dashboard pages via shared layout.

## Key Insights

- Sidebar = right-rail, ~30% width when expanded, collapsed = 48px icon strip. State persisted in `localStorage` key `sophia.sidebar.expanded`.
- Cmd+K palette = `cmdk` lib (small, ~10KB) — battle-tested by Linear/Raycast adopters.
- Chat endpoint = thin SSE-streaming wrapper over mission engine; conversation context kept client-side, no server-side conversation persistence in Phase 1 (deferred).
- LLM routing: prefer customer's `local_llm` BYO creds → Sophia cloud R1 (DeepSeek API) → Claude fallback (env `ANTHROPIC_API_KEY`).
- "Show Work" = if R1 returns `<think>...</think>` block, surface as collapsible reasoning panel above response.
- Cmd+K actions catalog: search SOPs (filter by name), search dashboard pages (static map), "Run SOP X" (calls run-now API), "Pause customer Y" (admin only — gate via role), "Show pending refunds" (admin), "Open mission #id".

## Requirements

### Functional
- F1: `<AgentSidebar/>` mounted in dashboard layout, all `[locale]/dashboard/*` pages.
- F2: Toggle button in top-right of sidebar; collapsed shows icon only.
- F3: Chat input at bottom; messages scroll above. Streaming via SSE.
- F4: "Show Work" expands per-message reasoning block.
- F5: `<CmdKPalette/>` global, opens on `Cmd+K` / `Ctrl+K`.
- F6: Palette searches: SOPs, dashboard pages, missions (last 20), admin actions (admin only).
- F7: Selecting palette item dispatches: navigate (page), trigger run-now (SOP), open mission detail, run admin action via existing endpoints.
- F8: New `POST /api/v1/agent-chat` endpoint:
  - Auth via `getCurrentUser()`.
  - Body: `{messages: [{role, content}], context?: {currentPage?, installationId?}}`.
  - Resolve LLM URL: `local_llm` cred → cloud R1 → Claude fallback.
  - Stream response as SSE.
  - Strip `<think>` blocks from main content; surface as separate `reasoning` SSE event.

### Non-Functional
- Sidebar mounted globally — no remount per route navigation (use parallel route or layout-level state).
- Bundle impact ≤80KB gz total (sidebar + cmd-k + cmdk lib).
- Vi+En labels.
- Keyboard accessible: `Cmd+K` open, `Esc` close, arrow keys navigate.

## Architecture

```
[Dashboard Layout]
  ├── <Sidebar nav (left existing)/>
  ├── <main>{children}</main>
  ├── <AgentSidebar/>       ← right rail (Phase 5 new)
  └── <CmdKPalette/>        ← global modal (Phase 5 new)

POST /api/v1/agent-chat
  ├── getCurrentUser()
  ├── resolveLlmRoute(userId)
  │     1. user_provider_credentials.provider='local_llm' → use {url, apiKey?}
  │     2. else → DeepSeek R1 cloud (env DEEPSEEK_API_KEY)
  │     3. else → Anthropic Claude (env ANTHROPIC_API_KEY)
  ├── send messages with system prompt (Vi+En aware)
  ├── stream SSE: 'reasoning' events for <think>, 'token' for content, 'done' final
  └── log usage to existing mcu_credits ledger (1 credit per chat session)
```

## Related Code Files

### Create — Components
- `apps/sophia-ai-factory/src/components/agent-sidebar/agent-sidebar.tsx` — main shell (client; ≤200 LOC, splits below)
- `apps/sophia-ai-factory/src/components/agent-sidebar/sidebar-toggle.tsx`
- `apps/sophia-ai-factory/src/components/agent-sidebar/chat-message-list.tsx`
- `apps/sophia-ai-factory/src/components/agent-sidebar/chat-input.tsx`
- `apps/sophia-ai-factory/src/components/agent-sidebar/show-work-panel.tsx`
- `apps/sophia-ai-factory/src/components/agent-sidebar/use-agent-chat.ts` — hook with SSE consumer
- `apps/sophia-ai-factory/src/components/cmd-k/cmd-k-palette.tsx` — wraps `cmdk`
- `apps/sophia-ai-factory/src/components/cmd-k/use-cmd-k-actions.ts` — hook returning action list
- `apps/sophia-ai-factory/src/components/cmd-k/cmd-k-action-types.ts` — Action interface

### Create — API + Lib
- `apps/sophia-ai-factory/src/app/api/v1/agent-chat/route.ts` — POST SSE endpoint
- `apps/sophia-ai-factory/src/lib/agent-chat/llm-router.ts` — `resolveLlmRoute(userId)` returning `{provider, baseUrl, apiKey, model}`
- `apps/sophia-ai-factory/src/lib/agent-chat/stream-formatter.ts` — split `<think>` from content, emit SSE
- `apps/sophia-ai-factory/src/lib/agent-chat/system-prompt.ts` — bilingual base prompt
- `apps/sophia-ai-factory/src/lib/agent-chat/types.ts` — ChatMessage, ChatContext, SseEvent

### Modify
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx` — mount `<AgentSidebar/>` + `<CmdKPalette/>`
- `apps/sophia-ai-factory/package.json` — add `cmdk`
- i18n messages — `agentChat.*`, `cmdK.*` keys

## Implementation Steps

1. **Add `cmdk` dependency**, verify bundle.
2. **i18n keys** Vi + En:
   ```json
   "agentChat": { "title": "Sophia Assistant", "placeholder": "Ask Sophia...", "showWork": "Show Work", "hideWork": "Hide Work", "newChat": "New chat", "collapse": "Collapse", "expand": "Expand" },
   "cmdK": { "placeholder": "Type a command or search...", "groups": { "sops": "SOPs", "pages": "Pages", "missions": "Recent missions", "admin": "Admin" }, "noResults": "No results" }
   ```
3. **types.ts**:
   ```ts
   export interface ChatMessage { role: 'user'|'assistant'|'system'; content: string; reasoning?: string; }
   export interface ChatContext { currentPage?: string; installationId?: string; }
   export type SseEvent = { type: 'token'; data: string } | { type: 'reasoning'; data: string } | { type: 'done' } | { type: 'error'; message: string };
   ```
4. **llm-router.ts** `resolveLlmRoute(userId)`:
   ```ts
   const local = await getUserCredential(userId, 'local_llm');
   if (local) return { provider: 'local', baseUrl: local.url, apiKey: local.apiKey, model: 'deepseek-r1:32b' };
   if (env.DEEPSEEK_API_KEY) return { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKey: env.DEEPSEEK_API_KEY, model: 'deepseek-reasoner' };
   if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: env.ANTHROPIC_API_KEY, model: 'claude-3-5-sonnet-20241022' };
   throw new Error('NO_LLM_CONFIGURED');
   ```
5. **stream-formatter.ts** — generator that consumes upstream stream, yields SSE events. State machine: detect `<think>` open → buffer into `reasoning` events; on `</think>` switch to `token` events. For Anthropic provider, map `thinking` content blocks to `reasoning` directly.
6. **system-prompt.ts** — builds bilingual system prompt, includes context: "User is on page {currentPage}; if they reference an SOP, prefer using runSop tool; respond in user's locale ({locale}); be concise."
7. **agent-chat API** route:
   - Validate body (Zod): `{ messages: ChatMessage[], context?: ChatContext }`.
   - Resolve route, send to provider with streaming.
   - Pipe through stream-formatter into ReadableStream of SSE-formatted text (`data: ${JSON.stringify(event)}\n\n`).
   - Return `Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`.
   - Charge 1 credit per session via existing `mcu_credits` ledger AFTER stream done (use `addEventListener('close')` pattern or finally block).
8. **`use-agent-chat.ts` hook** — `EventSource` not allowed for POST; use `fetch` + `getReader()` to consume body stream manually. State: messages + sending + error.
9. **AgentSidebar** — composes toggle + ChatMessageList + ChatInput. Persists expanded state to localStorage.
10. **CmdKPalette** — wraps `cmdk` Command component. Action sources via `use-cmd-k-actions`:
    - Pages: static array of dashboard routes with labels.
    - SOPs: fetch user's installations on open (cached 30s) → "Run [name]" actions.
    - Missions: last 20 via existing missions API.
    - Admin: only if `user.role === 'admin'` — "Pause customer", "Show pending refunds", "Open ops dashboard".
11. **Wire layout**:
    ```tsx
    // layout.tsx
    <DashboardShell>
      {children}
      <AgentSidebar/>
      <CmdKPalette/>
    </DashboardShell>
    ```
12. **Tests**:
    - `llm-router.test.ts` — priority order (local > deepseek > anthropic), throw if none.
    - `stream-formatter.test.ts` — `<think>` splitting cases (incl multi-line, partial chunks).
    - `agent-chat-route.test.ts` — auth, validation, mock provider, assert SSE event sequence.
    - `use-cmd-k-actions.test.ts` — action source merging, role gating.
    - Component: `AgentSidebar` open/close persistence, message render with reasoning panel.
    - E2E: open dashboard → press Cmd+K → search SOP → run-now triggers run row.

## Todo List

- [x] Install `cmdk`
- [x] i18n keys (Vi + En) for chat + palette
- [x] types.ts (ChatMessage, ChatContext, SseEvent)
- [x] llm-router.ts + test
- [x] system-prompt.ts (bilingual)
- [x] stream-formatter.ts + test (think-block splitting)
- [x] /api/v1/agent-chat route + test (SSE)
- [x] use-agent-chat.ts hook
- [x] AgentSidebar shell + 4 sub-components (≤200 LOC each)
- [x] sidebar-toggle.tsx (with localStorage persistence)
- [x] show-work-panel.tsx (collapsible reasoning)
- [x] cmd-k-action-types.ts + use-cmd-k-actions.ts
- [x] CmdKPalette wrapper component
- [x] Wire into [locale]/dashboard/layout.tsx
- [ ] Verify all dashboard pages render with sidebar without layout shift
- [ ] Bundle size check (target ≤80KB gz added)
- [x] Credit charge on chat session end
- [ ] Component tests + E2E (Playwright if present)

## Success Criteria

- Sidebar appears on every `/dashboard/*` page, toggleable, state persists across navigations.
- Chat sends → streaming response within ≤2s first token (cloud) or ≤5s (local).
- `<think>` blocks captured into "Show Work" panel; main content does not contain raw think tags.
- `Cmd+K` opens palette in ≤100ms; results filter as user types; Esc closes.
- Selecting "Run [SOP name]" from palette triggers run-now API and shows toast with link to run detail.
- Admin user sees admin actions in palette; non-admin does not.
- Credit ledger increments by 1 per completed chat session.
- New tests pass; existing 2292 still pass.
- Build clean, typecheck clean, no `:any`, no `console.log`.

## Risk Assessment

- R1: SSE on Cloudflare Workers — supported but has quirks. Mitigation: use `ReadableStream` directly + `TransformStream` polyfill if needed; reference existing missions SSE route in repo.
- R2: Streaming `fetch` body in browsers without `getReader` (rare). Mitigation: feature-detect; fall back to non-streaming JSON response (collected) for old browsers.
- R3: `<think>` block detection across chunk boundaries (chunk splits mid-tag). Mitigation: stream-formatter buffers up to N=64 chars looking for tag boundary before emitting.
- R4: Cmd+K conflicts with browser shortcuts on some browsers. Mitigation: use `cmdk` library which handles cross-browser quirks; allow `Cmd+/` as secondary trigger.
- R5: Local LLM down → mid-stream error. Mitigation: catch upstream error, emit SSE `{type:'error'}`, do NOT charge credit.
- R6: Cost — chat tokens not metered like missions. Phase 1: charge flat 1 credit per chat session. Phase 2: token-based metering.

## Security Considerations

- `/api/v1/agent-chat` requires auth.
- Local LLM creds decrypted only in-memory per request.
- System prompt does NOT leak other users' data; context is per-user only.
- Admin actions in Cmd+K verify `user.role === 'admin'` server-side (palette UI hides them client-side, but every admin action endpoint already enforces).
- Chat messages NOT persisted server-side in Phase 1 (privacy + simplicity); user warned via small "session-only" notice.
- Rate limit `/api/v1/agent-chat` per user (existing pattern).

## Next Steps

- Phase 2 of full roadmap: Tauri menu-bar app reuses same chat endpoint via local-token auth.
- Future: chat history persistence + multi-conversation tabs.
- Future: tool-calling — let chat agent dispatch missions directly (not just suggest).

## Open Questions

- Where does sidebar sit relative to existing right-side panels (e.g., toasts)? Verify no visual collision.
- Show-Work panel — collapsed by default or expanded? Default: collapsed (cleaner UX). Confirm with CEO.
- Should `Cmd+K` be discoverable? Add hint in sidebar header `"⌘K to search"`. Yes.
- Conversation persistence — confirm "session-only" Phase 1 acceptable for CEO. If not, add `chat_sessions` table — extra migration in Phase 04.5.
- Local LLM auto-detect — should Sophia ping `localhost:11434/v1/models` from setup-wizard to pre-fill? Likely yes — small UX win, defer if scope creep.
