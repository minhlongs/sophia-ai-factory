import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AffiliateOverviewCard } from '../affiliate-studio/affiliate-overview-card';
import { AffiliateOffersCard, normalizeOfferUrlInput } from '../affiliate-studio/affiliate-offers-card';
import {
  AffiliateCampaignGeneratorCard,
  resolveDefaultContentLocaleForMarket,
} from '../affiliate-studio/affiliate-campaign-generator-card';
import { AffiliateContentWorkspaceCard } from '../affiliate-studio/affiliate-content-workspace-card';
import { AffiliateRevenueDashboardCard } from '../affiliate-studio/affiliate-revenue-dashboard-card';
import type { PilotAffiliateCampaignRecord, PilotAffiliateOfferRecord } from '@/tree/first-value/pilot-affiliate-studio-repo';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const SAMPLE_OFFER: PilotAffiliateOfferRecord = {
  id: 'poff_1',
  orgId: 'org_1',
  userId: 'u_1',
  vertical: 'crypto',
  productName: 'Ledger Nano X',
  officialWebsiteUrl: 'https://www.ledger.com',
  referralUrl: 'https://shop.ledger.com/?r=ceo1',
  commissionTerms: '10% hardware sale',
  targetAudience: 'US holders',
  targetMarket: 'US',
  productInfoSource: 'Ledger specs',
  status: 'active',
  createdAtIso: '2026-11-25T00:00:00Z',
  updatedAtIso: '2026-11-25T00:00:00Z',
};

const SAMPLE_CAMPAIGN: PilotAffiliateCampaignRecord = {
  id: 'pcmp_1',
  orgId: 'org_1',
  userId: 'u_1',
  offerId: 'poff_1',
  idempotencyKey: 'idem_1',
  payloadHash: 'hash_1',
  vertical: 'crypto',
  campaignName: 'Ledger Security Campaign',
  referralUrl: 'https://shop.ledger.com/?r=ceo1',
  targetMarket: 'US',
  provenance: 'live_provider',
  provenanceLabel: 'LIVE_PROVIDER_INFERENCE',
  reviewState: 'pending_review',
  version: 1,
  estimatedAiCostMicroUsd: 20000,
  approvedAtIso: null,
  approvedByUserId: null,
  rejectedAtIso: null,
  rejectionReason: null,
  createdAtIso: '2026-11-25T00:00:00Z',
  updatedAtIso: '2026-11-25T00:00:00Z',
  pack: {
    campaignTitle: 'Ledger Security Campaign',
    audienceAnalysis: 'Self-custody holders.',
    valueProposition: 'Hardware key isolation.',
    contentAngles: ['Angle 1', 'Angle 2'],
    hook: 'Protect keys offline.',
    callToAction: 'Visit https://shop.ledger.com/?r=ceo1',
    shortFormScript: {
      title: 'Ledger 30s',
      total_duration: 30,
      scenes: [
        { scene_number: 1, title: 'Hook', visual_description: 'V1', narration: 'N1', duration_estimate: 10 },
        { scene_number: 2, visual_description: 'V2', narration: 'N2', duration_estimate: 10 },
        { scene_number: 3, title: 'CTA', visual_description: 'V3', narration: 'N3', duration_estimate: 10 },
      ],
    },
    socialPost: 'Check https://shop.ledger.com/?r=ceo1 #ad',
    affiliateDisclosure: '#ad | Risk disclosure',
    referralUrl: 'https://shop.ledger.com/?r=ceo1',
  },
};

describe('Affiliate Studio UI Cards branch coverage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders AffiliateOverviewCard in CONNECTED and multi-currency states', () => {
    render(
      <AffiliateOverviewCard
        byokConfigured={false}
        offersCount={2}
        revenue={{
          partnerFeedStatus: 'CONNECTED',
          connectedNetworks: ['partnerstack'],
          totalCampaigns: 3,
          approvedCampaigns: 2,
          clicksCount: 100,
          clicksSource: 'PARTNER_REPORTED',
          signupsCount: 10,
          qualifiedConversions: 4,
          pendingCommissionUsd: null,
          confirmedCommissionUsd: null,
          estimatedAiCostUsd: 0.06,
          netRevenueUsd: null,
          currency: 'MIXED',
          isMultiCurrency: true,
          domainBReconciliation: null,
        }}
      />,
    );
    expect(screen.getByText(/CONNECTED/)).toBeTruthy();
    expect(screen.getByText('affMultiCurrencyBadge')).toBeTruthy();
  });

  it('switches Crypto/SaaS verticals, selects and archives offers in AffiliateOffersCard', async () => {
    const onSelect = vi.fn();
    const onArchive = vi.fn(async () => true);
    const onSave = vi.fn(async () => false);

    render(
      <AffiliateOffersCard
        offers={[SAMPLE_OFFER, { ...SAMPLE_OFFER, id: 'poff_2', productName: 'Second Offer' }]}
        selectedOfferId="poff_1"
        busy={false}
        onSelectOffer={onSelect}
        onSaveOffer={onSave}
        onArchiveOffer={onArchive}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'affVerticalCrypto' }));
    expect(screen.getByText('affCryptoComplianceNote')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'affVerticalSaas' }));

    fireEvent.click(screen.getByRole('button', { name: 'affUseOfferBtn' }));
    expect(onSelect).toHaveBeenCalledWith('poff_2');

    fireEvent.click(screen.getAllByRole('button', { name: 'affArchiveBtn' })[0]);
    await waitFor(() => expect(onArchive).toHaveBeenCalledWith('poff_1'));

    // Bare domain without https:// (e.g. "oneroyal.com") normalizes to https:// and enables Save
    expect(normalizeOfferUrlInput('oneroyal.com')).toBe('https://oneroyal.com');
    expect(normalizeOfferUrlInput('javascript:alert(1)')).toBeNull();
    expect(normalizeOfferUrlInput('not a url')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'affVerticalCrypto' }));
    fireEvent.change(screen.getByPlaceholderText('affProductNamePlaceholder'), {
      target: { value: 'Oneroyal' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: 'oneroyal.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/?via=your-partner-code'), {
      target: { value: 'https://vc.cabinet.oneroyal.com/links/go/18230' },
    });
    fireEvent.change(screen.getByPlaceholderText('affCommissionTermsPlaceholder'), {
      target: { value: '25% commission on trading fees' },
    });
    fireEvent.change(screen.getByPlaceholderText('affTargetAudiencePlaceholder'), {
      target: { value: 'Active traders' },
    });
    fireEvent.change(screen.getByPlaceholderText('affInfoSourcePlaceholder'), {
      target: { value: 'Official website' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'affSaveOfferBtn' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          vertical: 'crypto',
          productName: 'Oneroyal',
          officialWebsiteUrl: 'https://oneroyal.com',
          referralUrl: 'https://vc.cabinet.oneroyal.com/links/go/18230',
        }),
      ),
    );
  });

  it('updates duration and selects campaigns in AffiliateCampaignGeneratorCard', async () => {
    const onSelect = vi.fn();
    const onGen = vi.fn(async () => {});

    render(
      <AffiliateCampaignGeneratorCard
        selectedOffer={SAMPLE_OFFER}
        campaigns={[SAMPLE_CAMPAIGN, { ...SAMPLE_CAMPAIGN, id: 'pcmp_2', campaignName: 'Other Camp' }]}
        activeCampaignId="pcmp_1"
        modelId="openai/gpt-4o-mini"
        canGenerate
        busy={false}
        onSelectCampaign={onSelect}
        onGenerate={onGen}
      />,
    );

    expect(resolveDefaultContentLocaleForMarket('US')).toBe('en');
    expect(resolveDefaultContentLocaleForMarket('EU')).toBe('en');
    expect(resolveDefaultContentLocaleForMarket('VN')).toBe('vi');

    fireEvent.change(screen.getByLabelText('durationLabel'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'affGenerateCampaignBtn' }));
    await waitFor(() => expect(onGen).toHaveBeenCalledWith(45, 'en'));

    // Customer can explicitly override content language to VI even for US offer
    fireEvent.change(screen.getByLabelText('affContentLangLabel'), { target: { value: 'vi' } });
    fireEvent.click(screen.getByRole('button', { name: 'affGenerateCampaignBtn' }));
    await waitFor(() => expect(onGen).toHaveBeenCalledWith(45, 'vi'));

    fireEvent.click(screen.getByRole('button', { name: 'affOpenWorkspaceBtn' }));
    expect(onSelect).toHaveBeenCalledWith('pcmp_2');
  });

  it('edits all fields, cancels edit, exports JSON, copies and downloads in AffiliateContentWorkspaceCard', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const createUrl = vi.fn(() => 'blob:test-url');
    const revokeUrl = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const onSaveEdit = vi.fn(async () => true);
    const onApprove = vi.fn(async () => true);
    const onExport = vi.fn(async () => {});

    const { rerender } = render(
      <AffiliateContentWorkspaceCard
        campaign={SAMPLE_CAMPAIGN}
        exportPayload={null}
        busy={false}
        onSaveEdit={onSaveEdit}
        onApprove={onApprove}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'editScriptBtn' }));
    fireEvent.change(screen.getByLabelText('affHookLabel'), { target: { value: 'New Hook' } });
    fireEvent.change(screen.getByLabelText('affCtaLabel'), { target: { value: 'New CTA' } });
    fireEvent.change(screen.getByLabelText('affSocialPostLabel'), { target: { value: 'New Social Post' } });
    fireEvent.change(screen.getAllByRole('textbox')[4], { target: { value: 'Updated Scene 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'cancelEditBtn' }));

    rerender(
      <AffiliateContentWorkspaceCard
        campaign={{ ...SAMPLE_CAMPAIGN, reviewState: 'approved' }}
        exportPayload={'{"ok":true}'}
        busy={false}
        onSaveEdit={onSaveEdit}
        onApprove={onApprove}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'exportJsonBtn' }));
    expect(onExport).toHaveBeenCalledWith('json');

    fireEvent.click(screen.getByRole('button', { name: 'copyExportBtn' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('{"ok":true}'));

    fireEvent.click(screen.getByRole('button', { name: 'downloadExportBtn' }));
    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('records numeric clicks, commissions, and currency in AffiliateRevenueDashboardCard', async () => {
    const onRecord = vi.fn(async () => true);
    render(
      <AffiliateRevenueDashboardCard
        revenue={{
          partnerFeedStatus: 'NOT_CONNECTED',
          connectedNetworks: [],
          totalCampaigns: 1,
          approvedCampaigns: 1,
          clicksCount: 25,
          clicksSource: 'PARTNER_REPORTED',
          signupsCount: 3,
          qualifiedConversions: 1,
          pendingCommissionUsd: 10,
          confirmedCommissionUsd: 20,
          estimatedAiCostUsd: 0.02,
          netRevenueUsd: 19.98,
          currency: 'USD',
          isMultiCurrency: false,
          domainBReconciliation: null,
        }}
        campaigns={[SAMPLE_CAMPAIGN]}
        entries={[]}
        busy={false}
        onRecordPerformance={onRecord}
      />,
    );

    fireEvent.change(screen.getByLabelText('affPerfCampaignLabel'), { target: { value: 'pcmp_1' } });
    fireEvent.change(screen.getByPlaceholderText('affPerfSourcePlaceholder'), { target: { value: 'Ledger CSV' } });
    fireEvent.change(screen.getByPlaceholderText('2026-11-W4'), { target: { value: '2026-11' } });
    fireEvent.change(screen.getByPlaceholderText('stmt-2026-11-01'), { target: { value: 'ref-999' } });
    fireEvent.change(screen.getByPlaceholderText('—'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('affMetricSignups'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('affMetricConversions'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('affPendingInputLabel'), { target: { value: '15.5' } });
    fireEvent.change(screen.getByLabelText('affConfirmedInputLabel'), { target: { value: '45.25' } });
    fireEvent.change(screen.getByLabelText('affCurrencyLabel'), { target: { value: 'USDT' } });
    fireEvent.click(screen.getByRole('button', { name: 'affRecordPerfBtn' }));

    await waitFor(() =>
      expect(onRecord).toHaveBeenCalledWith({
        campaignId: 'pcmp_1',
        reportSource: 'Ledger CSV',
        reportPeriod: '2026-11',
        externalRefId: 'ref-999',
        clicksCount: 88,
        signupsCount: 9,
        qualifiedConversions: 3,
        pendingCommissionUsd: 15.5,
        confirmedCommissionUsd: 45.25,
        currency: 'USDT',
      }),
    );
  });
});
