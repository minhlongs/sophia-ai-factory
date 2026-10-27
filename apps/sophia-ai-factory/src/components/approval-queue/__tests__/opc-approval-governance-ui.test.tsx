import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ApprovalExecutiveHeader } from '../approval-executive-header';
import { ApprovalGovernanceBadges } from '../approval-governance-badges';
import { ApprovalCard } from '../card';
import type { Approval } from '../types';

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
  it('renders ApprovalExecutiveHeader with pending count, render budget, and SHA-256 Enforced status', () => {
    render(<ApprovalExecutiveHeader approvals={[SAMPLE_APPROVAL]} />);
    expect(screen.getByTestId('opc-ceo-approval-summary')).toBeDefined();
    expect(screen.getByText(/OPC Affiliate Campaign Approval Desk/i)).toBeDefined();
    expect(screen.getByText('$2.50')).toBeDefined();
    expect(screen.getByText('SHA-256 Enforced')).toBeDefined();
  });

  it('renders ApprovalGovernanceBadges with niche, jurisdiction, and SHA-256 Payload Lock', () => {
    render(<ApprovalGovernanceBadges approval={SAMPLE_APPROVAL} />);
    expect(screen.getByText(/Crypto\/CEX \(Affiliate\)/i)).toBeDefined();
    expect(screen.getByText('GLOBAL')).toBeDefined();
    expect(screen.getByText('SHA-256 Payload Lock')).toBeDefined();
    expect(screen.getByText('Domain B 0% Fee')).toBeDefined();
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
});
