import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EnterpriseDeal,
  EnterpriseProposalResult,
  MeetingPrepDossier,
  SandboxProvisionResult,
} from '@/seed/types/enterprise-deal';

const actions = vi.hoisted(() => ({
  generateMeetingPrepAction: vi.fn(),
  generateProposalAction: vi.fn(),
  provisionSandboxAction: vi.fn(),
}));

vi.mock('@/land/admin/enterprise-deal-actions', () => actions);

import { createDealsWorkflowHandlers } from './use-deals-workflow-handlers';

function deal(id: string): EnterpriseDeal {
  const factor = {
    score: 0,
    maxScore: 25,
    factor: 'budget' as const,
    reason: '',
    details: {},
  };
  return {
    id,
    leadName: 'Ada Lovelace',
    leadEmail: 'ada@example.com',
    leadPhone: null,
    leadTitle: null,
    companyName: 'Analytical Engines',
    companyDomain: 'example.com',
    leadSource: 'referral',
    dealStage: 'qualified',
    pipelineTier: 'warm',
    dealValueEstimateCents: 1_000_000,
    currency: 'USD',
    requestedMcuMonthly: 100,
    bantScore: 0,
    bantBudgetScore: 0,
    bantAuthorityScore: 0,
    bantNeedScore: 0,
    bantTimelineScore: 0,
    bantAnalysis: {
      budget: factor,
      authority: { ...factor, factor: 'authority' },
      need: { ...factor, factor: 'need' },
      timeline: { ...factor, factor: 'timeline' },
      totalScore: 0,
      tier: 'warm',
      recommendation: '',
      qualifiedAt: 1,
    },
    assignedAgentId: null,
    assignedAgentRole: 'unassigned',
    meetingPrepBrief: null,
    proposalId: null,
    proposalLanguage: 'en',
    proposalContent: null,
    sandboxSubaccountId: null,
    sandboxStatus: 'none',
    sandboxToken: null,
    sandboxExpiresAt: null,
    notes: null,
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
  };
}

function setup(selectedDeal: EnterpriseDeal | null = deal('target')) {
  let currentDeals = [deal('target'), deal('other')];
  const setDeals = vi.fn((update: React.SetStateAction<EnterpriseDeal[]>) => {
    currentDeals = typeof update === 'function' ? update(currentDeals) : update;
  });
  const setLoadingAction = vi.fn();
  const setPrepDossier = vi.fn();
  const setProposalResult = vi.fn();
  const setSandboxResult = vi.fn();

  return {
    handlers: createDealsWorkflowHandlers({
      selectedDeal,
      setDeals,
      setLoadingAction,
      setPrepDossier,
      setProposalResult,
      setSandboxResult,
    }),
    currentDeals: () => currentDeals,
    setDeals,
    setLoadingAction,
    setPrepDossier,
    setProposalResult,
    setSandboxResult,
  };
}

describe('createDealsWorkflowHandlers', () => {
  beforeEach(() => vi.resetAllMocks());

  it('skips all actions and state changes when no deal is selected', async () => {
    const context = setup(null);

    await context.handlers.handleGeneratePrep();
    await context.handlers.handleGenerateProposal('vi');
    await context.handlers.handleProvisionSandbox();

    expect(actions.generateMeetingPrepAction).not.toHaveBeenCalled();
    expect(actions.generateProposalAction).not.toHaveBeenCalled();
    expect(actions.provisionSandboxAction).not.toHaveBeenCalled();
    expect(context.setLoadingAction).not.toHaveBeenCalled();
    expect(context.setDeals).not.toHaveBeenCalled();
  });

  it('stores meeting prep results and updates only the selected deal', async () => {
    const context = setup();
    const dossier: MeetingPrepDossier = {
      dealId: 'target',
      companyOverview: 'Overview',
      keyStakeholders: 'Stakeholders',
      painPointAnalysis: 'Pain points',
      proposedSolutionBlueprint: 'Blueprint',
      commercialRecommendation: 'Recommendation',
      battlecards: [],
      fullBriefMarkdown: '# Brief',
      generatedAt: 100,
    };
    actions.generateMeetingPrepAction.mockResolvedValue({ success: true, data: dossier });

    await context.handlers.handleGeneratePrep();

    expect(actions.generateMeetingPrepAction).toHaveBeenCalledWith('target');
    expect(context.setPrepDossier).toHaveBeenCalledWith(dossier);
    expect(context.setLoadingAction.mock.calls).toEqual([['prep'], [null]]);
    expect(context.currentDeals()[0]).toMatchObject({ meetingPrepBrief: '# Brief', dealStage: 'demo_prepared' });
    expect(context.currentDeals()[1]).toEqual(deal('other'));
  });

  it('saves proposal content, language, id, and stage on success', async () => {
    const context = setup();
    const proposal: EnterpriseProposalResult = {
      proposalId: 'proposal-1',
      dealId: 'target',
      language: 'vi',
      title: 'Đề xuất',
      sections: [],
      fullMarkdown: '# Đề xuất',
      wordCount: 2,
      qualityPassed: true,
      generatedAt: 100,
    };
    actions.generateProposalAction.mockResolvedValue({ success: true, data: proposal });

    await context.handlers.handleGenerateProposal('vi');

    expect(actions.generateProposalAction).toHaveBeenCalledWith('target', 'vi');
    expect(context.setProposalResult).toHaveBeenCalledWith(proposal);
    expect(context.setLoadingAction.mock.calls).toEqual([['proposal'], [null]]);
    expect(context.currentDeals()[0]).toMatchObject({
      proposalId: 'proposal-1',
      proposalLanguage: 'vi',
      proposalContent: '# Đề xuất',
      dealStage: 'proposal_sent',
    });
  });

  it('stores sandbox details and marks the selected deal active', async () => {
    const context = setup();
    const sandbox: SandboxProvisionResult = {
      dealId: 'target',
      subaccountId: 'sandbox-1',
      subaccountName: 'Ada Demo',
      slug: 'ada-demo',
      allocatedMcu: 1_000,
      expiresAt: 500,
      sandboxToken: 'signed-token',
      demoMagicUrl: 'https://demo.example',
      watermarkEnabled: true,
    };
    actions.provisionSandboxAction.mockResolvedValue({ success: true, data: sandbox });

    await context.handlers.handleProvisionSandbox();

    expect(actions.provisionSandboxAction).toHaveBeenCalledWith('target');
    expect(context.setSandboxResult).toHaveBeenCalledWith(sandbox);
    expect(context.setLoadingAction.mock.calls).toEqual([['sandbox'], [null]]);
    expect(context.currentDeals()[0]).toMatchObject({
      sandboxSubaccountId: 'sandbox-1',
      sandboxStatus: 'active',
      sandboxToken: 'signed-token',
      sandboxExpiresAt: 500,
      dealStage: 'demo_active',
    });
  });

  it('does not mutate results for unsuccessful or incomplete action responses', async () => {
    const context = setup();
    actions.generateMeetingPrepAction.mockResolvedValue({ success: true });
    actions.generateProposalAction.mockResolvedValue({ success: false, error: 'Proposal unavailable' });
    actions.provisionSandboxAction.mockResolvedValue({ success: true, data: undefined });
    const originalTarget = context.currentDeals()[0];

    await context.handlers.handleGeneratePrep();
    await context.handlers.handleGenerateProposal('en');
    await context.handlers.handleProvisionSandbox();

    expect(context.currentDeals()[0]).toEqual(originalTarget);
    expect(context.setPrepDossier).not.toHaveBeenCalled();
    expect(context.setProposalResult).not.toHaveBeenCalled();
    expect(context.setSandboxResult).not.toHaveBeenCalled();
    expect(context.setLoadingAction.mock.calls).toEqual([
      ['prep'], [null], ['proposal'], [null], ['sandbox'], [null],
    ]);
  });

  it('clears the loading action and rethrows failures from the action', async () => {
    const context = setup();
    actions.generateMeetingPrepAction.mockRejectedValue(new Error('request failed'));

    await expect(context.handlers.handleGeneratePrep()).rejects.toThrow('request failed');
    expect(context.setLoadingAction.mock.calls).toEqual([['prep'], [null]]);
    expect(context.setPrepDossier).not.toHaveBeenCalled();
    expect(context.setDeals).not.toHaveBeenCalled();
  });
});
