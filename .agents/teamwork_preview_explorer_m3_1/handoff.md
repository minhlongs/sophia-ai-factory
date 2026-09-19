# Milestone 3 Investigation & Blueprint Plan: Real Creative Studio UI Execution & Live Track Polling

**Agent**: `teamwork_preview_explorer_m3_1`  
**Date**: 2026-09-19T10:44:00Z  
**Type**: Hard Handoff (Investigation Complete & Implementation Plan Ready)  
**Parent**: `888683f7-30ce-42ff-840e-2e0b8eaaa575`  
**Working Directory**: `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_1/`  

---

## 1. Observation

Direct observations and evidence across Creative Studio UI, Server Actions, Multi-Track Orchestrator, and Localization files:

### 1.1 `FirstRunWizard` Current Implementation (`apps/sophia-ai-factory/src/components/missions/first-run-wizard.tsx`)
- **Fake `setTimeout` Stage Progression** (Lines 83–90):
  ```typescript
  // Advance through stages for live feedback
  setTimeout(() => setCurrentStage('VOICE_SYNTHESIS'), 1200);
  setTimeout(() => setCurrentStage('VISUAL_GENERATION'), 2400);
  setTimeout(() => setCurrentStage('VIDEO_COMPOSITING'), 3600);
  setTimeout(() => {
    setCurrentStage('READY_FOR_REVIEW');
    setStatus('completed');
  }, 4800);
  ```
  The UI blindly transitions every 1200ms regardless of actual backend execution status, completing after 4.8 seconds even if the mission takes 60 seconds or fails on the first provider call.
- **Missing Template Parameter Constraints in `createMission`** (Lines 51–65):
  `createMission` is passed `constraints: {}` (Line 63), omitting `estimatedScenes`, `durationSeconds`, `aspectRatio`, `voiceStyle`, and `visualStyle` from `selectedTemplate`. While `multi-track-orchestrator.ts` attempts to read these from `mission.constraints`, they currently default to fallbacks (3 scenes, 30s, 9:16).
- **Mock Agent ID in `startMissionExecution`** (Lines 77–81):
  ```typescript
  await startMissionExecution({
    missionId: newId,
    agentId: 'agent_director',
    autonomyLevel: 1,
  });
  ```
  `'agent_director'` is not registered in `agentDefinitionRegistry` (`apps/sophia-ai-factory/src/tree/agent-protocol/agent-registry.ts`). If consumed by Inngest's `agentMissionExecutor`, it throws `Agent agent_director not registered`.
- **No Polling Infrastructure or Cleanup**:
  `first-run-wizard.tsx` lacks any interval or timeout tracking references (`useRef`), leading to memory leaks and uncaught state updates if unmounted while execution is active.
- **Hardcoded Bilingual Strings**:
  Uses inline `isVi ? '...' : '...'` ternaries for the CEO 5-question guide (Lines 100–108), completion banner (Lines 116–124), form labels (Lines 133–148), and error messages (Line 93), rather than `useTranslations()` from `next-intl`.

### 1.2 `MissionProgressBar` Component (`apps/sophia-ai-factory/src/components/missions/mission-progress-bar.tsx`)
- **Stage Definitions & Percentages** (Lines 30–76):
  - Stage 1: `SCRIPT_GENERATION` (20%) — Step 1
  - Stage 2: `VOICE_SYNTHESIS` (40%) — Step 2
  - Stage 3: `VISUAL_GENERATION` (65%) — Step 3
  - Stage 4: `VIDEO_COMPOSITING` (90%) — Step 4
  - Stage 5: `READY_FOR_REVIEW` (100%) — Step 5
- **Visual State Management** (Lines 133–171):
  - Completed steps render `CheckCircle2` with primary background.
  - Active running step renders spinning `Loader2`.
  - Failed step renders red `AlertCircle` with `bg-destructive/10`.
  - Error banner (Lines 174–198) renders with `onRetry` callback button.
- **Props** (Lines 78–85):
  `currentStage: MissionStageId`, `status: 'idle' | 'running' | 'completed' | 'failed'`, `errorMessage?: string`, `onRetry?: () => void`, `locale?: 'vi' | 'en'`, `customPercent?: number`.

### 1.3 Server Actions (`apps/sophia-ai-factory/src/land/creative-mission/actions.ts`)
- **`getMissionTrackStatus`** (Lines 553–620):
  - Accepts `input: string | { missionId: string }`.
  - Validates authentication (`getCurrentUser`) and workspace membership (`verifyWorkspaceAccess`).
  - Reads mission `status`, `current_phase`, and `constraints` from D1.
  - Delegates to `forest/mission/multi-track-orchestrator.getMissionTrackStatus`.
  - Returns `Result<{ missionId: string; status: string; currentPhase: string; trackStatus: MissionTrackStatus }, MissionError>`.
- **`executeMultiTrackMissionAction`** (Lines 641–750):
  - Zod-validated schema: `{ missionId, topic?, estimatedScenes?, durationSeconds?, aspectRatio?, estimatedCostCents?, requiredCapabilities? }`.
  - Enforces workspace IDOR protection, role authorization (creator or workspace ADMIN), and start state check (`canStartExecution`).
  - Executes fail-closed 7-gate preflight check (`runMissionPreflightCheck`) verifying `['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO']`, MCU balance, and circuit breaker health.
  - Delegates directly to `forest/mission/multi-track-orchestrator.executeMultiTrackMission`.
- **`startMissionExecution`** (Lines 453–541):
  - Flips status to `'running'` in D1 via `beginMissionExecution(missionId)`.
  - Emits Inngest event `agent.mission.started`.
  - Fires `executeMultiTrackMission` asynchronously without awaiting.

### 1.4 Orchestrator Pipeline Lifecycle (`apps/sophia-ai-factory/src/forest/mission/multi-track-orchestrator.ts`)
- **Track Status Model** (Lines 47–55):
  `trackStatus: { script: SingleTrackState; audio: SingleTrackState; visual: SingleTrackState; video: SingleTrackState }` where `SingleTrackState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'`.
- **Checkpoint Sequence**:
  1. `saveCheckpoint(missionId, trackStatus, 'executing')` (`script: pending`, `audio: pending`, `visual: pending`, `video: pending`)
  2. `saveCheckpoint(missionId, trackStatus, 'script_generation')` (`script: running`)
  3. `saveCheckpoint(missionId, trackStatus, 'script_completed')` (`script: completed`)
  4. `saveCheckpoint(missionId, trackStatus, 'voice_and_visuals')` (`audio: running`, `visual: running` — executed via `Promise.allSettled` with mutual abort)
  5. `saveCheckpoint(missionId, trackStatus, 'voice_and_visuals')` (`audio: completed`, `visual: completed`)
  6. `saveCheckpoint(missionId, trackStatus, 'video_compositing')` (`video: running`)
  7. `saveCheckpoint(missionId, trackStatus, 'composited')` (`video: completed`)
  8. Final CAS transition: `running` → `review` (`current_phase: 'review'`).
- **Failure Behavior** (Lines 1064–1093):
  Failing tracks are marked `'failed'`; sibling aborted tracks are marked `'cancelled'`; terminal transition flips D1 status to `'failed'` (or `'cancelled'`) and clears cache.

---

## 2. Logic Chain

### 2.1 Action Selection & Concurrency Conflict Avoidance
- *Observation*: `executeMultiTrackMissionAction` checks `canStartExecution(mission.status)`. Legal start states are `['draft', 'planned', 'approval_required', 'paused']`. If `startMissionExecution` is called first, it calls `beginMissionExecution(missionId)` which immediately flips status to `'running'`.
- *Deduction*: Calling `startMissionExecution` AND THEN calling `executeMultiTrackMissionAction` on the same mission will fail with `EXECUTION_START_INVALID` (`Mission status 'running' cannot start execution`).
- *Solution*: For Creative Studio video generation, the client should call `createMission` (which creates in `'draft'`) and then invoke `executeMultiTrackMissionAction` directly.
- *Advantage of `executeMultiTrackMissionAction`*:
  1. Executes the fail-closed 7-gate preflight check for all 4 required capabilities (`AI_TEXT`, `AI_AUDIO`, `AI_IMAGE`, `AI_VIDEO`).
  2. Passes template parameters directly into the orchestrator (`topic`, `estimatedScenes`, `durationSeconds`, `aspectRatio`).
  3. Returns the rich `MultiTrackExecutionResult` on completion, allowing immediate inspection of asset keys.

### 2.2 Live Polling Architecture & Edge Resilience
- *Observation*: Next.js server actions in Cloudflare Workers environment run as HTTP POST requests. If the client awaits `executeMultiTrackMissionAction`, the HTTP connection remains open for 30–90 seconds while the pipeline executes. Meanwhile, the client needs live visual progress updates across the 5 stages.
- *Solution*:
  1. Client initiates `executeMultiTrackMissionAction(...)` as an active asynchronous promise (`actionPromise`).
  2. Concurrently, client starts a polling loop that queries `getMissionTrackStatus(missionId)` every 1500ms (1.5 seconds).
  3. Instead of `setInterval` (which can stack concurrent HTTP requests if a poll takes >1.5s), use a recursive `setTimeout` loop managed with `useRef`:
     - Fetch `getMissionTrackStatus`.
     - Update stage and progress bar.
     - If still `running`, schedule next poll after 1500ms.
     - If terminal status (`review`, `completed`, `failed`), halt polling.
  4. Cleanup: `useEffect` returns a cleanup function that cancels any pending timeout and sets an `isMountedRef` flag to false.
  5. Timeout Fail-Safe: A maximum polling duration (180 seconds / 120 iterations) halts the loop if external providers hang indefinitely.

### 2.3 Deterministic Track-to-Stage Mapping
- *Observation*: Audio (Track 2) and Visual (Track 3) execute in parallel in the backend, while `MissionProgressBar` displays sequential linear stages: `SCRIPT_GENERATION` → `VOICE_SYNTHESIS` → `VISUAL_GENERATION` → `VIDEO_COMPOSITING` → `READY_FOR_REVIEW`.
- *Mapping Logic*:
  ```
  Backend State                         -> UI Stage            UI Status     Percent
  ----------------------------------------------------------------------------------
  status == 'review' | 'completed'      -> READY_FOR_REVIEW    completed     100%
  status == 'failed' | 'cancelled'      -> [failing track]     failed        failed
  trackStatus.video == 'running'        -> VIDEO_COMPOSITING   running       90%
  audio == 'completed' & visual == 'completed' -> VIDEO_COMPOSITING running  90%
  audio == 'completed' & visual != 'completed' -> VISUAL_GENERATION running  65%
  script == 'completed'                 -> VOICE_SYNTHESIS     running       40%
  script == 'running' | pending         -> SCRIPT_GENERATION   running       20%
  ```
- *Rationale*: Voiceover generation is typically faster (2–5 seconds via ElevenLabs) than image generation (10–25 seconds for 3–5 scenes via fal.ai/Replicate). Mapping `script: completed` first to `VOICE_SYNTHESIS` and advancing to `VISUAL_GENERATION` as soon as audio completes provides natural forward momentum.

### 2.4 Idempotent Error Recovery & Safe Retry
- *Observation*: Once a mission transitions to `failed`, it cannot be restarted via `canStartExecution` unless reset to `draft`.
- *Solution*: When `onRetry` is triggered from `MissionProgressBar`, `handleLaunch` creates a fresh mission with `createMission`, resetting state cleanly and avoiding dirty state collisions.

---

## 3. Caveats

- **Network Gateway Timeouts on Synchronous Server Actions**: In certain reverse-proxy configurations, a single HTTP request open for >60s may receive an HTTP 504. The polling mechanism gracefully decouples the UI from the action promise: even if the primary action promise times out at the HTTP gateway, the polling loop continues tracking the backend D1 status until completion.
- **Inngest Agent Registry Separation**: `startMissionExecution` uses Inngest event dispatch meant for autonomous multi-agent graphs (`agent-mission-executor.ts`), while `executeMultiTrackMissionAction` executes the multi-track pipeline directly. They should not be conflated or called simultaneously.

---

## 4. Conclusion & Implementation Plan

### 4.1 Plan Overview
Transition `FirstRunWizard` from fake `setTimeout` timers to real multi-track execution and live `getMissionTrackStatus` polling by:
1. Updating `FirstRunWizard` to launch `executeMultiTrackMissionAction` and recursively poll `getMissionTrackStatus(missionId)` every 1.5s.
2. Mapping real track states (`script`, `audio`, `visual`, `video`) and `current_phase` to UI stages.
3. Adding memory-safe timer cleanup (`useRef` + `isMountedRef`) and 180s timeout protection.
4. Adding bilingual translation keys in `messages/en.json` and `messages/vi.json` to eliminate hardcoded ternaries.
5. Writing unit tests in `src/components/missions/__tests__/first-run-wizard.test.tsx` and `mission-progress-bar.test.tsx`.

### 4.2 Detailed Code Blueprint for `first-run-wizard.tsx`

```tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Clock, Coins, CheckCircle2, ArrowRight, Video } from 'lucide-react';
import { Link } from '@/navigation';
import { getFirstRunTemplates, type FirstRunTemplate } from '@/land/missions/first-run-template';
import { estimateTemplateCost } from '@/land/missions/cost-estimator';
import { MissionProgressBar, type MissionStageId } from './mission-progress-bar';
import {
  createMission,
  executeMultiTrackMissionAction,
  getMissionTrackStatus,
} from '@/land/creative-mission/actions';
import type { MissionTrackStatus } from '@/forest/mission/multi-track-orchestrator';

export interface FirstRunWizardProps {
  workspaceId: string;
  userId: string;
  locale?: 'vi' | 'en';
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_TIMEOUT_MS = 180_000; // 3 minutes max

export function mapTrackStatusToStage(
  status: string,
  currentPhase: string,
  trackStatus?: MissionTrackStatus,
): { stage: MissionStageId; uiStatus: 'running' | 'completed' | 'failed'; failedTrack?: string } {
  if (status === 'review' || status === 'completed' || currentPhase === 'review') {
    return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
  }

  if (status === 'failed' || status === 'cancelled') {
    if (trackStatus?.video === 'failed') return { stage: 'VIDEO_COMPOSITING', uiStatus: 'failed', failedTrack: 'video' };
    if (trackStatus?.visual === 'failed') return { stage: 'VISUAL_GENERATION', uiStatus: 'failed', failedTrack: 'visual' };
    if (trackStatus?.audio === 'failed') return { stage: 'VOICE_SYNTHESIS', uiStatus: 'failed', failedTrack: 'audio' };
    if (trackStatus?.script === 'failed') return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed', failedTrack: 'script' };
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed' };
  }

  if (trackStatus) {
    if (trackStatus.video === 'completed') {
      return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
    }
    if (trackStatus.video === 'running' || currentPhase === 'video_compositing' || currentPhase === 'composited') {
      return { stage: 'VIDEO_COMPOSITING', uiStatus: 'running' };
    }
    if (trackStatus.audio === 'completed' && trackStatus.visual === 'completed') {
      return { stage: 'VIDEO_COMPOSITING', uiStatus: 'running' };
    }
    if (trackStatus.audio === 'completed' && trackStatus.visual === 'running') {
      return { stage: 'VISUAL_GENERATION', uiStatus: 'running' };
    }
    if (trackStatus.script === 'completed') {
      return { stage: 'VOICE_SYNTHESIS', uiStatus: 'running' };
    }
    if (trackStatus.script === 'running' || currentPhase === 'script_generation') {
      return { stage: 'SCRIPT_GENERATION', uiStatus: 'running' };
    }
  }

  if (currentPhase === 'video_compositing' || currentPhase === 'composited') {
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'running' };
  }
  if (currentPhase === 'voice_and_visuals') {
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'running' };
  }
  if (currentPhase === 'script_generation' || currentPhase === 'script_completed') {
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'running' };
  }

  return { stage: 'SCRIPT_GENERATION', uiStatus: 'running' };
}

export function FirstRunWizard({ workspaceId, locale = 'vi' }: FirstRunWizardProps) {
  const isVi = locale === 'vi';
  const templates = getFirstRunTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(selectedTemplate.defaultTopic[locale]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState<MissionStageId>('SCRIPT_GENERATION');
  const [missionId, setMissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const pollStartRef = useRef<number>(0);

  const costEstimate = estimateTemplateCost(selectedTemplate.id);

  const clearPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  const pollTrackStatus = useCallback(async (targetMissionId: string) => {
    if (!isMountedRef.current) return;

    if (Date.now() - pollStartRef.current > MAX_POLL_TIMEOUT_MS) {
      setStatus('failed');
      setErrorMessage(
        isVi
          ? 'Quá trình dựng video vượt quá thời gian chờ (3 phút). Vui lòng kiểm tra lại trong bảng điều khiển.'
          : 'Video generation timed out (3 minutes). Please check the Mission Console.',
      );
      clearPolling();
      return;
    }

    try {
      const res = await getMissionTrackStatus(targetMissionId);
      if (!isMountedRef.current) return;

      if (res.ok) {
        const { status: mStatus, currentPhase, trackStatus } = res.value;
        const mapped = mapTrackStatusToStage(mStatus, currentPhase, trackStatus);

        setCurrentStage(mapped.stage);

        if (mapped.uiStatus === 'completed') {
          setStatus('completed');
          clearPolling();
          return;
        }

        if (mapped.uiStatus === 'failed') {
          setStatus('failed');
          setErrorMessage(
            isVi
              ? `Lỗi tại bước ${mapped.stage}. Bấm thử lại để khởi tạo lượt mới.`
              : `Pipeline failed at ${mapped.stage}. Click retry to restart.`,
          );
          clearPolling();
          return;
        }

        // Still running, schedule next poll
        pollTimeoutRef.current = setTimeout(() => {
          void pollTrackStatus(targetMissionId);
        }, POLL_INTERVAL_MS);
      } else {
        // Transient error or forbidden
        pollTimeoutRef.current = setTimeout(() => {
          void pollTrackStatus(targetMissionId);
        }, POLL_INTERVAL_MS);
      }
    } catch {
      if (!isMountedRef.current) return;
      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(targetMissionId);
      }, POLL_INTERVAL_MS);
    }
  }, [isVi, clearPolling]);

  const handleLaunch = async () => {
    clearPolling();
    setStatus('running');
    setCurrentStage('SCRIPT_GENERATION');
    setErrorMessage('');
    pollStartRef.current = Date.now();

    try {
      const now = Math.floor(Date.now() / 1000);
      const missionTitle = topic || selectedTemplate.name[locale];

      const createRes = await createMission({
        workspaceId,
        title: missionTitle,
        objective: `Generate autonomous ${selectedTemplate.durationSeconds}s video for ${selectedTemplate.targetPlatform}. Topic: ${topic}`,
        audience: 'General interest mobile viewers',
        geography: isVi ? 'Vietnam' : 'Global',
        timeframeStart: now,
        timeframeEnd: now + 3600,
        budgetCents: Math.round(costEstimate.totalUsd * 100),
        autonomyLevel: 1,
        channels: [selectedTemplate.targetPlatform],
        monetizationGoals: ['ad_revenue', 'affiliate_commissions'],
        constraints: {
          templateId: selectedTemplate.id,
          durationSeconds: selectedTemplate.durationSeconds,
          estimatedScenes: selectedTemplate.estimatedScenes,
          aspectRatio: selectedTemplate.aspectRatio,
          voiceStyle: selectedTemplate.voiceStyle,
          visualStyle: selectedTemplate.visualStyle,
          targetPlatform: selectedTemplate.targetPlatform,
        },
        successMetrics: { views: 1000, engagement_rate: 0.05 },
      });

      if (!createRes.ok) {
        setStatus('failed');
        setErrorMessage(createRes.error.message);
        return;
      }

      const newId = createRes.value.missionId;
      setMissionId(newId);

      // Start live polling loop immediately
      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(newId);
      }, 500);

      // Trigger real execution action asynchronously
      executeMultiTrackMissionAction({
        missionId: newId,
        topic: missionTitle,
        estimatedScenes: selectedTemplate.estimatedScenes,
        durationSeconds: selectedTemplate.durationSeconds,
        aspectRatio: selectedTemplate.aspectRatio,
        estimatedCostCents: Math.round(costEstimate.totalUsd * 100),
      })
        .then((execRes) => {
          if (!isMountedRef.current) return;
          if (!execRes.ok) {
            clearPolling();
            setStatus('failed');
            setErrorMessage(execRes.error.message);
          } else {
            clearPolling();
            setCurrentStage('READY_FOR_REVIEW');
            setStatus('completed');
          }
        })
        .catch((execErr) => {
          if (!isMountedRef.current) return;
          clearPolling();
          setStatus('failed');
          setErrorMessage(execErr instanceof Error ? execErr.message : String(execErr));
        });
    } catch {
      setStatus('failed');
      setErrorMessage(
        isVi
          ? 'Không thể khởi chạy nhiệm vụ. Vui lòng thử lại.'
          : 'Failed to launch mission. Please retry.',
      );
    }
  };

  return (
    // Render UI (5 CEO questions, MissionProgressBar, completion card with /dashboard/missions/${missionId} link, template selector, topic inputs)
  );
}
```

### 4.3 Translation Keys Expansion (`messages/en.json` & `messages/vi.json`)
Add under `firstRun`:
```json
"firstRun": {
  "title": "Create Your First Video Campaign",
  "subtitle": "With just a link or one-line concept, Sophia automatically renders a complete video in 60-90 seconds.",
  "templateSelectorTitle": "Select Starter Campaign Template",
  "costEstimatorTitle": "Pre-Flight Cost & Latency Transparency",
  "zeroHiddenFeesGuarantee": "0% Hidden Fees Guarantee: Direct provider API compute pricing with zero markup.",
  "launchButton": "Launch Video Mission Now",
  "questions": {
    "whatToEnter": "1. What to enter?",
    "whatToEnterDesc": "Pick a template or topic",
    "whatSophiaDoes": "2. What Sophia does?",
    "whatSophiaDoesDesc": "Script ➔ Voice ➔ Video",
    "duration": "3. Duration?",
    "durationDesc": "45 - 90 seconds",
    "cost": "4. Cost?",
    "costDesc": "~${cost} / {mcu} MCU",
    "whereShown": "5. Where shown?",
    "whereShownDesc": "Live preview & Review"
  },
  "status": {
    "completedTitle": "First Video Ready!",
    "completedDesc": "Video is composited and ready for your approval in the Review Console.",
    "reviewButton": "Review Video",
    "createAnother": "Create Another",
    "launchFailed": "Failed to launch mission. Please retry.",
    "timeoutError": "Video generation timed out. Please check the mission console."
  },
  "progress": {
    "title": "Video Generation Progress",
    "interrupted": "Execution Interrupted",
    "defaultError": "AI provider error. Retry safely.",
    "retry": "Retry"
  }
}
```

---

## 5. Verification Method

To verify the investigation and subsequent implementation:

1. **Verify State Mapping Function**:
   Execute vitest against the new component test suite:
   ```bash
   cd apps/sophia-ai-factory
   PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run src/components/missions/__tests__/first-run-wizard.test.tsx
   ```
   *Expected*: All tests pass verifying stage mapping (`SCRIPT_GENERATION`, `VOICE_SYNTHESIS`, `VISUAL_GENERATION`, `VIDEO_COMPOSITING`, `READY_FOR_REVIEW`), error status transitions, and unmount timer clearing.

2. **Verify Server Action & Multi-Track Suite**:
   ```bash
   cd apps/sophia-ai-factory
   PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run src/land/creative-mission/__tests__/actions.test.ts src/forest/mission/__tests__/multi-track-orchestrator.test.ts
   ```
   *Expected*: 54 tests pass (27 actions + 27 orchestrator).

3. **Verify Full E2E Multi-Track Video Pipeline**:
   ```bash
   cd apps/sophia-ai-factory
   PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/node ./node_modules/vitest/vitest.mjs run src/__tests__/e2e/multi-track-video-pipeline.e2e.test.ts
   ```
   *Expected*: 95 tests pass with 100% success rate.

4. **Verify TypeScript Strict Compilation**:
   ```bash
   cd apps/sophia-ai-factory
   PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/node ./node_modules/typescript/bin/tsc --noEmit
   ```
   *Expected*: Code 0, zero errors.
