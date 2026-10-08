import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  predictiveRenderScheduleJob,
  predictiveRenderEvaluateJob,
} from '../predictive-render-worker';
import * as coordinatorModule from '@/land/growth-v14/predictive-render-coordinator';

describe('Forest v14: Predictive Render Inngest Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('predictiveRenderScheduleJob executes step run and sends stage1 evaluation event', async () => {
    vi.spyOn(coordinatorModule, 'updateJobStatusInD1').mockResolvedValue(true);

    const stepRun = vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn());
    const stepSendEvent = vi.fn().mockResolvedValue({ ids: ['evt-1'] });

    const step = {
      run: stepRun,
      sendEvent: stepSendEvent,
    };

    const event = {
      name: 'growth/v14.render.schedule',
      data: {
        jobId: 'job-v14-1',
        userId: 'usr-1',
        scriptId: 'scr-1',
        allocatedMcu: 150,
        deliberationScore: 88,
      },
    };

    // Extract underlying function handler from Inngest function definition
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const result = await predictiveRenderScheduleJob.fn({ event, step });

    expect(result.status).toBe('STAGE_1_RENDERING');
    expect(stepRun).toHaveBeenCalledWith('set-stage-1-rendering-status', expect.any(Function));
    expect(stepSendEvent).toHaveBeenCalledWith(
      'send-stage-1-evaluation',
      expect.objectContaining({ name: 'growth/v14.render.stage1_evaluate' })
    );
  });

  it('predictiveRenderEvaluateJob halts render when stage 1 retention score is weak', async () => {
    vi.spyOn(coordinatorModule, 'updateJobStatusInD1').mockResolvedValue(true);

    const stepRun = vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn());
    const stepSendEvent = vi.fn().mockResolvedValue({ ids: ['evt-2'] });

    const step = {
      run: stepRun,
      sendEvent: stepSendEvent,
    };

    const event = {
      name: 'growth/v14.render.stage1_evaluate',
      data: {
        jobId: 'job-v14-weak',
        userId: 'usr-1',
        interimRetentionScore: 0.1, // low score -> should trigger early halt
      },
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const result = await predictiveRenderEvaluateJob.fn({ event, step });

    expect(result.halted).toBe(true);
    expect(result.decision.shouldHalt).toBe(true);
    expect(stepSendEvent).toHaveBeenCalledWith(
      'emit-render-halt',
      expect.objectContaining({ name: 'growth/v14.render.halt' })
    );
  });
});
