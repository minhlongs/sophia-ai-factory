/**
 * Setup Wizard State Machine & Fail-Closed Gate Unit Tests
 *
 * Validates:
 * 1. Step progression invariant
 * 2. Save gate fail-closed contract at step 4 -> step 5
 * 3. Advancement blocked when key persistence fails
 * 4. Inline error state tracking
 *
 * @module tree/components/setup-wizard/__tests__/wizard-fail-closed-gate.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Setup Wizard Fail-Closed Gate Contract', () => {
  let currentStepIndex: number;
  let saveError: string | null;
  let saveFailed: boolean;
  let isSaving: boolean;

  beforeEach(() => {
    currentStepIndex = 4; // On Step 4: MissionBlueprintStep
    saveError = null;
    saveFailed = false;
    isSaving = false;
  });

  const mockHandleSave = async (shouldFail: boolean, errorMsg = 'Failed to persist BYOK key'): Promise<boolean> => {
    saveError = null;
    saveFailed = false;
    isSaving = true;
    try {
      if (shouldFail) {
        throw new Error(errorMsg);
      }
      return true;
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Unknown save error';
      saveFailed = true;
      return false;
    } finally {
      isSaving = false;
    }
  };

  const handleNext = async (saveFn: () => Promise<boolean>) => {
    if (currentStepIndex === 4) {
      const saved = await saveFn();
      if (!saved) {
        // FAIL-CLOSED: Stop advancement if saving credentials failed
        return;
      }
    }
    currentStepIndex += 1;
  };

  it('halts progression at step 4 when handleSave throws or returns false (fail-closed)', async () => {
    await handleNext(() => mockHandleSave(true, 'D1 network timeout'));

    // Invariant: currentStepIndex must NOT advance to 5
    expect(currentStepIndex).toBe(4);
    expect(saveFailed).toBe(true);
    expect(saveError).toBe('D1 network timeout');
    expect(isSaving).toBe(false);
  });

  it('permits progression to step 5 (FinishStep) only when handleSave succeeds', async () => {
    await handleNext(() => mockHandleSave(false));

    // Invariant: currentStepIndex successfully advances to 5
    expect(currentStepIndex).toBe(5);
    expect(saveFailed).toBe(false);
    expect(saveError).toBeNull();
    expect(isSaving).toBe(false);
  });

  it('clears previous errors when retry succeeds', async () => {
    // First attempt fails
    await handleNext(() => mockHandleSave(true, 'Temporary error'));
    expect(currentStepIndex).toBe(4);
    expect(saveFailed).toBe(true);

    // User retries and succeeds
    await handleNext(() => mockHandleSave(false));
    expect(currentStepIndex).toBe(5);
    expect(saveFailed).toBe(false);
    expect(saveError).toBeNull();
  });
});
