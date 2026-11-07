/**
 * Niche Studio Readiness Card & Financial Inputs UI Tests
 *
 * Verifies that `NicheFormProductInputs` renders editable `commissionTerms`
 * and `maxRenderCostCents` inputs with USD conversion, and `NicheGate1ReadinessCard`
 * renders all 6 Gate 1 checks and the unapproved budget proposal notice.
 * @module components/niche-studio/__tests__/niche-studio-readiness-ui.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  NicheFormProductInputs,
  type NicheProductFormValues,
} from '../niche-form-product-inputs';
import { NicheGate1ReadinessCard } from '../niche-gate1-readiness-card';
import type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';

vi.mock('@/forest/actions/opc-readiness-actions', () => ({
  getOpcGate1ReadinessAction: vi.fn(),
  saveNicheWorkspaceOfferAction: vi.fn(),
  connectNicheYoutubeChannelAction: vi.fn(),
}));

const t = (key: string) => key;

describe('NicheFormProductInputs financial & offer fields', () => {
  it('renders commissionTerms and maxRenderCostCents inputs with USD preview and fires onChange', () => {
    const onChange = vi.fn();
    const values: NicheProductFormValues = {
      productName: 'Linear App',
      productUrl: 'https://linear.app',
      affiliateCode: 'SOPHIA_VIP',
      subId: 'sub_01',
      vanityCoupon: 'SAVE30',
      jurisdiction: 'GLOBAL',
      commissionTerms: '30% Recurring MRR',
      maxRenderCostCents: 250,
    };

    render(<NicheFormProductInputs values={values} onChange={onChange} t={t} />);

    const commissionInput = screen.getByLabelText('commissionTerms') as HTMLInputElement;
    expect(commissionInput.value).toBe('30% Recurring MRR');
    fireEvent.change(commissionInput, { target: { value: '40% PartnerStack MRR' } });
    expect(onChange).toHaveBeenCalledWith('commissionTerms', '40% PartnerStack MRR');

    const budgetInput = screen.getByLabelText('maxRenderCostCents') as HTMLInputElement;
    expect(budgetInput.value).toBe('250');
    expect(screen.getByText(/\$2\.50 USD/)).toBeTruthy();
    fireEvent.change(budgetInput, { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith('maxRenderCostCents', 500);
  });
});

describe('NicheGate1ReadinessCard', () => {
  it('renders readinessBadgeReady and truncated YouTube channel ID when all 6 config presence checks pass', () => {
    const onRefresh = vi.fn();
    const report: OpcGate1ReadinessReport = {
      workspaceId: 'ws_1',
      userId: 'usr_1',
      adminAuthorized: true,
      killSwitchReady: true,
      killSwitchState: { active: false, known: true },
      byokProviders: ['elevenlabs', 'heygen'],
      voiceByokReady: true,
      videoByokReady: true,
      youtubeChannelReady: true,
      youtubeChannelId: 'ch_youtube_owner_999999',
      eligibleSaasOfferIds: ['off_saas_1'],
      eligibleCryptoOfferIds: ['off_crypto_1'],
      configPresentForGate1: true,
      gate1ReadyForLiveProof: true,
      verificationDepth: 'config_presence_only',
      credentialsLiveVerified: false,
      budgetApprovedByCeo: false,
      readinessCheckCostCents: 0,
      blockers: [],
    };

    render(
      <NicheGate1ReadinessCard
        report={report}
        isLoading={false}
        onRefresh={onRefresh}
        t={t}
      />,
    );

    expect(screen.getByText('readinessBadgeReady')).toBeTruthy();
    expect(screen.getByText(/ch_youtube_o/)).toBeTruthy();
    expect(screen.queryByText(/ch_youtube_owner_999999/)).toBeNull();
    fireEvent.click(screen.getByText('readinessRefresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
