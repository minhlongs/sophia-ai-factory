# Phase 3: SSE Campaign Streaming Architecture

## Status

Draft — 2026-06-27

## Overview

Add real-time Server-Sent Events streaming for campaign progress, replacing the current polling-based approach with event-driven updates. Users see live progress (script generation, voiceover, video rendering, distribution) without manual refresh.

## Architecture

```
Inngest step.run() ──► D1 campaigns table ──► GET /api/stream/campaigns/[id]
                                                       │
                                                       ▼
useCampaignStream() ◄── SSE (text/event-stream) ◄── ReadableStream
   (auto-reconnect)                                   (10s poll + heartbeat)
                                                       │
                                                       ▼
CampaignDetailModal ──► live progress/status ──► VideoPreview
```

## Layer Placement

| Component | Layer | Rationale |
|---|---|---|
| `CampaignProgressEvent` type | seed | Shared type, imported by all layers |
| `createCampaignSSEStream()` | land | SSE route handler lives in land (business workflow streaming) |
| `useCampaignStream()` hook | seed/hooks | Client primitive, importable by forest components |
| Inngest `step.sendEvent()` calls | forest/inngest/functions | Emit events from pipeline steps |
| i18n keys | messages/*.json | Bilingual VI/EN |

## Event Schema

```typescript
// seed/types/campaign-stream.ts
export type CampaignStepName =
  | 'notify-start'
  | 'generate-script'
  | 'generate-voiceover'
  | 'start-video-generation'
  | 'poll-video-status'
  | 'distribute-channels'
  | 'finalize-campaign';

export interface CampaignProgressEvent {
  type: 'progress' | 'status_change' | 'error' | 'complete' | 'heartbeat';
  campaignId: string;
  timestamp: string; // ISO 8601
  step?: CampaignStepName;
  status: CampaignStatus;
  progress: number; // 0-100
  message?: string; // Bilingual message key for UI
  messageVi?: string; // Vietnamese fallback
  messageEn?: string; // English fallback
  error?: string;
  data?: Record<string, unknown>; // step-specific (video_url, audio_url, etc.)
}
```

## Files to Create

### 1. `src/seed/types/campaign-stream.ts`

Campaign progress event types. Zero `:any`. Exported from `seed/types/index.ts`.

### 2. `src/land/analytics/campaign-sse-stream.ts`

SSE stream factory for campaign progress. Reuses patterns from `land/analytics/sse-broadcaster.ts`:
- `formatSSEMessage()` — already exists in sse-broadcaster, re-export or import
- `createCampaignSSEStream(campaignId, getProgress)` — polls D1 for campaign status at 2s interval, emits `progress` events
- Heartbeat every 15s
- Terminates on `completed` or `failed` status

```typescript
export function createCampaignSSEStream(
  campaignId: string,
  getProgress: () => Promise<CampaignProgressEvent>,
  intervalMs?: number,
): ReadableStream<Uint8Array>;
```

### 3. `src/app/api/stream/campaigns/[id]/route.ts`

SSE endpoint at `/api/stream/campaigns/[id]`.

```typescript
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response>
```

Flow:
1. Auth: `getCurrentUser()` — 401 if missing
2. Ownership: verify `campaigns.user_id === user.id` — 403 if mismatch
3. Create stream via `createCampaignSSEStream(params.id, fetchCampaignProgress)`
4. Return `new Response(stream, { headers: SSE_HEADERS })`

SSE headers (same pattern as analytics):
```typescript
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;
```

### 4. `src/seed/hooks/use-campaign-stream.ts`

React hook for SSE connection with auto-reconnect.

```typescript
export interface CampaignStreamState {
  status: CampaignStatus;
  progress: number;
  message: string | null;
  error: string | null;
  isConnected: boolean;
  isComplete: boolean;
}

export function useCampaignStream(
  campaignId: string | null,
  options?: { enabled?: boolean; locale?: string },
): CampaignStreamState
```

Behavior:
- Connects to `/api/stream/campaigns/${campaignId}` using `EventSource`
- Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
- Pause when tab hidden (`visibilitychange`)
- Cleanup on unmount
- Parse SSE `event: progress` / `event: status_change` / `event: error` / `event: complete`
- Return typed state object

### 5. `src/seed/hooks/index.ts` (update)

Add `export * from './use-campaign-stream';`

### 6. `src/forest/components/video-preview.tsx` (update)

Integrate `useCampaignStream` for live progress updates during processing states.

Current props: `videoUrl`, `thumbnailUrl`, `status`, `progress`, `errorMessage`, `campaignId`

Changes:
- When `status` is `processing_script` or `processing_video` and `campaignId` present, connect to SSE
- Override `progress` prop with live stream value when connected
- Show streaming indicator (pulsing dot) when `isConnected`
- Fall back to prop values when stream disconnects

### 7. `src/app/[locale]/dashboard/components/campaign-detail-modal.tsx` (update)

Integrate `useCampaignStream` for live progress in the modal dialog.

Changes:
- Accept optional `campaignId` prop (already has `campaign` object)
- When modal is open and campaign is processing, connect to SSE
- Replace static `progress` display with live-updating value
- Show connection status indicator
- Auto-close or update when stream emits `complete` event

### 8. `src/forest/inngest/functions/generate-campaign.ts` (update)

Add `step.sendEvent()` calls at each pipeline step to emit progress events.

Pattern (added alongside existing `updateStatus()` calls):
```typescript
await step.sendEvent('campaign.progress', {
  type: 'progress',
  campaignId,
  timestamp: new Date().toISOString(),
  step: 'generate-script',
  status: 'processing_script',
  progress: 35,
  message: 'campaign.progress.generating_script',
  data: { script_content: result },
});
```

Events to emit:
| Step | Event type | Status | Progress |
|---|---|---|---|
| `notify-start` | progress | `processing_script` | 5 |
| `generate-script` (start) | progress | `processing_script` | 10 |
| `generate-script` (done) | progress | `processing_script` | 35 |
| `generate-voiceover` (start) | progress | `processing_script` | 45 |
| `generate-voiceover` (done) | progress | `processing_script` | 60 |
| `start-video-generation` | progress | `processing_video` | 70 |
| `poll-video-status` (start) | progress | `processing_video` | 75 |
| `poll-video-status` (done) | progress | `processing_video` | 90 |
| `distribute-channels` | progress | `processing_video` | 95 |
| `finalize-campaign` | complete | `completed` | 100 |
| Error catch block | error | `failed` | 0 |

### 9. `messages/en.json` and `messages/vi.json` (update)

Add i18n keys for stream messages:

```json
{
  "campaign": {
    "stream": {
      "connected": "Live connection established",
      "reconnecting": "Reconnecting...",
      "disconnected": "Connection lost",
      "progress": {
        "generating_script": "Generating script...",
        "generating_voiceover": "Generating voiceover...",
        "rendering_video": "Rendering video...",
        "polling_status": "Checking video status...",
        "distributing": "Publishing to channels...",
        "finalizing": "Finalizing campaign..."
      }
    }
  }
}
```

Vietnamese equivalents in `vi.json`.

### 10. `src/seed/types/index.ts` (update)

Add `export * from './campaign-stream';`

## Files to Modify (Summary)

| File | Change |
|---|---|
| `src/seed/types/index.ts` | Add campaign-stream export |
| `src/seed/hooks/index.ts` | Add use-campaign-stream export |
| `src/forest/inngest/functions/generate-campaign.ts` | Add `step.sendEvent()` calls |
| `src/forest/components/video-preview.tsx` | Integrate useCampaignStream |
| `src/app/[locale]/dashboard/components/campaign-detail-modal.tsx` | Integrate useCampaignStream |
| `messages/en.json` | Add stream i18n keys |
| `messages/vi.json` | Add stream i18n keys |

## Files to Create (Summary)

| File | Layer | Purpose |
|---|---|---|
| `src/seed/types/campaign-stream.ts` | seed | Event type definitions |
| `src/app/api/stream/campaigns/[id]/route.ts` | land | SSE endpoint |
| `src/land/analytics/campaign-sse-stream.ts` | land | SSE stream factory |
| `src/seed/hooks/use-campaign-stream.ts` | seed | React hook with auto-reconnect |
| `src/seed/hooks/use-campaign-stream.test.ts` | seed | Hook tests |

## Implementation Steps

1. Create `seed/types/campaign-stream.ts` with event types
2. Update `seed/types/index.ts` barrel export
3. Create `land/analytics/campaign-sse-stream.ts` — reuse `formatSSEMessage` from existing sse-broadcaster
4. Create `app/api/stream/campaigns/[id]/route.ts` — auth + ownership + SSE
5. Create `seed/hooks/use-campaign-stream.ts` — EventSource with reconnect
6. Create `seed/hooks/use-campaign-stream.test.ts` — mock EventSource, test reconnect logic
7. Update `forest/inngest/functions/generate-campaign.ts` — add `step.sendEvent()` at each step
8. Update `forest/components/video-preview.tsx` — integrate hook
9. Update `campaign-detail-modal.tsx` — integrate hook
10. Add i18n keys to `messages/en.json` and `messages/vi.json`
11. Run `npm run type-check` and `npm test`

## Acceptance Criteria

- [ ] `npm run type-check` passes with 0 errors
- [ ] `npm test` passes (including new hook test)
- [ ] `npm run build` passes with 0 errors
- [ ] Zero `:any` types in new code
- [ ] Zero `console.*` in new code (use `logger`)
- [ ] All user-facing strings have VI + EN entries
- [ ] SSE endpoint returns `text/event-stream` with correct headers
- [ ] Hook auto-reconnects with exponential backoff
- [ ] Hook pauses on tab hidden, resumes on visible
- [ ] Inngest `step.sendEvent()` emits at each pipeline step
- [ ] CampaignDetailModal shows live progress when processing
- [ ] VideoPreview shows streaming indicator when connected

## Unresolved Questions

1. Should the SSE endpoint use `step.sendEvent()` (Inngest native) or D1 polling? Decision: **D1 polling** for the SSE endpoint — `step.sendEvent()` is for Inngest-to-Inngest communication. The SSE endpoint reads from D1 which Inngest updates via `updateCampaignStatus()`. This keeps the SSE endpoint CF Workers compatible without Inngest SDK dependency.
2. Should `campaign-sse-stream.ts` live in `land/analytics/` or a new `land/streaming/`? Decision: **`land/analytics/`** — follows existing SSE pattern, avoids new directory.
3. Should the hook use `EventSource` (native) or `fetch()` with `ReadableStream`? Decision: **`EventSource`** — simpler, auto-reconnects natively, CF Workers compatible.
