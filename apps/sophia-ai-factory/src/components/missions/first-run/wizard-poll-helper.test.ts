import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getMissionTrackStatus: vi.fn() }));

vi.mock('@/land/creative-mission/actions', () => ({
  getMissionTrackStatus: mocks.getMissionTrackStatus,
}));

import { type PollWizardTrackParams, pollWizardTrackStep } from './wizard-poll-helper';
import { POLL_INTERVAL_MS } from './types';

function makeParams(overrides: Partial<PollWizardTrackParams> = {}): PollWizardTrackParams {
  return {
    targetMissionId: 'mission-1',
    isMounted: () => true,
    getPollStartedAt: () => Date.now(),
    t: (key, values) => values?.stage ? `${key}:${values.stage}` : key,
    setStatus: vi.fn(),
    setCurrentStage: vi.fn(),
    setErrorMessage: vi.fn(),
    clearPolling: vi.fn(),
    scheduleNextPoll: vi.fn(),
    ...overrides,
  };
}

describe('pollWizardTrackStep', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('does not poll after the wizard unmounts', async () => {
    const params = makeParams({ isMounted: () => false });

    await pollWizardTrackStep(params);

    expect(mocks.getMissionTrackStatus).not.toHaveBeenCalled();
    expect(params.scheduleNextPoll).not.toHaveBeenCalled();
  });

  it('fails and clears polling after the three-minute timeout', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(180_001);
    const params = makeParams({ getPollStartedAt: () => 0 });

    await pollWizardTrackStep(params);

    expect(params.setStatus).toHaveBeenCalledWith('failed');
    expect(params.setErrorMessage).toHaveBeenCalledWith('timeoutError');
    expect(params.clearPolling).toHaveBeenCalledOnce();
    expect(mocks.getMissionTrackStatus).not.toHaveBeenCalled();
  });

  it('reschedules when the status action reports a non-success result', async () => {
    mocks.getMissionTrackStatus.mockResolvedValueOnce({ ok: false, error: { message: 'not ready' } });
    const params = makeParams();

    await pollWizardTrackStep(params);

    expect(mocks.getMissionTrackStatus).toHaveBeenCalledWith('mission-1');
    expect(params.scheduleNextPoll).toHaveBeenCalledWith(POLL_INTERVAL_MS);
    expect(params.setCurrentStage).not.toHaveBeenCalled();
  });

  it('updates the running stage and schedules the next poll', async () => {
    mocks.getMissionTrackStatus.mockResolvedValueOnce({
      ok: true,
      value: { status: 'running', currentPhase: 'voice_and_visuals', trackStatus: { script: 'completed' } },
    });
    const params = makeParams();

    await pollWizardTrackStep(params);

    expect(params.setCurrentStage).toHaveBeenCalledWith('VOICE_SYNTHESIS');
    expect(params.scheduleNextPoll).toHaveBeenCalledWith(POLL_INTERVAL_MS);
    expect(params.setStatus).not.toHaveBeenCalled();
  });

  it('marks completed missions and stops polling', async () => {
    mocks.getMissionTrackStatus.mockResolvedValueOnce({
      ok: true,
      value: { status: 'completed', currentPhase: 'review', trackStatus: { video: 'completed' } },
    });
    const params = makeParams();

    await pollWizardTrackStep(params);

    expect(params.setCurrentStage).toHaveBeenCalledWith('READY_FOR_REVIEW');
    expect(params.setStatus).toHaveBeenCalledWith('completed');
    expect(params.clearPolling).toHaveBeenCalledOnce();
    expect(params.scheduleNextPoll).not.toHaveBeenCalled();
  });

  it('reports the localized failed stage and stops polling', async () => {
    mocks.getMissionTrackStatus.mockResolvedValueOnce({
      ok: true,
      value: {
        status: 'running',
        currentPhase: 'voice_and_visuals',
        trackStatus: { script: 'completed', audio: 'failed', visual: 'pending', video: 'pending' },
      },
    });
    const t = vi.fn((key: string, values?: Record<string, string | number>) =>
      values?.stage ? `${key}:${values.stage}` : key,
    );
    const params = makeParams({ t });

    await pollWizardTrackStep(params);

    expect(params.setCurrentStage).toHaveBeenCalledWith('VOICE_SYNTHESIS');
    expect(params.setStatus).toHaveBeenCalledWith('failed');
    expect(params.setErrorMessage).toHaveBeenCalledWith('stageFailureMessage:stages.voice_synthesis.label');
    expect(params.clearPolling).toHaveBeenCalledOnce();
    expect(params.scheduleNextPoll).not.toHaveBeenCalled();
  });

  it('ignores a response that completes after the wizard unmounts', async () => {
    mocks.getMissionTrackStatus.mockResolvedValueOnce({
      ok: true,
      value: { status: 'running', currentPhase: 'script', trackStatus: {} },
    });
    const isMounted = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const params = makeParams({ isMounted });

    await pollWizardTrackStep(params);

    expect(params.setCurrentStage).not.toHaveBeenCalled();
    expect(params.scheduleNextPoll).not.toHaveBeenCalled();
  });

  it('reschedules after a transient status error only while mounted', async () => {
    mocks.getMissionTrackStatus.mockRejectedValueOnce(new Error('temporary failure'));
    const params = makeParams();

    await pollWizardTrackStep(params);

    expect(params.scheduleNextPoll).toHaveBeenCalledWith(POLL_INTERVAL_MS);

    mocks.getMissionTrackStatus.mockRejectedValueOnce(new Error('unmounted failure'));
    const isMounted = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const unmountedParams = makeParams({ isMounted });
    await pollWizardTrackStep(unmountedParams);
    expect(unmountedParams.scheduleNextPoll).not.toHaveBeenCalled();
  });
});
