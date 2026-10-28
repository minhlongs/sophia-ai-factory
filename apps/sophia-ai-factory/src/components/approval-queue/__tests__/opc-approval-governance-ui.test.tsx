import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ApprovalExecutiveHeader } from '../approval-executive-header';
import { ApprovalGovernanceBadges } from '../approval-governance-badges';
import { ApprovalCard } from '../card';
import type { Approval } from '../types';

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const TEST_MESSAGES = {
  approvals: {
    approve: 'Approve',
    reject: 'Reject',
    reasonPlaceholder: 'Enter a reason (optional)',
    actions: {
      approveTitle: 'Approve this action',
      rejectTitle: 'Reject this action',
    },
    fields: {
      agentId: 'Agent',
      created: 'Created',
      cost: 'Estimated Cost',
      expires: 'Expires',
    },
    badges: {
      complianceVerified: 'Compliance check: passed',
      changeNeedsApproval: 'Content changes will need re-approval',
      payloadHashHint: 'If the content changes, you will be asked to approve again.',
    },
    header: {
      eyebrow: 'Campaign approval desk',
      title: 'Approval Desk',
      controlNote: 'You keep the final decision',
      pending: 'Waiting for approval today',
      budget: 'Estimated production cost',
      blocked: 'Blocked by compliance',
      reapproval: 'When content changes',
      reapprovalNote: 'The new version needs your approval again before it runs.',
      unavailableNote: 'We could not read the list waiting for your decision. Please try again.',
      costPartiallyUnknown: 'Some items have no cost quote yet, so this total is incomplete.',
    },
    loadErrorTitle: 'We could not load your approval list',
    retryButton: 'Retry',
    decision: {
      impactLabel: 'If you approve',
      impactNormal: 'The campaign continues into the production step you just approved.',
      impactBlocked: 'The campaign is blocked at the compliance check for your market.',
      costUnknown: 'Cost is not yet confirmed — please confirm it before approving.',
      blockedReason:
        'Blocked: the content has not passed the compliance check for this market. Approving will not start production.',
      openArtifact: 'Open the related work',
      afterApproveWithTracking: 'Once you approve, you can follow the progress at the link below.',
      afterApproveNoTracking:
        'Once you approve, the system records your decision. Production progress will appear in your campaign list once updated.',
    },
  },
};

const SAMPLE_APPROVAL: Approval = {
  id: 'app_01',
  agentId: 'opc_affiliate_agent',
  actionId: 'act_render_01',
  actionType: 'campaign_publish',
  actionSummary: 'Publish CEX Fee Rebate Comparison Video (Non-Custodial) for Binance Global',
  estimatedCostCents: 250,
  status: 'pending',
  createdAt: Math.floor(Date.now() / 1000) - 300,
  timeoutAt: Math.floor(Date.now() / 1000) + 1800,
  niche: 'crypto_global',
  jurisdiction: 'GLOBAL',
  approvalPayloadHash: 'a3f5c9e1d2b40812',
  complianceStatus: 'passed',
};

describe('OPC CEO Approval Governance UI (trình duyệt)', () => {
  it('renders ApprovalExecutiveHeader with pending count, budget, and honest status copy', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalExecutiveHeader approvals={[SAMPLE_APPROVAL]} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('opc-ceo-approval-summary')).toBeDefined();
    expect(screen.getByText('Campaign approval desk')).toBeDefined();
    expect(screen.getByText('Approval Desk')).toBeDefined();
    expect(screen.getByText('$2.50')).toBeDefined();
    expect(screen.getByText('You keep the final decision')).toBeDefined();
    expect(screen.queryByText('SHA-256 Enforced')).toBeNull();
    expect(screen.queryByText('Kill-Switch: Armed')).toBeNull();
  });

  it('reports an unreadable approval queue as unknown instead of zero', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalExecutiveHeader approvals={undefined} />
      </NextIntlClientProvider>,
    );

    const summary = screen.getByTestId('opc-ceo-approval-summary');
    expect(summary.getAttribute('data-status')).toBe('error');
    // A failed load must not print the zero-count grid the customer would read
    // as "nothing is waiting for me".
    expect(summary.textContent).not.toMatch(/Waiting for approval today\s*0/);
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('flags a partially unknown cost total rather than reporting it as exact', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalExecutiveHeader
          approvals={[
            { ...SAMPLE_APPROVAL, estimatedCostCents: 250 },
            { ...SAMPLE_APPROVAL, id: 'app_02', estimatedCostCents: null },
          ]}
        />
      </NextIntlClientProvider>,
    );
    // One item has no quote, so the total must be marked incomplete instead of
    // silently adding the unknown item as 0.
    expect(screen.getByTestId('approval-budget-unknown-note')).toBeDefined();
    expect(screen.getByText('$2.50')).toBeDefined();
    expect(screen.queryByText('$5.00')).toBeNull();
  });

  it('reports no unknown-cost note when every item has a quote', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalExecutiveHeader approvals={[SAMPLE_APPROVAL]} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId('approval-budget-unknown-note')).toBeNull();
  });

  it('renders ApprovalGovernanceBadges with niche, jurisdiction, and plain benefit copy', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalGovernanceBadges approval={SAMPLE_APPROVAL} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Crypto\/CEX \(Affiliate\)/i)).toBeDefined();
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByTestId('approval-compliance-verified')).toBeDefined();
    expect(screen.queryByText('SHA-256 Payload Lock')).toBeNull();
    expect(screen.queryByText('Domain B 0% Fee')).toBeNull();
  });

  it('omits the compliance badge until the server verifies compliance', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalGovernanceBadges
          approval={{ ...SAMPLE_APPROVAL, complianceStatus: undefined }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId('approval-compliance-verified')).toBeNull();
  });

  it('renders ApprovalCard with governance badges and approve/reject actions', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={SAMPLE_APPROVAL}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Publish CEX Fee Rebate Comparison Video/i)).toBeDefined();
    expect(screen.getByText('Approve')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
  });

  it('states the impact and cost plainly before the customer decides', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={SAMPLE_APPROVAL}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('approval-decision-impact').textContent).toContain('If you approve');
    expect(screen.getByTestId('approval-decision-impact').textContent).toContain(
      'The campaign continues into the production step you just approved.',
    );
    expect(screen.getByText(/Estimated Cost: \$2\.50/)).toBeDefined();
  });

  it('flags an unconfirmed cost instead of presenting it as a settled amount', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={{ ...SAMPLE_APPROVAL, estimatedCostCents: null }}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Cost is not yet confirmed — please confirm it before approving.')).toBeDefined();
    expect(screen.queryByText(/Estimated Cost/)).toBeNull();
  });

  it('opens the linked mission only when the server supplied one', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={{ ...SAMPLE_APPROVAL, missionId: 'mis_abc123' }}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    const artifactLink = screen.getByText('Open the related work').closest('a');
    expect(artifactLink?.getAttribute('href')).toBe('/dashboard/missions/mis_abc123');
    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={SAMPLE_APPROVAL}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    // No mission reference → no artifact link at all, rather than a dead one.
    expect(screen.queryByText('Open the related work')).toBeNull();
  });

  it('does not promise tracking the server has not confirmed', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={SAMPLE_APPROVAL}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/the system records your decision/i)).toBeDefined();
    expect(screen.queryByText(/follow the progress at the link below/i)).toBeNull();
  });

  it('promises a real tracking path when the server declares one', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={{
            ...SAMPLE_APPROVAL,
            trackingPath: '/dashboard/campaigns/camp_abc123',
          }}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/follow the progress at the link below/i)).toBeDefined();
  });

  it('warns that a blocked approval will not start production', () => {
    render(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <ApprovalCard
          approval={{ ...SAMPLE_APPROVAL, complianceStatus: 'blocked' }}
          busy={false}
          actionError={null}
          onResolve={async () => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('approval-decision-impact').textContent).toContain(
      'The campaign is blocked at the compliance check for your market.',
    );
    expect(screen.getByText(/Blocked: the content has not passed the compliance check/i)).toBeDefined();
  });
});
