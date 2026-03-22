/**
 * StepTracker — updates individual PEV step status in the execution_log JSONB column.
 *
 * Keeps a local copy of the step array and writes the full array back to DB
 * after each mutation (D1 stores execution_log as JSON text, no partial updates).
 */

import { createServerClient } from '@/lib/db/client';
import type { PEVStep } from '@/types/raas';

export class StepTracker {
  private steps: PEVStep[];

  constructor(
    private readonly missionId: string,
    steps: PEVStep[]
  ) {
    // Clone so callers cannot mutate our internal array
    this.steps = steps.map((s) => ({ ...s }));
  }

  /** Mark a single step by index with a new status and optional details string. */
  async markStep(
    index: number,
    status: PEVStep['status'],
    details?: string
  ): Promise<void> {
    if (index < 0 || index >= this.steps.length) return;

    const now = new Date().toISOString();
    this.steps[index] = {
      ...this.steps[index],
      status,
      details,
      ...(status === 'running' ? { started_at: now } : {}),
      ...(status === 'done' || status === 'failed' ? { completed_at: now } : {}),
    };

    await this.persist();
  }

  /** Convenience: mark every step as done. */
  async markAllDone(): Promise<void> {
    const now = new Date().toISOString();
    this.steps = this.steps.map((s) => ({
      ...s,
      status: 'done' as const,
      completed_at: now,
    }));
    await this.persist();
  }

  /** Convenience: mark every step as failed with a shared error message. */
  async markAllFailed(error: string): Promise<void> {
    const now = new Date().toISOString();
    this.steps = this.steps.map((s) => ({
      ...s,
      status: 'failed' as const,
      details: error,
      completed_at: now,
    }));
    await this.persist();
  }

  /** Current snapshot of steps (read-only copy). */
  getSteps(): PEVStep[] {
    return this.steps.map((s) => ({ ...s }));
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private async persist(): Promise<void> {
    const db = createServerClient();
    await db
      .from('missions')
      .update({ execution_log: this.steps, updated_at: new Date().toISOString() })
      .eq('id', this.missionId);
  }
}
