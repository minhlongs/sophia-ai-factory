# Milestone 3 Explorer 3 Handoff Report: Blueprint Templates, Cost Estimator & Test Specifications

**Author**: teamwork_preview_explorer_m3_3  
**Date**: 2026-09-19  
**Working Directory**: `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_3`  
**Target Milestone**: Milestone 3 (Bilingual Creative Studio & Blueprint UI)  
**Parent Agent**: `888683f7-30ce-42ff-840e-2e0b8eaaa575`  

---

## 1. Observation

### 1.1. Starter Blueprint Templates (`first-run-template.ts`)
Inspection of `apps/sophia-ai-factory/src/land/missions/first-run-template.ts` revealed:
- **Registry & Types** (lines 8–30):
  - `TemplateId = 'viral_shorts_explainer' | 'affiliate_product_showcase' | 'daily_news_wisdom'`
  - `FirstRunTemplate` interface mandates:
    ```typescript
    id: TemplateId;
    name: LocalizedString;
    description: LocalizedString;
    badge: LocalizedString;
    durationSeconds: number;
    aspectRatio: '9:16';
    targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
    targetWordCount: number;
    estimatedScenes: number;
    defaultTopic: LocalizedString;
    suggestedPrompts: LocalizedString[];
    voiceStyle: string;
    visualStyle: string;
    callToAction: LocalizedString;
    ```
- **3 Concrete Templates Defined** (`FIRST_RUN_TEMPLATES`, lines 32–167):
  1. `viral_shorts_explainer`:
     - Duration: `60s`, Aspect Ratio: `'9:16'`, Platform: `'youtube_shorts'`
     - Word Count: `140`, Estimated Scenes: `5`
     - Styles: `voiceStyle: 'dynamic_hook'`, `visualStyle: 'cinematic_vibrant'`
     - 3 Suggested Prompts in both `en` and `vi`.
  2. `affiliate_product_showcase`:
     - Duration: `30s`, Aspect Ratio: `'9:16'`, Platform: `'tiktok'`
     - Word Count: `75`, Estimated Scenes: `3`
     - Styles: `voiceStyle: 'enthusiastic_recommender'`, `visualStyle: 'product_clean_modern'`
     - 3 Suggested Prompts in both `en` and `vi`.
  3. `daily_news_wisdom`:
     - Duration: `45s`, Aspect Ratio: `'9:16'`, Platform: `'youtube_shorts'`
     - Word Count: `110`, Estimated Scenes: `4`
     - Styles: `voiceStyle: 'calm_authoritative'`, `visualStyle: 'editorial_minimal'`
     - 3 Suggested Prompts in both `en` and `vi`.
- **Public API Functions** (lines 170–182):
  - `getFirstRunTemplates(): FirstRunTemplate[]` — returns all 3 templates.
  - `getTemplateById(id: string): FirstRunTemplate | undefined` — lookup by ID.
  - `getDefaultTemplate(): FirstRunTemplate` — returns `viral_shorts_explainer`.

---

### 1.2. Preflight Cost & Latency Estimator (`cost-estimator.ts`)
Inspection of `apps/sophia-ai-factory/src/land/missions/cost-estimator.ts` revealed:
- **Pricing Constants** (lines 12–15):
  - `FAL_AI_COST_PER_IMAGE_USD = 0.025` ($0.025 per scene image)
  - `ELEVENLABS_COST_PER_1K_CHARS_USD = 0.015` ($0.015 per 1,000 characters)
  - `OPENROUTER_SCRIPT_COST_USD = 0.005` ($0.005 fixed per script)
  - `CHARS_PER_WORD_RATIO = 5.5` (5.5 characters per word)
- **MCU Duration Scaling** (`calculateMcuCredits`, lines 87–91):
  ```typescript
  export function calculateMcuCredits(durationSeconds: number): number {
    if (durationSeconds <= 30) return 30;
    if (durationSeconds <= 45) return 40;
    return VIDEO_MCU_COSTS.VIDEO_CREATE; // 50 MCU
  }
  ```
  Imported from `@/land/billing/video-mcu-cost-config` (`VIDEO_MCU_COSTS.VIDEO_CREATE = 50`).
- **Preflight Calculation & Clamping** (`estimateMissionPreflight`, lines 96–150):
  - Clamping:
    `const scenes = Math.max(1, input.estimatedScenes);`
    `const words = Math.max(10, input.targetWordCount);`
  - Formula:
    * `visualUsd = Number((scenes * FAL_AI_COST_PER_IMAGE_USD).toFixed(4))`
    * `voiceUsd = Number(((Math.round(words * CHARS_PER_WORD_RATIO) / 1000) * ELEVENLABS_COST_PER_1K_CHARS_USD).toFixed(4))`
    * `scriptUsd = 0.005`
    * `totalUsd = Number((visualUsd + voiceUsd + scriptUsd).toFixed(3))`
    * `totalMcu = calculateMcuCredits(input.durationSeconds)`
  - Standard Latency Benchmark Stages (lines 45–81):
    * `SCRIPT_GENERATION`: 5–10s
    * `VOICE_SYNTHESIS`: 8–15s
    * `VISUAL_GENERATION`: 15–35s
    * `VIDEO_COMPOSITING`: 17–30s
    * `READY_FOR_REVIEW`: 0s
    * Total Range: `durationRangeSeconds: { min: 45, max: 90 }`
  - Flag: `isZeroHiddenFees: true`.

---

### 1.3. Verification of Parameter Passing to `createMission` and `startMissionExecution`
Inspection of `apps/sophia-ai-factory/src/components/missions/first-run-wizard.tsx` (lines 44–95) and downstream execution in `actions.ts` and `multi-track-orchestrator.ts`:
- **Current `createMission` invocation in `first-run-wizard.tsx`**:
  ```typescript
  // lines 51-65:
  const createRes = await createMission({
    workspaceId,
    title: topic || selectedTemplate.name[locale],
    objective: `Generate autonomous ${selectedTemplate.durationSeconds}s video for ${selectedTemplate.targetPlatform}. Topic: ${topic}`,
    audience: 'General interest mobile viewers',
    geography: isVi ? 'Vietnam' : 'Global',
    timeframeStart: now,
    timeframeEnd: now + 3600,
    budgetCents: Math.round(costEstimate.totalUsd * 100),
    autonomyLevel: 1,
    channels: [selectedTemplate.targetPlatform],
    monetizationGoals: ['ad_revenue', 'affiliate_commissions'],
    constraints: {}, // <--- DEFECT: EMPTY CONSTRAINTS OBJECT!
    successMetrics: { views: 1000, engagement_rate: 0.05 },
  });
  ```
- **Current `startMissionExecution` invocation**:
  ```typescript
  // lines 77-81:
  await startMissionExecution({
    missionId: newId,
    agentId: 'agent_director',
    autonomyLevel: 1,
  });
  ```
- **Downstream impact in `apps/sophia-ai-factory/src/land/creative-mission/actions.ts` (lines 511–523)**:
  `startMissionExecution` launches:
  ```typescript
  void executeMultiTrackMission(parsed.data.missionId, {
    userId: user.id,
    workspaceId: mission.workspace_id,
  });
  ```
  Notice: `options.topic`, `options.voiceStyle`, `options.estimatedScenes`, `options.durationSeconds`, `options.aspectRatio` are **not passed in `options`**.
- **Downstream fallback in `apps/sophia-ai-factory/src/forest/mission/multi-track-orchestrator.ts`**:
  - Line 692-695:
    ```typescript
    const targetScenes = options?.estimatedScenes || (mission.constraints?.estimatedScenes as number) || 3;
    const targetDuration = options?.durationSeconds || (mission.constraints?.durationSeconds as number) || 30;
    ```
    Because `constraints: {}` was passed empty in `first-run-wizard.tsx`:
    - `targetScenes` falls back to **3** (even for `viral_shorts_explainer` which expects 5, and `daily_news_wisdom` which expects 4).
    - `targetDuration` falls back to **30** (even for `viral_shorts_explainer` which expects 60s, and `daily_news_wisdom` which expects 45s).
  - Line 782:
    `model: options?.voiceStyle` is `undefined` (and is not read from `mission.constraints?.voiceStyle`).
  - Line 851:
    `const rawRatio = options?.aspectRatio || (mission.constraints?.aspectRatio as string) || '9:16';`
  - `visualStyle`: Not read or appended to visual prompts.

---

### 1.4. Preflight Cost Calculation UI Display
Inspection of `first-run-wizard.tsx` and `page.tsx`:
- **Top 5-Questions CEO Guide** (lines 99–108):
  - Question 3 (Duration): `45 - 90 giây / seconds`
  - Question 4 (Cost): `~${costEstimate.totalUsd} / ${costEstimate.totalMcu} MCU`
- **Bottom Preflight Summary Card** (lines 159–165):
  - Cost: `<Coins /> ~${costEstimate.totalUsd} USD (${costEstimate.totalMcu} MCU)`
  - Duration: `<Clock /> 45 - 90 giây / seconds`
  - Zero fees guarantee: `✓ Minh bạch 100% không phí ẩn / Zero Hidden Fees`
- **Stage Progression Display** (lines 83–90, lines 110–128):
  - Currently simulates 5 stages using mock `setTimeout` (1200ms, 2400ms, 3600ms, 4800ms) rather than polling `getMissionTrackStatus(missionId)` or listening to Inngest/D1 status updates.

---

## 2. Logic Chain

1. **Premise 1**: The template engine (`first-run-template.ts`) correctly defines 3 distinct blueprints with varying durations (30s, 45s, 60s), scene counts (3, 4, 5), word counts (75, 110, 140), voice styles, and visual styles.
2. **Premise 2**: The cost estimator (`cost-estimator.ts`) calculates costs and MCU credits based directly on these parameters (`durationSeconds`, `estimatedScenes`, `targetWordCount`), producing 30, 40, or 50 MCU and transparent USD pricing.
3. **Premise 3**: When the user clicks "Launch Video Mission Now" in `first-run-wizard.tsx`, `createMission` is passed `constraints: {}` (empty object).
4. **Inference 1**: Because `constraints` is empty and `startMissionExecution` does not take or forward template options to `executeMultiTrackMission`, the orchestrator defaults to 3 scenes, 30 seconds, and undefined styles regardless of which blueprint was selected.
5. **Remedy**:
   - `first-run-wizard.tsx` must pass:
     ```typescript
     constraints: {
       templateId: selectedTemplate.id,
       durationSeconds: selectedTemplate.durationSeconds,
       aspectRatio: selectedTemplate.aspectRatio,
       estimatedScenes: selectedTemplate.estimatedScenes,
       voiceStyle: selectedTemplate.voiceStyle,
       visualStyle: selectedTemplate.visualStyle,
       targetWordCount: selectedTemplate.targetWordCount,
     },
     ```
   - In `multi-track-orchestrator.ts`, line 782 must read:
     `model: options?.voiceStyle || (mission.constraints?.voiceStyle as string),`
   - In `multi-track-orchestrator.ts`, `visualStyle` should be incorporated into the image prompt (e.g. `Style: ${visualStyle}. ${scene.prompt}`).
6. **Premise 4**: For UI progress tracking, `actions.ts` already exposes `getMissionTrackStatus(missionId)`.
7. **Inference 2**: Replacing the `setTimeout` simulation in `first-run-wizard.tsx` with polling `getMissionTrackStatus(missionId)` will fulfill Milestone 3 Feature 11 and Feature 15 ("Live 5-Stage Pipeline Tracker").

---

## 3. Caveats

1. **Read-Only Explorer Mandate**: In accordance with the system prompt and instructions, no modifications were made to `first-run-wizard.tsx`, `actions.ts`, or `multi-track-orchestrator.ts`. The exact proposed changes are documented here as actionable specifications.
2. **Sandboxed Command Execution**: Direct execution of Vitest via `run_command` in sandbox encountered an unpermitted environment/user prompt timeout. Test specifications are therefore designed with complete assertion code and mock scaffolds for straightforward execution.
3. **Provider Style Support**: The voice style strings (`dynamic_hook`, `enthusiastic_recommender`, `calm_authoritative`) are mapped as models or preset tags in ElevenLabs/TTS adapters. If an adapter expects a specific ElevenLabs voice ID, the preset must resolve via an internal voice registry.

---

## 4. Conclusion & Milestone 3 Unit Test Specifications

### Specification 1: `first-run-template.ts` Unit Test Specification
**Target File**: `apps/sophia-ai-factory/src/land/missions/__tests__/first-run-template.test.ts`

| Test ID | Test Name | Target Behavior | Assertions |
|---|---|---|---|
| **T-FRT-01** | Template Registry Cardinality | Exactly 3 starter templates registered | `getFirstRunTemplates().length === 3` |
| **T-FRT-02** | Viral Shorts Explainer Spec | 60s, 5 scenes, 140 words, 9:16, youtube_shorts | `t.durationSeconds === 60`, `t.estimatedScenes === 5`, `t.targetWordCount === 140`, `t.voiceStyle === 'dynamic_hook'`, `t.visualStyle === 'cinematic_vibrant'` |
| **T-FRT-03** | Affiliate Product Showcase Spec | 30s, 3 scenes, 75 words, 9:16, tiktok | `t.durationSeconds === 30`, `t.estimatedScenes === 3`, `t.targetWordCount === 75`, `t.voiceStyle === 'enthusiastic_recommender'`, `t.visualStyle === 'product_clean_modern'` |
| **T-FRT-04** | Daily News & Wisdom Spec | 45s, 4 scenes, 110 words, 9:16, youtube_shorts | `t.durationSeconds === 45`, `t.estimatedScenes === 4`, `t.targetWordCount === 110`, `t.voiceStyle === 'calm_authoritative'`, `t.visualStyle === 'editorial_minimal'` |
| **T-FRT-05** | Bilingual Parity Across All Fields | Non-empty `en` and `vi` strings for all localized fields | `name`, `description`, `badge`, `defaultTopic`, `callToAction` have non-empty `en` and `vi` |
| **T-FRT-06** | Prompt Suggestions Density & Parity | Each template has at least 3 prompt suggestions, each bilingual | `suggestedPrompts.length >= 3`, each prompt has `en.length > 10` and `vi.length > 10` |
| **T-FRT-07** | ID Lookup & Fallback | `getTemplateById` returns matching template or `undefined` | Valid ID returns object; `'non_existent'` returns `undefined` |
| **T-FRT-08** | Default Template Contract | `getDefaultTemplate()` returns `viral_shorts_explainer` | `getDefaultTemplate().id === 'viral_shorts_explainer'` |
| **T-FRT-09** | Immutable Aspect Ratio | All starter blueprints are 9:16 vertical video | Every template has `aspectRatio === '9:16'` |

```typescript
// Sample Test Implementation for T-FRT-06 (Prompt Suggestions)
it('T-FRT-06: each template contains >= 3 bilingual prompt suggestions', () => {
  const templates = getFirstRunTemplates();
  for (const t of templates) {
    expect(t.suggestedPrompts.length).toBeGreaterThanOrEqual(3);
    for (const p of t.suggestedPrompts) {
      expect(p.en.trim().length).toBeGreaterThan(10);
      expect(p.vi.trim().length).toBeGreaterThan(10);
    }
  }
});
```

---

### Specification 2: `cost-estimator.ts` Unit Test Specification
**Target File**: `apps/sophia-ai-factory/src/land/missions/__tests__/cost-estimator.test.ts`

| Test ID | Test Name | Target Behavior | Assertions |
|---|---|---|---|
| **T-CE-01** | Provider Pricing Constants | Live provider cost rates are exact | `FAL_AI_COST_PER_IMAGE_USD === 0.025`, `ELEVENLABS_COST_PER_1K_CHARS_USD === 0.015`, `OPENROUTER_SCRIPT_COST_USD === 0.005`, `CHARS_PER_WORD_RATIO === 5.5` |
| **T-CE-02** | MCU Tier Boundary: 30s Tier | <=30s yields 30 MCU | `calculateMcuCredits(1) === 30`, `calculateMcuCredits(30) === 30` |
| **T-CE-03** | MCU Tier Boundary: 45s Tier | 31s–45s yields 40 MCU | `calculateMcuCredits(31) === 40`, `calculateMcuCredits(45) === 40` |
| **T-CE-04** | MCU Tier Boundary: 60s+ Tier | >45s yields 50 MCU (capped at `VIDEO_CREATE`) | `calculateMcuCredits(46) === 50`, `calculateMcuCredits(60) === 50`, `calculateMcuCredits(300) === 50` |
| **T-CE-05** | Scene Clamping (Zero/Negative) | `estimatedScenes <= 0` clamped to 1 | Input `{ estimatedScenes: 0 }` results in 1 scene fal.ai cost ($0.025) |
| **T-CE-06** | Word Count Clamping (Zero/Negative) | `targetWordCount < 10` clamped to 10 | Input `{ targetWordCount: -5 }` clamped to 10 words, voice cost > 0 |
| **T-CE-07** | Breakdown Structure & Math Precision | Total USD equals sum of items rounded to 3 decimal places | `estimate.totalUsd === Number((visualUsd + voiceUsd + scriptUsd).toFixed(3))` |
| **T-CE-08** | Benchmark Latency Stages Order & Bounds | 5 stages ordered with valid min/max seconds | IDs match `['SCRIPT_GENERATION', 'VOICE_SYNTHESIS', 'VISUAL_GENERATION', 'VIDEO_COMPOSITING', 'READY_FOR_REVIEW']`, `maxSeconds >= minSeconds >= 0` |
| **T-CE-09** | Zero Hidden Fees Guarantee | Flag is strictly `true` | `estimate.isZeroHiddenFees === true` |
| **T-CE-10** | Template Cost Convenience Function | `estimateTemplateCost` calculates correctly per template | `viral_shorts_explainer` -> 50 MCU; `affiliate_product_showcase` -> 30 MCU; `daily_news_wisdom` -> 40 MCU |

```typescript
// Sample Test Implementation for T-CE-05 & T-CE-06 (Clamping)
it('T-CE-05 & T-CE-06: clamps zero and negative scene/word inputs to safe minimums', () => {
  const estimate = estimateMissionPreflight({
    durationSeconds: 30,
    estimatedScenes: -3,
    targetWordCount: 0,
  });
  // Clamped to 1 scene
  const visualItem = estimate.breakdown.find((b) => b.service === 'fal.ai');
  expect(visualItem?.estimatedUsd).toBe(0.025);
  expect(visualItem?.unitMetric).toBe('1 scenes (1 AI images)');

  // Clamped to 10 words -> 55 chars -> 55/1000 * 0.015 = 0.0008
  const voiceItem = estimate.breakdown.find((b) => b.service === 'ElevenLabs');
  expect(voiceItem?.estimatedUsd).toBe(0.0008);
  expect(voiceItem?.unitMetric).toBe('55 chars (~10 words)');
});
```

---

### Specification 3: `/dashboard/missions/new` & `FirstRunWizard` Component Test Specification
**Target File**: `apps/sophia-ai-factory/src/components/missions/__tests__/first-run-wizard.test.tsx`

| Test ID | Test Name | Target Behavior | Assertions |
|---|---|---|---|
| **T-FRW-01** | Initial Render & Defaults | Renders all 3 templates, defaults to Viral Shorts with default topic | Template buttons visible; input value equals `selectedTemplate.defaultTopic['vi']`; badge displayed |
| **T-FRW-02** | Template Switching Reactivity | Clicking another template updates topic, badge, and cost display | Clicking "Affiliate Product Showcase" updates input to its default topic, badge to "Chuyển đổi cao (30s)", and MCU to 30 |
| **T-FRW-03** | Suggested Prompt Click | Clicking a prompt pill replaces or populates input text | Click pill updates input `value` to pill text |
| **T-FRW-04** | Preflight Cost & Latency Display | Correctly displays USD, MCU, and latency range for selected blueprint | Displays `~${cost.totalUsd} USD (${cost.totalMcu} MCU)` and `45 - 90 giây` |
| **T-FRW-05** | Complete Constraints Forwarding | Form submission forwards all template options into `constraints` | `createMission` spy called with `constraints: { templateId, durationSeconds, aspectRatio, estimatedScenes, voiceStyle, visualStyle, targetWordCount }` |
| **T-FRW-06** | Execution Launch Wiring | Successful `createMission` immediately triggers `startMissionExecution` | `startMissionExecution` called with `{ missionId, agentId: 'agent_director', autonomyLevel: 1 }` |
| **T-FRW-07** | Error State Display | Action failure displays localized error message without crashing | Error container renders `createRes.error.message` or retry button |
| **T-FRW-08** | Real Stage Progress Transition | Live progress updates as stages complete | Displays `MissionProgressBar` progressing from `SCRIPT_GENERATION` to `READY_FOR_REVIEW` |
| **T-FRW-09** | Completion Screen & Review Link | When status is completed, shows review CTA with valid mission URL | Renders link to `/dashboard/missions/${missionId}` with `<Video />` icon |

```typescript
// Sample Test Implementation for T-FRW-05 (Complete Constraints Forwarding)
it('T-FRW-05: passes complete blueprint constraints to createMission on launch', async () => {
  const createMissionMock = vi.fn().mockResolvedValue({
    ok: true,
    value: { missionId: 'msn_test_123' },
  });
  const startExecutionMock = vi.fn().mockResolvedValue({
    ok: true,
    value: { runId: 'run_123' },
  });

  render(
    <FirstRunWizard
      workspaceId="ws_test"
      userId="user_1"
      locale="vi"
    />
  );

  // Switch to Affiliate Product Showcase (30s, 3 scenes, tiktok)
  const affiliateBtn = screen.getByText(/Giới thiệu sản phẩm Tiếp thị liên kết/i);
  fireEvent.click(affiliateBtn);

  // Click Launch
  const launchBtn = screen.getByRole('button', { name: /Bắt đầu sản xuất video ngay/i });
  fireEvent.click(launchBtn);

  await waitFor(() => {
    expect(createMissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_test',
        channels: ['tiktok'],
        constraints: expect.objectContaining({
          templateId: 'affiliate_product_showcase',
          durationSeconds: 30,
          aspectRatio: '9:16',
          estimatedScenes: 3,
          voiceStyle: 'enthusiastic_recommender',
          visualStyle: 'product_clean_modern',
          targetWordCount: 75,
        }),
      })
    );
  });
});
```

---

### Specification 4: Server Action Integration Test Specification (`createMission`)
**Target File**: `apps/sophia-ai-factory/src/land/creative-mission/__tests__/actions.create-mission.test.ts`

| Test ID | Test Name | Target Behavior | Assertions |
|---|---|---|---|
| **T-ACT-01** | Constraints Persistence in D1 | `createMission` persists full constraints JSON in `creative_missions` | `d1.prepare` receives `JSON.stringify(constraints)` matching input |
| **T-ACT-02** | Budget Cents Alignment | Budget cents passed from preflight estimate | `budgetCents === Math.round(costEstimate.totalUsd * 100)` |
| **T-ACT-03** | Autonomy Level & Channel Validation | Autonomy level 1 and platform channel (e.g. `youtube_shorts`) validated | Row created with `autonomy_level: 1` and `channels: ['youtube_shorts']` |

---

## 5. Verification Method

### 5.1. How to Independently Verify Code and Tests
1. **Verify Template Registry and Cost Estimator Functions**:
   Inspect:
   - `apps/sophia-ai-factory/src/land/missions/first-run-template.ts`
   - `apps/sophia-ai-factory/src/land/missions/cost-estimator.ts`
   Verify that:
   - All 3 templates (`viral_shorts_explainer`, `affiliate_product_showcase`, `daily_news_wisdom`) exist and contain all required properties.
   - `calculateMcuCredits(30)` returns 30, `calculateMcuCredits(45)` returns 40, and `calculateMcuCredits(60)` returns 50.
   - Clamping `Math.max(1, ...)` and `Math.max(10, ...)` is present in `estimateMissionPreflight`.

2. **Verify Parameter Passing Defect**:
   Inspect `apps/sophia-ai-factory/src/components/missions/first-run-wizard.tsx` lines 51–65.
   Check: `constraints: {}` is currently empty.
   Inspect `apps/sophia-ai-factory/src/forest/mission/multi-track-orchestrator.ts` lines 692–695 and 782.
   Observe: Default fallbacks trigger (3 scenes, 30s) due to empty constraints.

3. **Run Existing Test Suite (When executing in environment with Node permission)**:
   ```bash
   cd apps/sophia-ai-factory
   npx vitest run src/land/missions/__tests__/first-run-template.test.ts
   npx vitest run src/land/missions/__tests__/cost-estimator.test.ts
   ```

4. **Invalidation Conditions**:
   - If `FIRST_RUN_TEMPLATES` duration or scene numbers are altered without updating `cost-estimator.ts` or `calculateMcuCredits`.
   - If `createMissionSchema` in `actions.ts` restricts `constraints` to exclude template metadata.
