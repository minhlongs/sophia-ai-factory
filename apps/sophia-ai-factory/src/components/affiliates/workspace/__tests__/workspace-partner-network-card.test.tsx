/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspacePartnerNetworkCard } from '../workspace-partner-network-card';

vi.mock('@/forest/actions/workspace-partner-network-actions', () => ({
  listWorkspacePartnersAction: vi.fn(),
  recruitWorkspacePartnerAction: vi.fn(),
  reviewWorkspacePartnerStatusAction: vi.fn(),
  createWorkspaceDualRailBatchAction: vi.fn(),
}));

import {
  listWorkspacePartnersAction,
  reviewWorkspacePartnerStatusAction,
  createWorkspaceDualRailBatchAction,
} from '@/forest/actions/workspace-partner-network-actions';

const mockedList = vi.mocked(listWorkspacePartnersAction);
const mockedReview = vi.mocked(reviewWorkspacePartnerStatusAction);
const mockedCreateBatch = vi.mocked(createWorkspaceDualRailBatchAction);

describe('WorkspacePartnerNetworkCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Sophia Cloud upgrade notice when cloudGateAllowed is false', () => {
    render(
      <WorkspacePartnerNetworkCard
        initialPartners={[]}
        cloudGateAllowed={false}
        locale="vi"
      />,
    );

    expect(
      screen.getByText(/Nâng cấp lên Sophia Cloud hoặc Enterprise/i),
    ).toBeDefined();
    expect(screen.queryByText(/Xuất Lô VietQR \+ USDT/i)).toBeNull();
  });

  it('displays active and under_review partners and unlocks under_review on Approve', async () => {
    mockedReview.mockResolvedValueOnce({ success: true, newStatus: 'active' });
    mockedList.mockResolvedValueOnce({
      success: true,
      partners: [
        {
          id: 'p_1',
          partnerCode: 'VN_REVIEW_01',
          tier: 'STANDARD',
          commissionRatePct: 25,
          payoutRail: 'VIETQR',
          status: 'under_review',
          riskScore: 45,
          isSuspicious: true,
          totalEarningsCents: 15000,
          pendingPayoutCents: 15000,
          bankBin: '970422',
          bankAccountNumber: '190012345',
          bankAccountName: 'NGUYEN VAN A',
          usdtAddressMasked: null,
        },
      ],
    });
    mockedCreateBatch.mockResolvedValueOnce({
      success: true,
      batch: {
        batchId: 'batch_test_1',
        createdAt: new Date().toISOString(),
        rail: 'COMBINED',
        totalUsdtAmount: 0,
        totalVndAmount: 3810000,
        itemCount: 1,
        status: 'QUEUED',
        items: [],
      },
      vietQrCsv: 'STT,So tai khoan,Ten tai khoan\n1,190012345,NGUYEN VAN A',
    });

    render(
      <WorkspacePartnerNetworkCard
        initialPartners={[
          {
            id: 'p_1',
            partnerCode: 'VN_REVIEW_01',
            tier: 'STANDARD',
            commissionRatePct: 25,
            payoutRail: 'VIETQR',
            status: 'under_review',
            riskScore: 45,
            isSuspicious: true,
            totalEarningsCents: 15000,
            pendingPayoutCents: 15000,
            bankBin: '970422',
            bankAccountNumber: '190012345',
            bankAccountName: 'NGUYEN VAN A',
            usdtAddressMasked: null,
          },
        ]}
        cloudGateAllowed={true}
        locale="vi"
      />,
    );

    expect(screen.getByText(/VN_REVIEW_01/i)).toBeDefined();
    const approveBtn = screen.getByText('Duyệt mở khóa');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockedReview).toHaveBeenCalledWith({
        partnerId: 'p_1',
        decision: 'approve',
      });
    });

    const exportBtn = screen.getByText('Xuất Lô VietQR + USDT');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockedCreateBatch).toHaveBeenCalledWith({
        rail: 'COMBINED',
        minPayoutCents: 5000,
      });
      expect(screen.getByText(/1,190012345,NGUYEN VAN A/i)).toBeDefined();
    });
  });
});
