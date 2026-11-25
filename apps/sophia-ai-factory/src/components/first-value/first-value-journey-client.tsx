'use client';

/**
 * Interactive client surface for the BASIC First-Value Journey & Private Beta.
 *
 * Calls /api/first-value over HTTP with CSRF headers and stable idempotency keys.
 *
 * @module components/first-value/first-value-journey-client
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { getCsrfHeaders } from '@/seed/security/use-csrf-token';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';
import type {
  PilotAffiliateLinkSummary,
  PilotStatusSnapshot,
} from '@/seed/pilot/pilot-access-policy';
import { FirstValueByokCard } from './first-value-byok-card';
import {
  FirstValueFeedbackCard,
  type PilotFeedbackCategory,
} from './first-value-feedback-card';
import { FirstValueManualPublishCard } from './first-value-manual-publish-card';
import { FirstValueMp4AffiliateCard } from './first-value-mp4-affiliate-card';
import { FirstValuePilotBanner } from './first-value-pilot-banner';
import { FirstValueReviewPanel } from './first-value-review-panel';
import {
  FirstValueSupportCard,
  type SupportRequestKind,
  type SupportSubmissionReceipt,
} from './first-value-support-card';

interface StatusResponse {
  readonly byokConfigured: boolean;
  readonly configuredProviders: readonly string[];
  readonly receipt: HonestValidationReceipt | null;
  readonly recentReviews: readonly DurableFirstValueReview[];
  readonly pilot?: PilotStatusSnapshot;
}

function CostPreviewBox({ costPreview }: { readonly costPreview: FirstValueCostPreview }) {
  const t = useTranslations('firstValue');
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs">
      {costPreview.status === 'COST_ESTIMATE_AVAILABLE' ? (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('costEstimated')}</dt>
            <dd className="font-mono font-semibold text-foreground">
              ${costPreview.estimatedCostRangeUsd.minUsd.toFixed(6)} – $
              {costPreview.estimatedCostRangeUsd.maxUsd.toFixed(6)} USD
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('costSource')}</dt>
            <dd className="truncate font-mono text-foreground">{costPreview.priceSource}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('costTimestamp')}</dt>
            <dd className="font-mono text-foreground">{costPreview.priceUpdatedAt}</dd>
          </div>
        </dl>
      ) : (
        <div>
          <div className="font-semibold text-amber-600 dark:text-amber-400">
            {t('costUnavailableTitle')} ({costPreview.status})
          </div>
          <p className="mt-1 text-muted-foreground">{t('costUnavailableDesc')}</p>
        </div>
      )}
    </div>
  );
}

interface CostFormProps {
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly model: string;
  readonly modelLocked: boolean;
  readonly busy: boolean;
  readonly topicInvalid: boolean;
  readonly audienceInvalid: boolean;
  readonly canPreview: boolean;
  readonly canCreate: boolean;
  readonly costPreview: FirstValueCostPreview | null;
  readonly onTopicChange: (v: string) => void;
  readonly onAudienceChange: (v: string) => void;
  readonly onDurationChange: (v: number) => void;
  readonly onModelChange: (v: string) => void;
  readonly onPreviewCost: () => void;
  readonly onCreateReview: () => void;
}

function CostPreviewSection(props: CostFormProps) {
  const t = useTranslations('firstValue');
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">
        {props.modelLocked ? t('pilotBriefTitle') : t('costTitle')}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('topicLabel')}
          <input
            value={props.topic}
            required
            maxLength={500}
            aria-invalid={props.topicInvalid}
            aria-describedby={props.topicInvalid ? 'first-value-topic-error' : undefined}
            onChange={(e) => props.onTopicChange(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          {props.topicInvalid && (
            <span id="first-value-topic-error" role="alert" className="text-xs text-destructive">
              {t('topicRequired')}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('audienceLabel')}
          <input
            value={props.audience}
            required
            maxLength={300}
            aria-invalid={props.audienceInvalid}
            aria-describedby={props.audienceInvalid ? 'first-value-audience-error' : undefined}
            onChange={(e) => props.onAudienceChange(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          {props.audienceInvalid && (
            <span id="first-value-audience-error" role="alert" className="text-xs text-destructive">
              {t('audienceRequired')}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('durationLabel')}
          <input
            type="number"
            min={10}
            max={300}
            value={props.durationSec}
            onChange={(e) => props.onDurationChange(Number(e.target.value))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {props.modelLocked ? t('pilotModelLockedLabel') : t('modelLabel')}
          <input
            value={props.model}
            readOnly={props.modelLocked}
            onChange={(e) => {
              if (!props.modelLocked) props.onModelChange(e.target.value);
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground read-only:opacity-80"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={props.busy || !props.canPreview}
          onClick={props.onPreviewCost}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {props.busy ? t('loading') : t('previewCostBtn')}
        </button>
        <button
          type="button"
          disabled={props.busy || !props.canCreate}
          onClick={props.onCreateReview}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {props.busy
            ? t('loading')
            : props.modelLocked
              ? t('pilotGenerateBtn')
              : t('createReviewBtn')}
        </button>
      </div>
      {props.costPreview && <CostPreviewBox costPreview={props.costPreview} />}
    </section>
  );
}

export function FirstValueJourneyClient({
  orgId,
  initialPilotMode = false,
}: {
  readonly orgId: string;
  readonly initialPilotMode?: boolean;
}) {
  const t = useTranslations('firstValue');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [costPreview, setCostPreview] = useState<FirstValueCostPreview | null>(null);
  const [activeReview, setActiveReview] = useState<DurableFirstValueReview | null>(null);
  const [exportPayload, setExportPayload] = useState<string | null>(null);
  const [topic, setTopic] = useState('How non-technical CEOs launch daily short-form content');
  const [audience, setAudience] = useState('SMB Founders');
  const [durationSec, setDurationSec] = useState(30);
  const [model, setModel] = useState(
    initialPilotMode ? 'openai/gpt-4o-mini' : 'google/gemini-2-5-flash',
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/first-value?orgId=${encodeURIComponent(orgId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = (await res.json()) as StatusResponse;
    setStatus(data);
    if (data.pilot?.liveInferenceEnabled && data.pilot.modelId) {
      setModel(data.pilot.modelId);
    }
    setActiveReview((prev) => prev ?? data.recentReviews[0] ?? null);
  }, [orgId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function postAction(body: Record<string, unknown>, idempotencyKey?: string) {
    setBusy(true);
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      };
      const res = await fetch('/api/first-value', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setErrorMessage(String(json.error ?? `HTTP ${res.status}`));
        return null;
      }
      return json;
    } finally {
      setBusy(false);
    }
  }

  const pilot = status?.pilot ?? null;
  const isLivePilot = pilot ? Boolean(pilot.liveInferenceEnabled) : initialPilotMode;
  const isCustomerByokPilot = pilot
    ? Boolean(
        isLivePilot &&
          (pilot.financingMode === 'CUSTOMER_BYOK' || pilot.fundingMode === 'customer_byok'),
      )
    : initialPilotMode;
  const effectiveByokConfigured = isCustomerByokPilot
    ? Boolean(pilot?.byokKeyConfigured ?? status?.byokConfigured)
    : Boolean(status?.byokConfigured);

  async function handleSavePilotKey(apiKey: string): Promise<boolean> {
    const data = await postAction({
      action: 'save_byok_key',
      orgId,
      apiKey,
    });
    if (data?.byokConfigured) {
      await loadStatus();
      return true;
    }
    return false;
  }

  async function handleClearPilotKey(): Promise<boolean> {
    const data = await postAction({
      action: 'clear_byok_key',
      orgId,
    });
    if (data && data.byokConfigured === false) {
      await loadStatus();
      return true;
    }
    return false;
  }

  async function handleSaveHeyGenKey(apiKey: string): Promise<boolean> {
    const data = await postAction({
      action: 'save_byok_key',
      orgId,
      provider: 'heygen',
      apiKey,
    });
    if (data?.heygenByokConfigured) {
      await loadStatus();
      return true;
    }
    return false;
  }

  async function handleClearHeyGenKey(): Promise<boolean> {
    const data = await postAction({
      action: 'clear_byok_key',
      orgId,
      provider: 'heygen',
    });
    if (data && data.heygenByokConfigured === false) {
      await loadStatus();
      return true;
    }
    return false;
  }

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
    const data = await postAction({
      action: 'create_affiliate_shortlink',
      orgId,
      artifactId: activeReview?.artifactId ?? null,
      destinationUrl: input.destinationUrl,
      ctaText: input.ctaText,
      networkHint: input.networkHint,
      disclosureTag: input.disclosureTag,
    });
    const link = data?.affiliateLink as PilotAffiliateLinkSummary | undefined;
    if (link?.id) {
      await loadStatus();
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
    const data = await postAction({
      action: 'record_mp4_export',
      orgId,
      ...input,
    });
    if (data?.mp4Export) {
      await loadStatus();
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
    const data = await postAction({
      action: 'submit_heygen_mp4',
      orgId,
      ...input,
    });
    if (data?.mp4Export) {
      await loadStatus();
      return true;
    }
    return false;
  }

  async function handlePollHeyGenMp4(exportId: string): Promise<void> {
    const data = await postAction({
      action: 'poll_heygen_mp4',
      orgId,
      exportId,
    });
    if (data?.mp4Export) {
      await loadStatus();
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
    const data = await postAction({
      action: 'record_manual_publish',
      orgId,
      ...input,
    });
    if (data?.manualPublish) {
      await loadStatus();
      return true;
    }
    return false;
  }

  async function handleSubmitSupportRequest(input: {
    readonly requestType: SupportRequestKind;
    readonly subject: string;
    readonly details: string;
  }): Promise<SupportSubmissionReceipt | null> {
    const data = await postAction({
      action: 'submit_support_request',
      orgId,
      requestType: input.requestType,
      subject: input.subject,
      message: input.details,
    });
    const ack = data?.acknowledgment as SupportSubmissionReceipt | undefined;
    if (ack?.requestId) {
      await loadStatus();
      return ack;
    }
    return null;
  }

  async function handleCostPreview() {
    if (!topic.trim() || !audience.trim()) return;
    const data = await postAction({
      action: 'cost_preview',
      orgId,
      provider: status?.configuredProviders[0] ?? 'openrouter',
      model: model.trim() ? model.trim() : null,
      topic: topic.trim(),
      audience: audience.trim(),
      durationSec,
    });
    if (data?.preview) setCostPreview(data.preview as FirstValueCostPreview);
  }

  async function handleAcceptPilotTerms() {
    if (!pilot) return;
    const data = await postAction({
      action: 'accept_pilot_terms',
      orgId,
      policyVersion: pilot.policyVersion,
      accepted: true,
    });
    if (data?.consent) {
      await loadStatus();
    }
  }

  async function handleCreateReview() {
    if (!topic.trim() || !audience.trim()) return;
    if (!isLivePilot && !status?.receipt) return;
    if (isLivePilot && !pilot?.consentAccepted) return;
    const key = `fv-create-${crypto.randomUUID()}`;
    const data = await postAction(
      {
        action: 'create_review',
        orgId,
        missionId: isLivePilot ? `mission_${orgId}_pilot` : `mission_${orgId}_b1`,
        idempotencyKey: key,
        topic: topic.trim(),
        audience: audience.trim(),
        durationSec,
        provenance: isLivePilot ? 'live_provider' : 'fixture_simulated',
        ...(status?.receipt ? { receipt: status.receipt } : {}),
      },
      key,
    );
    if (data?.review) {
      setActiveReview(data.review as DurableFirstValueReview);
      setExportPayload(null);
      if (isLivePilot) {
        await loadStatus();
      }
    }
  }

  async function handleEditReview(script: ScriptOutput): Promise<boolean> {
    if (!activeReview) return false;
    const key = `fv-edit-${crypto.randomUUID()}`;
    const data = await postAction(
      {
        action: 'edit_review',
        orgId,
        artifactId: activeReview.artifactId,
        expectedVersion: activeReview.version,
        script,
        idempotencyKey: key,
      },
      key,
    );
    if (data?.review) {
      setActiveReview(data.review as DurableFirstValueReview);
      return true;
    }
    return false;
  }

  async function handleSubmitFeedback(input: {
    readonly rating: number;
    readonly category: PilotFeedbackCategory;
    readonly comment: string;
  }): Promise<boolean> {
    const data = await postAction({
      action: 'submit_feedback',
      orgId,
      artifactId: activeReview?.artifactId ?? null,
      rating: input.rating,
      category: input.category,
      comment: input.comment,
    });
    return Boolean(data?.feedback);
  }

  async function handleDecision(decision: 'accept_review' | 'reject_review', reason?: string) {
    if (!activeReview) return;
    const trimmedReason = reason?.trim();
    const key = `fv-${decision}-${crypto.randomUUID()}`;
    const data = await postAction(
      {
        action: decision,
        orgId,
        artifactId: activeReview.artifactId,
        expectedVersion: activeReview.version,
        explicitUserAction: true,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
        idempotencyKey: key,
      },
      key,
    );
    if (data?.review) setActiveReview(data.review as DurableFirstValueReview);
  }

  async function handleExport(format: 'json' | 'markdown') {
    if (!activeReview) return;
    const key = `fv-export-${crypto.randomUUID()}`;
    const data = await postAction(
      {
        action: 'private_export',
        orgId,
        artifactId: activeReview.artifactId,
        format,
        idempotencyKey: key,
      },
      key,
    );
    const exported = data?.export as { content?: unknown } | undefined;
    if (exported?.content !== undefined) {
      setExportPayload(
        typeof exported.content === 'string'
          ? exported.content
          : JSON.stringify(exported.content, null, 2),
      );
    }
  }

  const topicInvalid = topic.trim().length === 0;
  const audienceInvalid = audience.trim().length === 0;
  const inputsValid = !topicInvalid && !audienceInvalid;
  const pilotFundingReady = isCustomerByokPilot
    ? effectiveByokConfigured
    : pilot?.fundingMode === 'founder_sponsored';
  const canCreate = isLivePilot
    ? Boolean(
        orgId &&
          inputsValid &&
          pilot?.consentAccepted &&
          pilotFundingReady &&
          pilot.quota.remainingGenerations > 0,
      )
    : Boolean(orgId && status?.receipt && inputsValid);

  return (
    <div className="flex flex-col gap-6">
      {isLivePilot && pilot ? (
        <FirstValuePilotBanner
          pilot={pilot}
          busy={busy}
          onAcceptTerms={handleAcceptPilotTerms}
        />
      ) : !isLivePilot ? (
        <div className="rounded-xl border border-amber-500/40 bg-muted/40 p-4">
          <div className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            {t('simulatedBadge')}
          </div>
          <p className="mt-1 text-sm text-foreground">{t('simulatedNotice')}</p>
        </div>
      ) : null}

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <strong>{t('errorPrefix')}:</strong> {errorMessage}
        </div>
      )}

      <FirstValueByokCard
        byokConfigured={effectiveByokConfigured}
        receipt={status?.receipt ?? null}
        isCustomerByokPilot={isCustomerByokPilot}
        busy={busy}
        onSavePilotKey={handleSavePilotKey}
        onClearPilotKey={handleClearPilotKey}
      />

      <CostPreviewSection
        topic={topic}
        audience={audience}
        durationSec={durationSec}
        model={model}
        modelLocked={isLivePilot}
        busy={busy}
        topicInvalid={topicInvalid}
        audienceInvalid={audienceInvalid}
        canPreview={Boolean(orgId && inputsValid)}
        canCreate={canCreate}
        costPreview={costPreview}
        onTopicChange={setTopic}
        onAudienceChange={setAudience}
        onDurationChange={setDurationSec}
        onModelChange={setModel}
        onPreviewCost={() => void handleCostPreview()}
        onCreateReview={() => void handleCreateReview()}
      />

      <FirstValueReviewPanel
        review={activeReview}
        busy={busy}
        exportPayload={exportPayload}
        onAccept={() => handleDecision('accept_review')}
        onReject={(reason) => handleDecision('reject_review', reason)}
        onExport={handleExport}
        onEdit={handleEditReview}
      />

      {isLivePilot && (
        <>
          <FirstValueMp4AffiliateCard
            review={activeReview}
            busy={busy}
            consentAccepted={Boolean(pilot?.consentAccepted)}
            heygenConfigured={Boolean(pilot?.heygenByokConfigured)}
            affiliateLinks={pilot?.affiliateLinks ?? []}
            mp4Exports={pilot?.mp4Exports ?? []}
            onCreateShortlink={handleCreateAffiliateShortlink}
            onRecordBrowserMp4={handleRecordBrowserMp4}
            onSaveHeyGenKey={handleSaveHeyGenKey}
            onClearHeyGenKey={handleClearHeyGenKey}
            onSubmitHeyGenMp4={handleSubmitHeyGenMp4}
            onPollHeyGenMp4={handlePollHeyGenMp4}
          />
          <FirstValueManualPublishCard
            review={activeReview}
            busy={busy}
            consentAccepted={Boolean(pilot?.consentAccepted)}
            affiliateLinks={pilot?.affiliateLinks ?? []}
            mp4Exports={pilot?.mp4Exports ?? []}
            manualPublishes={pilot?.manualPublishes ?? []}
            onRecordManualPublish={handleRecordManualPublish}
          />
          <FirstValueFeedbackCard
            busy={busy}
            artifactId={activeReview?.artifactId ?? null}
            onSubmitFeedback={handleSubmitFeedback}
          />
          <FirstValueSupportCard
            busy={busy}
            requests={pilot?.supportRequests ?? []}
            onSubmitRequest={handleSubmitSupportRequest}
          />
        </>
      )}
    </div>
  );
}
