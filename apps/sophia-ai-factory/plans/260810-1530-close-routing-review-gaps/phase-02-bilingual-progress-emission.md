# Phase 02: Bilingual Progress Emission on NoProvidersAvailableError

## Context Links
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-close-routing-review-gaps/plan.md
- **Source**: `src/forest/inngest/functions/video-generate.ts` (lines 199-210, 286-295)
- **Progress Pattern**: `emitProgress` function in same file (lines 58-77)
- **i18n Convention**: All user-facing messages bilingual (VI/EN) with `/` separator

## Overview
When `NoProvidersAvailableError` is caught during provider selection (TTS and Visual steps), the current code logs but **does not emit a progress event**. SSE subscribers receive no update, breaking the UX contract. Must emit bilingual `error` progress event before falling back or throwing.

**Priority**: HIGH — UX regression for users without BYOK keys
**Effort**: 1h

## Key Insights
- Two catch blocks for `NoProvidersAvailableError`: TTS (line 204-209) and Visual (line 294-299)
- TTS has fallback to Fish Speech (local); Visual has no fallback → throws
- Current: `logger.info('[videoGenerate] No TTS providers available, falling back to Fish Speech')`
- Missing: `emitProgress(missionId, 'error', 0, 'Bilingual message')`
- Progress payload format: `{ type: 'campaign.progress', campaignId, step, progress, message, timestamp }`
- Error step already used for Wan failures (lines 337, 346)

## Requirements

### Functional
- Emit bilingual `error` progress event when `NoProvidersAvailableError` caught
- TTS step: "Không có nhà cung cấp TTS / No TTS providers available — using Fish Speech"
- Visual step: "Không có nhà cung cấp video AI / No AI video providers available"
- Progress: 0%, step: 'error'
- Must use existing `emitProgress` function (already in scope)

### Non-Functional
- Do not change fallback logic (TTS still falls back to Fish Speech)
- Visual still throws after emission (no visual fallback exists)
- Maintain existing error logging
- Zero new dependencies

## Architecture
- **Layer**: forest/inngest (calls land/video, tree/video)
- **File**: `src/forest/inngest/functions/video-generate.ts`
- **Function**: `emitProgress` (lines 58-77, already defined in function scope)

## Related Code Files

| File | Action |
|------|--------|
| `src/forest/inngest/functions/video-generate.ts` | **MODIFY** - Add emitProgress in catch blocks |

## Implementation Steps

### 1. Locate TTS catch block (lines 204-209)
```typescript
} catch (err) {
  if (err instanceof NoProvidersAvailableError) {
    logger.info('[videoGenerate] No TTS providers available, falling back to Fish Speech', { strategy: routingStrategy });
    // ADD: await emitProgress(missionId, 'error', 0, 'Không có nhà cung cấp TTS / No TTS providers available — using Fish Speech');
  } else {
    throw err;
  }
}
```

### 2. Locate Visual catch block (lines 294-299)
```typescript
} catch (err) {
  if (err instanceof NoProvidersAvailableError) {
    logger.info('[videoGenerate] No visual providers available', { strategy: routingStrategy });
    // ADD: await emitProgress(missionId, 'error', 0, 'Không có nhà cung cấp video AI / No AI video providers available');
    throw new Error('No visual providers available');
  } else {
    throw err;
  }
}
```

### 3. Verify bilingual message convention
- Use format: `Vietnamese / English` (consistent with lines 217, 337, 346, 363, 376, 391, 404, 417, 430, 588)
- Example from line 337: `Lỗi tạo video / Video generation failed: ${statusResult.status}`
- Example from line 588: `Video đã tạo xong / Video generation complete`

### 4. Run tests to verify
- `npx vitest run src/forest/inngest/functions/video-generate.test.ts`
- Should see new progress event emission in mock `step.sendEvent` calls

## Todo List
- [ ] Add `emitProgress` call in TTS catch block (line ~206)
- [ ] Add `emitProgress` call in Visual catch block (line ~296)
- [ ] Use bilingual format: `Vietnamese / English`
- [ ] Run `npx vitest run src/forest/inngest/functions/video-generate.test.ts`
- [ ] Run `npm run type-check`
- [ ] Run `npm test` full suite

## Success Criteria
- [ ] Progress event emitted on TTS NoProvidersAvailableError (SSE subscribers notified)
- [ ] Progress event emitted on Visual NoProvidersAvailableError (SSE subscribers notified)
- [ ] Existing fallback logic unchanged
- [ ] `npm test` passes all tests
- [ ] `npm run type-check` → 0 errors

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| emitProgress fails silently | Low | Medium | emitProgress already wraps in try-catch and logs only |
| Message format inconsistent | Low | Low | Follow existing 10+ examples in same file |

## Security Considerations
- No new data exposed — progress events already sent
- No authentication changes
- Safe for production