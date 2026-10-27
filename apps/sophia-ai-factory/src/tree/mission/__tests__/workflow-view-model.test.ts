import { describe, it, expect } from 'vitest';
import {
  buildIllustrativeWorkflowView,
  buildVerifiedMissionWorkflowView,
} from '@/tree/mission/workflow-view-model';

describe('Workflow View-Model & Verified Mapper Tests', () => {
  it('buildIllustrativeWorkflowView returns 5 deterministic stations for illustration mode', () => {
    const view = buildIllustrativeWorkflowView();
    expect(view.mode).toBe('illustration');
    expect(view.stations).toHaveLength(5);
    expect(view.stations[0].id).toBe('intake_brief');
    expect(view.stations[1].id).toBe('script_planning');
    expect(view.stations[2].id).toBe('ceo_approval_gate');
    expect(view.stations[3].id).toBe('media_render');
    expect(view.stations[4].id).toBe('publish_ledger');
    expect(view.activeStationId).toBe('ceo_approval_gate');
  });

  it('buildVerifiedMissionWorkflowView correctly maps draft status', () => {
    const view = buildVerifiedMissionWorkflowView({
      missionId: 'msn_123',
      status: 'draft',
      runs: [],
    });
    expect(view.mode).toBe('verified-job');
    expect(view.missionId).toBe('msn_123');
    expect(view.overallState).toBe('running');
    expect(view.stations[0].state).toBe('running');
    expect(view.stations[1].state).toBe('not_started');
    expect(view.stations[4].state).toBe('not_started');
  });

  it('buildVerifiedMissionWorkflowView blocks downstream success when approval is required', () => {
    const view = buildVerifiedMissionWorkflowView({
      missionId: 'msn_approval',
      status: 'approval_required',
      runs: [],
    });
    expect(view.overallState).toBe('needs_approval');
    expect(view.activeStationId).toBe('ceo_approval_gate');
    expect(view.stations[2].state).toBe('needs_approval');
    expect(view.stations[3].state).toBe('not_started');
    expect(view.stations[4].state).toBe('not_started');
  });

  it('buildVerifiedMissionWorkflowView reflects completed status across all stations', () => {
    const view = buildVerifiedMissionWorkflowView({
      missionId: 'msn_done',
      status: 'completed',
      spentCents: 500,
      runs: [{ status: 'completed', phase: 'completed', totalCostCents: 500, totalTokens: 1200 }],
    });
    expect(view.overallState).toBe('succeeded');
    expect(view.activeStationId).toBe('publish_ledger');
    expect(view.stations.every((s) => s.state === 'succeeded')).toBe(true);
    expect(view.totalCostCents).toBe(500);
    expect(view.totalTokens).toBe(1200);
  });

  it('buildVerifiedMissionWorkflowView isolates and highlights failed agent runs', () => {
    const view = buildVerifiedMissionWorkflowView({
      missionId: 'msn_fail',
      status: 'running',
      runs: [
        {
          status: 'failed',
          phase: 'executing',
          totalCostCents: 150,
          totalTokens: 400,
          errorMessage: 'ElevenLabs voice synthesis quota exceeded',
        },
      ],
    });
    expect(view.overallState).toBe('failed');
    expect(view.stations[3].state).toBe('failed');
    expect(view.stations[3].errorMessage).toBe('ElevenLabs voice synthesis quota exceeded');
    expect(view.stations[4].state).toBe('not_started');
  });
});
