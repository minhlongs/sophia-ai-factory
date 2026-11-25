'use client';

/**
 * Affiliate Campaign Studio Container (Steps 0–6 for Private Beta).
 *
 * Orchestrates:
 * - Overview (`#overview`)
 * - Step 1: Customer BYOK OpenRouter API Key (`#api-keys`)
 * - Steps 2 & 3: Crypto / SaaS Vertical + Affiliate Offer (`#affiliate-offers`)
 * - Step 4: AI Campaign Generator (`#campaigns`)
 * - Step 5: Content Workspace — Edit, Save, Approve, Export (`#content-factory`)
 * - Step 6: Revenue Analytics & Partner Performance Ledger (`#revenue-analytics`)
 * - Feedback + Support & Data Deletion (`#support-deletion`)
 *
 * @module components/first-value/affiliate-studio/affiliate-campaign-studio
 */

import { useState } from 'react';
import type {
  AffiliateRevenueSnapshot,
  AffiliateStudioSnapshot,
} from '@/land/first-value/pilot-affiliate-studio-revenue';
import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import type {
  PilotAffiliateLinkSummary,
  PilotStatusSnapshot,
} from '@/seed/pilot/pilot-access-policy';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';
import type { PilotAffiliateCampaignRecord } from '@/tree/first-value/pilot-affiliate-studio-repo';
import { FirstValueByokCard } from '../first-value-byok-card';
import {
  FirstValueFeedbackCard,
  type PilotFeedbackCategory,
} from '../first-value-feedback-card';
import { FirstValueManualPublishCard } from '../first-value-manual-publish-card';
import { FirstValueMp4AffiliateCard } from '../first-value-mp4-affiliate-card';
import { FirstValuePilotBanner } from '../first-value-pilot-banner';
import {
  FirstValueSupportCard,
  type SupportRequestKind,
  type SupportSubmissionReceipt,
} from '../first-value-support-card';
import {
  AffiliateCampaignGeneratorCard,
  resolveDefaultContentLocaleForMarket,
  type CampaignContentLocale,
} from './affiliate-campaign-generator-card';
import { AffiliateContentWorkspaceCard } from './affiliate-content-workspace-card';
import { AffiliateOffersCard, type NewAffiliateOfferInput } from './affiliate-offers-card';
import { AffiliateOverviewCard } from './affiliate-overview-card';
import {
  AffiliateRevenueDashboardCard,
  type RecordPerformanceFormInput,
} from './affiliate-revenue-dashboard-card';

const EMPTY_REVENUE: AffiliateRevenueSnapshot = {
  partnerFeedStatus: 'NOT_CONNECTED',
  connectedNetworks: [],
  totalCampaigns: 0,
  approvedCampaigns: 0,
  clicksCount: null,
  clicksSource: 'NOT_CONNECTED',
  signupsCount: 0,
  qualifiedConversions: 0,
  pendingCommissionUsd: 0,
  confirmedCommissionUsd: 0,
  estimatedAiCostUsd: 0,
  netRevenueUsd: 0,
  currency: 'USD',
  isMultiCurrency: false,
  domainBReconciliation: null,
};

export interface AffiliateCampaignStudioProps {
  readonly orgId: string;
  readonly pilot: PilotStatusSnapshot | null;
  readonly studio: AffiliateStudioSnapshot | null;
  readonly fallbackReview?: DurableFirstValueReview | null;
  readonly byokConfigured: boolean;
  readonly receipt: HonestValidationReceipt | null;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly errorPrefix: string;
  readonly postAction: (
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ) => Promise<Record<string, unknown> | null>;
  readonly onReloadStatus: () => Promise<void>;
  readonly onAcceptPilotTerms: () => Promise<void>;
  readonly onSavePilotKey: (apiKey: string) => Promise<boolean>;
  readonly onClearPilotKey: () => Promise<boolean>;
  readonly onSubmitFeedback: (input: {
    readonly rating: number;
    readonly category: PilotFeedbackCategory;
    readonly comment: string;
    readonly screenshotDataUrl?: string | null;
  }) => Promise<boolean>;
  readonly onSubmitSupportRequest: (input: {
    readonly requestType: SupportRequestKind;
    readonly subject: string;
    readonly details: string;
  }) => Promise<SupportSubmissionReceipt | null>;
}

export function AffiliateCampaignStudio(props: AffiliateCampaignStudioProps) {
  const offers = props.studio?.offers ?? [];
  const campaigns = props.studio?.campaigns ?? [];
  const entries = props.studio?.performanceEntries ?? [];
  const revenue = props.studio?.revenue ?? EMPTY_REVENUE;

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [exportPayload, setExportPayload] = useState<string | null>(null);

  const activeOffer =
    offers.find((o) => o.id === selectedOfferId) ?? offers[0] ?? null;
  const activeCampaign: PilotAffiliateCampaignRecord | null =
    campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0] ?? null;

  const canGenerate = Boolean(
    props.orgId &&
      activeOffer &&
      props.pilot?.consentAccepted &&
      props.byokConfigured &&
      (props.pilot?.quota.remainingGenerations ?? 0) > 0,
  );

  async function handleSaveOffer(input: NewAffiliateOfferInput): Promise<boolean> {
    const res = await props.postAction({
      action: 'save_affiliate_offer',
      orgId: props.orgId,
      ...input,
    });
    const saved = res?.offer as { id?: string } | undefined;
    if (saved?.id) {
      setSelectedOfferId(saved.id);
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleArchiveOffer(offerId: string): Promise<boolean> {
    const res = await props.postAction({
      action: 'archive_affiliate_offer',
      orgId: props.orgId,
      offerId,
    });
    if (res?.archived) {
      if (selectedOfferId === offerId) setSelectedOfferId(null);
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleGenerateCampaign(
    durationSec: number,
    contentLocale?: CampaignContentLocale,
  ): Promise<void> {
    if (!activeOffer) return;
    const effectiveLocale =
      contentLocale ?? resolveDefaultContentLocaleForMarket(activeOffer.targetMarket);
    const key = `aff-gen-${crypto.randomUUID()}`;
    const res = await props.postAction(
      {
        action: 'generate_affiliate_campaign',
        orgId: props.orgId,
        offerId: activeOffer.id,
        durationSec,
        locale: effectiveLocale,
        provenance: 'live_provider',
        idempotencyKey: key,
      },
      key,
    );
    const created = res?.campaign as PilotAffiliateCampaignRecord | undefined;
    if (created?.id) {
      setSelectedCampaignId(created.id);
      setExportPayload(null);
      await props.onReloadStatus();
    }
  }

  async function handleSaveEdit(pack: AffiliateCampaignPack): Promise<boolean> {
    if (!activeCampaign) return false;
    const effectiveLocale = resolveDefaultContentLocaleForMarket(activeCampaign.targetMarket);
    const key = `aff-edit-${crypto.randomUUID()}`;
    const res = await props.postAction(
      {
        action: 'edit_affiliate_campaign',
        orgId: props.orgId,
        campaignId: activeCampaign.id,
        expectedVersion: activeCampaign.version,
        pack,
        locale: effectiveLocale,
        idempotencyKey: key,
      },
      key,
    );
    if (res?.campaign) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleApprove(): Promise<boolean> {
    if (!activeCampaign) return false;
    const key = `aff-approve-${crypto.randomUUID()}`;
    const res = await props.postAction(
      {
        action: 'approve_affiliate_campaign',
        orgId: props.orgId,
        campaignId: activeCampaign.id,
        expectedVersion: activeCampaign.version,
        explicitUserAction: true,
        idempotencyKey: key,
      },
      key,
    );
    if (res?.campaign) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleExport(format: 'markdown' | 'json'): Promise<void> {
    if (!activeCampaign) return;
    const key = `aff-export-${crypto.randomUUID()}`;
    const res = await props.postAction(
      {
        action: 'export_affiliate_campaign',
        orgId: props.orgId,
        campaignId: activeCampaign.id,
        format,
        idempotencyKey: key,
      },
      key,
    );
    const exp = res?.export as { content?: unknown } | undefined;
    if (exp?.content !== undefined) {
      setExportPayload(
        typeof exp.content === 'string'
          ? exp.content
          : JSON.stringify(exp.content, null, 2),
      );
    }
  }

  async function handleRecordPerformance(input: RecordPerformanceFormInput): Promise<boolean> {
    const res = await props.postAction({
      action: 'record_partner_performance',
      orgId: props.orgId,
      ...input,
    });
    if (res?.performanceEntry) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  const videoScriptReview: DurableFirstValueReview | null = activeCampaign
    ? {
        artifactId: activeCampaign.id,
        orgId: activeCampaign.orgId,
        userId: activeCampaign.userId,
        missionId: activeCampaign.offerId,
        idempotencyKey: activeCampaign.idempotencyKey,
        payloadHash: activeCampaign.payloadHash,
        reviewState:
          activeCampaign.reviewState === 'approved'
            ? 'accepted'
            : activeCampaign.reviewState === 'rejected'
              ? 'rejected'
              : 'pending_review',
        version: activeCampaign.version,
        provenance: activeCampaign.provenance,
        provenanceLabel: activeCampaign.provenanceLabel,
        topic: activeCampaign.campaignName,
        audience: activeCampaign.targetMarket,
        durationSec: activeCampaign.pack.shortFormScript.total_duration,
        publicPublished: false,
        mcuCharged: 0,
        mcuAccountingRef: 'pilot:customer_byok',
        privateArtifactRef: `private://${activeCampaign.orgId}/campaign/${activeCampaign.id}`,
        receiptId: 'pilot:customer_byok',
        script: activeCampaign.pack.shortFormScript,
        acceptedAtIso: activeCampaign.approvedAtIso,
        acceptedByUserId: activeCampaign.approvedByUserId,
        rejectedAtIso: activeCampaign.rejectedAtIso,
        rejectionReason: activeCampaign.rejectionReason,
        createdAtIso: activeCampaign.createdAtIso,
        updatedAtIso: activeCampaign.updatedAtIso,
      }
    : (props.fallbackReview ?? null);

  async function handleCreateAffiliateShortlink(input: {
    readonly destinationUrl: string;
    readonly ctaText: string;
    readonly networkHint:
      | 'generic'
      | 'shopee'
      | 'tiktok_shop'
      | 'accesstrade'
      | 'clickbank'
      | 'amazon'
      | 'awin';
    readonly disclosureTag: '#QuảngCáo' | '#ad';
  }): Promise<PilotAffiliateLinkSummary | null> {
    const res = await props.postAction({
      action: 'create_affiliate_shortlink',
      orgId: props.orgId,
      artifactId: videoScriptReview?.artifactId ?? null,
      ...input,
    });
    const link = res?.affiliateLink as PilotAffiliateLinkSummary | undefined;
    if (link?.id) {
      await props.onReloadStatus();
      return link;
    }
    return null;
  }

  async function handleRecordBrowserMp4(input: {
    readonly artifactId: string;
    readonly sha256Hex: string;
    readonly byteSize: number;
    readonly durationSec: number;
    readonly width: number;
    readonly height: number;
    readonly ctaText: string;
    readonly shortCode: string;
    readonly referralUrl: string;
  }): Promise<boolean> {
    const res = await props.postAction({
      action: 'record_mp4_export',
      orgId: props.orgId,
      ...input,
    });
    if (res?.mp4Export) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleSaveHeyGenKey(apiKey: string): Promise<boolean> {
    const res = await props.postAction({
      action: 'save_byok_key',
      orgId: props.orgId,
      provider: 'heygen',
      apiKey,
    });
    if (res?.heygenByokConfigured) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleClearHeyGenKey(): Promise<boolean> {
    const res = await props.postAction({
      action: 'clear_byok_key',
      orgId: props.orgId,
      provider: 'heygen',
    });
    if (res && res.heygenByokConfigured === false) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handleSubmitHeyGenMp4(input: {
    readonly artifactId: string;
    readonly ctaText: string;
    readonly shortCode: string;
    readonly referralUrl: string;
  }): Promise<boolean> {
    const res = await props.postAction({
      action: 'submit_heygen_mp4',
      orgId: props.orgId,
      ...input,
    });
    if (res?.mp4Export) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  async function handlePollHeyGenMp4(exportId: string): Promise<void> {
    const res = await props.postAction({
      action: 'poll_heygen_mp4',
      orgId: props.orgId,
      exportId,
    });
    if (res?.mp4Export) {
      await props.onReloadStatus();
    }
  }

  async function handleRecordManualPublish(input: {
    readonly artifactId: string | null;
    readonly mp4ExportId: string | null;
    readonly linkId: string | null;
    readonly platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'other';
    readonly publishedPostUrl: string;
    readonly reportedViews: number | null;
    readonly reportedConversions: number | null;
    readonly reportedCommissionAmount: number | null;
    readonly reportedCommissionCurrency: 'VND' | 'USD' | 'USDT' | null;
    readonly evidenceNote: string | null;
  }): Promise<boolean> {
    const res = await props.postAction({
      action: 'record_manual_publish',
      orgId: props.orgId,
      ...input,
    });
    if (res?.manualPublish) {
      await props.onReloadStatus();
      return true;
    }
    return false;
  }

  return (
    <div className="flex flex-col gap-6">
      {props.pilot && (
        <FirstValuePilotBanner
          pilot={props.pilot}
          busy={props.busy}
          onAcceptTerms={props.onAcceptPilotTerms}
        />
      )}

      {props.errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <strong>{props.errorPrefix}:</strong> {props.errorMessage}
        </div>
      )}

      <AffiliateOverviewCard
        byokConfigured={props.byokConfigured}
        offersCount={offers.length}
        revenue={revenue}
      />

      <div id="api-keys">
        <FirstValueByokCard
          byokConfigured={props.byokConfigured}
          receipt={props.receipt}
          isCustomerByokPilot
          busy={props.busy}
          onSavePilotKey={props.onSavePilotKey}
          onClearPilotKey={props.onClearPilotKey}
        />
      </div>

      <AffiliateOffersCard
        offers={offers}
        selectedOfferId={activeOffer?.id ?? null}
        busy={props.busy}
        onSelectOffer={setSelectedOfferId}
        onSaveOffer={handleSaveOffer}
        onArchiveOffer={handleArchiveOffer}
      />

      <AffiliateCampaignGeneratorCard
        selectedOffer={activeOffer}
        campaigns={campaigns}
        activeCampaignId={activeCampaign?.id ?? null}
        modelId={props.pilot?.modelId ?? 'openai/gpt-4o-mini'}
        canGenerate={canGenerate}
        busy={props.busy}
        onSelectCampaign={(id) => {
          setSelectedCampaignId(id);
          setExportPayload(null);
        }}
        onGenerate={handleGenerateCampaign}
      />

      <AffiliateContentWorkspaceCard
        campaign={activeCampaign}
        exportPayload={exportPayload}
        busy={props.busy}
        onSaveEdit={handleSaveEdit}
        onApprove={handleApprove}
        onExport={handleExport}
      />

      <FirstValueMp4AffiliateCard
        review={videoScriptReview}
        busy={props.busy}
        consentAccepted={Boolean(props.pilot?.consentAccepted)}
        defaultDestinationUrl={activeCampaign?.referralUrl ?? activeOffer?.referralUrl ?? ''}
        defaultCtaText={activeCampaign?.pack.callToAction ?? ''}
        heygenConfigured={Boolean(props.pilot?.heygenByokConfigured)}
        affiliateLinks={props.pilot?.affiliateLinks ?? []}
        mp4Exports={props.pilot?.mp4Exports ?? []}
        onCreateShortlink={handleCreateAffiliateShortlink}
        onRecordBrowserMp4={handleRecordBrowserMp4}
        onSaveHeyGenKey={handleSaveHeyGenKey}
        onClearHeyGenKey={handleClearHeyGenKey}
        onSubmitHeyGenMp4={handleSubmitHeyGenMp4}
        onPollHeyGenMp4={handlePollHeyGenMp4}
      />

      <FirstValueManualPublishCard
        review={videoScriptReview}
        busy={props.busy}
        consentAccepted={Boolean(props.pilot?.consentAccepted)}
        affiliateLinks={props.pilot?.affiliateLinks ?? []}
        mp4Exports={props.pilot?.mp4Exports ?? []}
        manualPublishes={props.pilot?.manualPublishes ?? []}
        onRecordManualPublish={handleRecordManualPublish}
      />

      <AffiliateRevenueDashboardCard
        revenue={revenue}
        campaigns={campaigns}
        entries={entries}
        busy={props.busy}
        onRecordPerformance={handleRecordPerformance}
      />

      <FirstValueFeedbackCard
        busy={props.busy}
        artifactId={activeCampaign?.id ?? null}
        onSubmitFeedback={props.onSubmitFeedback}
      />

      <FirstValueSupportCard
        busy={props.busy}
        requests={props.pilot?.supportRequests ?? []}
        onSubmitRequest={props.onSubmitSupportRequest}
      />
    </div>
  );
}
