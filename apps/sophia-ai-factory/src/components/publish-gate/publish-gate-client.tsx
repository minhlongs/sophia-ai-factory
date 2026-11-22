'use client';

/**
 * Compliance Publish Gate — Interactive Client Workflow (MOCK_ONLY).
 *
 * Drives the 3-phase flow: Prepare/Preflight -> Human Approval -> Idempotent Mock Execution.
 * Displays persistent MOCK_ONLY banner, immutable SHA-256 digest, fail-closed button guards,
 * and simulated receipt (never claims real publication or displays fake public URLs).
 *
 * @module components/publish-gate/publish-gate-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  PublishGateCompliance,
  PublishGatePlatform,
  PublishGateRecord,
} from '@/tree/publish-gate/types';
import { ComplianceControls } from './compliance-controls';

interface PublishGateClientProps {
  readonly orgId: string;
}

function readCsrfCookie(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function defaultComplianceForPlatform(
  platform: PublishGatePlatform,
): PublishGateCompliance {
  if (platform === 'youtube') {
    return {
      aiSyntheticDisclosure: true,
      commercialDisclosure: false,
      youtube: {
        privacyStatus: null,
        selfDeclaredMadeForKids: null,
        containsSyntheticMedia: null,
      },
    };
  }
  if (platform === 'instagram') {
    return {
      aiSyntheticDisclosure: true,
      commercialDisclosure: false,
      instagram: {
        accountType: 'BUSINESS',
        loginProvider: 'facebook_login',
        containerReady: true,
        isPaidPartnership: false,
        brandedContentSponsorIds: [],
        isCloseFriendsOnly: false,
      },
    };
  }
  return {
    aiSyntheticDisclosure: true,
    commercialDisclosure: false,
    tiktok: {
      privacyLevel: null,
      commercialContentToggle: false,
      brandOrganicToggle: false,
      brandContentToggle: false,
      isAigc: true,
      musicUsageConfirmed: false,
      brandedContentPolicyConfirmed: false,
      allowComment: true,
      allowDuet: false,
      allowStitch: false,
      useDraftInboxFallback: false,
    },
  };
}

const MUTABLE_STATES = new Set([
  'DRAFT',
  'PREFLIGHT_REQUIRED',
  'PREFLIGHT_BLOCKED',
  'READY_FOR_REVIEW',
  'AWAITING_HUMAN_APPROVAL',
  'APPROVED',
]);

export function PublishGateClient({ orgId }: PublishGateClientProps) {
  const t = useTranslations('publishGate');
  const [platform, setPlatform] = useState<PublishGatePlatform>('tiktok');
  const [caption, setCaption] = useState('Sophia Genesis compliance-checked campaign clip');
  const [title, setTitle] = useState('Sophia Compliance Demo');
  const [destinationAccountId, setDestinationAccountId] = useState('tt_unaudited_demo_01');
  const [compliance, setCompliance] = useState<PublishGateCompliance>(() =>
    defaultComplianceForPlatform('tiktok'),
  );
  const [record, setRecord] = useState<PublishGateRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const postAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/publish-gate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': readCsrfCookie(),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { record?: PublishGateRecord; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? `HTTP_${res.status}`);
        if (data.record) {
          setRecord(data.record);
        }
        return;
      }
      if (data.record) {
        setRecord(data.record);
      }
    } catch {
      setErrorMsg('NETWORK_ERROR');
    } finally {
      setBusy(false);
    }
  };

  const buildPayload = () => ({
    campaignId: `camp_${orgId || 'demo'}`,
    mediaArtifactId: 'artifact_b2_demo_v1',
    mediaContentDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    mediaDurationSec: 30,
    platform,
    destinationAccountId,
    destinationAccountHandle: `@${destinationAccountId}`,
    caption,
    title: platform === 'youtube' ? title : undefined,
    payloadVersion: 1,
    publicationMode: 'MOCK_ONLY' as const,
    compliance,
  });

  const handleCreate = () =>
    postAction({
      action: 'create',
      payload: buildPayload(),
    });

  const handleMutate = () => {
    if (!record) {
      return;
    }
    return postAction({
      action: 'mutate_payload',
      requestId: record.requestId,
      payload: buildPayload(),
    });
  };

  const allowedPrivacy = record?.capabilitySnapshot?.allowedPrivacyOptions ?? ['SELF_ONLY'];
  const approveDisabled =
    busy ||
    !record ||
    record.state !== 'AWAITING_HUMAN_APPROVAL' ||
    !record.approvalNonce ||
    allowedPrivacy.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm text-foreground"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('mockBannerTitle')}</p>
          <p className="text-muted-foreground">{t('mockBannerBody')}</p>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold text-foreground">{t('phaseATitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="pg-platform">
              {t('platformLabel')}
            </label>
            <select
              id="pg-platform"
              value={platform}
              onChange={(e) => {
                const next = e.target.value as PublishGatePlatform;
                setPlatform(next);
                setCompliance(defaultComplianceForPlatform(next));
                setRecord(null);
                setDestinationAccountId(
                  next === 'tiktok'
                    ? 'tt_unaudited_demo_01'
                    : next === 'youtube'
                      ? 'yt_channel_demo_01'
                      : 'ig_business_demo_01',
                );
              }}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="tiktok">TikTok (MOCK_ONLY)</option>
              <option value="youtube">YouTube (MOCK_ONLY)</option>
              <option value="instagram">Instagram (MOCK_ONLY)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="pg-account">
              {t('destinationAccountLabel')}
            </label>
            <input
              id="pg-account"
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        {platform === 'youtube' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground" htmlFor="pg-title">
              {t('videoTitleLabel')}
            </label>
            <input
              id="pg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="pg-caption">
            {t('captionLabel')}
          </label>
          <textarea
            id="pg-caption"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <ComplianceControls
          platform={platform}
          compliance={compliance}
          allowedPrivacyOptions={allowedPrivacy}
          onChange={setCompliance}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('createRequestButton')}
          </button>
          {record && MUTABLE_STATES.has(record.state) && (
            <button
              type="button"
              disabled={busy}
              onClick={handleMutate}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {t('updatePayloadButton')}
            </button>
          )}
          {record && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postAction({ action: 'preflight', requestId: record.requestId })}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {t('runPreflightButton')}
            </button>
          )}
        </div>
      </section>

      {errorMsg && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {record && (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('phaseBTitle')}
            </h2>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
              {record.state}
            </span>
          </div>

          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">{t('digestLabel')}</dt>
              <dd className="break-all font-mono">{record.payloadDigestSha256}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">{t('modeLabel')}</dt>
              <dd className="font-mono">{record.publicationMode}</dd>
            </div>
          </dl>

          {record.capabilitySnapshot && record.capabilitySnapshot.blockReasons.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-destructive">
              {record.capabilitySnapshot.blockReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            {record.state === 'READY_FOR_REVIEW' && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  postAction({ action: 'submit_for_approval', requestId: record.requestId })
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {t('submitForApprovalButton')}
              </button>
            )}
            {record.state === 'AWAITING_HUMAN_APPROVAL' && (
              <>
                <button
                  type="button"
                  disabled={approveDisabled}
                  onClick={() =>
                    postAction({
                      action: 'approve',
                      requestId: record.requestId,
                      approvalNonce: record.approvalNonce,
                      payloadDigestSha256: record.payloadDigestSha256,
                      approvalVersion: record.approvalVersion,
                    })
                  }
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t('approveButton')}
                </button>
                <button
                  type="button"
                  disabled={busy || !record.approvalNonce}
                  onClick={() =>
                    postAction({
                      action: 'reject',
                      requestId: record.requestId,
                      approvalNonce: record.approvalNonce,
                      payloadDigestSha256: record.payloadDigestSha256,
                      approvalVersion: record.approvalVersion,
                      rejectionReason: 'REJECTED_IN_UI',
                    })
                  }
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  {t('rejectButton')}
                </button>
              </>
            )}
            {record.state === 'APPROVED' && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  postAction({
                    action: 'execute_mock',
                    requestId: record.requestId,
                    payloadDigestSha256: record.payloadDigestSha256,
                  })
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {t('executeMockButton')}
              </button>
            )}
          </div>

          {record.mockReceipt && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                {t('receiptTitle')} ({record.mockReceipt.simulatedStatus})
              </p>
              <p className="text-muted-foreground">{record.mockReceipt.message}</p>
              <p className="font-mono text-muted-foreground">
                {record.mockReceipt.mockReceiptId}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
