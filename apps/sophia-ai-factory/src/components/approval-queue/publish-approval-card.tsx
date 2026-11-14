/**
 * Single public-publish approval card with channel, platform, unwatermarked video preview,
 * TikTok/YouTube compliance controls, optional reviewer note, and Approve / Reject actions.
 * @module components/approval-queue/publish-approval-card
 */

'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, X, Globe, Film, Clock } from 'lucide-react';
import { TikTokComplianceFields } from './tiktok-compliance-fields';
import type {
  PublishApprovalItem,
  PublishComplianceMetadata,
  TikTokPrivacyChoice,
} from './publish-queue-api';

interface PublishApprovalCardProps {
  item: PublishApprovalItem;
  busy: boolean;
  onDecide: (approvalId: string, approved: boolean, compliance?: PublishComplianceMetadata) => void;
}

function formatUnixSeconds(unixSec: number, locale: string): string {
  if (!unixSec || Number.isNaN(unixSec)) return '—';
  const ms = unixSec < 1e12 ? unixSec * 1000 : unixSec;
  return new Date(ms).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function PublishApprovalCard({ item, busy, onDecide }: PublishApprovalCardProps): React.ReactElement {
  const t = useTranslations('approvals');
  const locale = useLocale();
  const normalizedPlatform = (item.platform || '').toLowerCase();
  const isTikTok = normalizedPlatform === 'tiktok';
  const isYouTube = normalizedPlatform === 'youtube';

  const [privacyLevel, setPrivacyLevel] = useState<TikTokPrivacyChoice | ''>('');
  const [brandOrganicToggle, setBrandOrganicToggle] = useState(false);
  const [brandContentToggle, setBrandContentToggle] = useState(false);
  const [musicUsageConfirmed, setMusicUsageConfirmed] = useState(false);
  const [containsSyntheticMedia, setContainsSyntheticMedia] = useState(true);
  const [syntheticTouched, setSyntheticTouched] = useState(false);

  const approveDisabled = busy || (isTikTok && (privacyLevel === '' || !musicUsageConfirmed));
  const previewSrc = item.previewUrl ?? item.mediaRef;

  const buildCompliancePayload = (): PublishComplianceMetadata | undefined => {
    if (isTikTok && privacyLevel !== '' && musicUsageConfirmed) {
      return {
        privacyLevel,
        brandOrganicToggle,
        brandContentToggle,
        musicUsageConfirmed: true,
      };
    }
    if (isYouTube && syntheticTouched) return { containsSyntheticMedia };
    return undefined;
  };

  return (
    <article
      data-testid={`publish-approval-card-${item.id}`}
      className="rounded-xl border border-amber-500/30 bg-card p-6 shadow-sm transition-colors"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
              <Globe className="h-3.5 w-3.5" />
              {item.platform || t('publish.unknownPlatform')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {t('publish.pendingBadge')}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground">
            {t('publish.channelLabel')}: <span className="font-mono text-sm">{item.channelId}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('publish.requestedAt')}: {formatUnixSeconds(item.createdAt, locale)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span>{t('publish.expiresAt')}: {formatUnixSeconds(item.expiresAt, locale)}</span>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
        <div className="mb-1 flex items-center justify-between gap-2 font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            {t('publish.mediaLabel')}
          </span>
          <span className="text-muted-foreground">{t('publish.previewVideoLabel')}</span>
        </div>
        <p className="break-all font-mono text-foreground">{item.mediaRef}</p>
        <video
          controls
          preload="metadata"
          data-testid={`publish-preview-video-${item.id}`}
          src={previewSrc}
          className="mt-2 max-h-64 w-full rounded-md bg-background object-contain"
        />
      </div>

      {isTikTok && (
        <TikTokComplianceFields
          item={item}
          privacyLevel={privacyLevel}
          onPrivacyLevelChange={setPrivacyLevel}
          brandOrganicToggle={brandOrganicToggle}
          onBrandOrganicChange={setBrandOrganicToggle}
          brandContentToggle={brandContentToggle}
          onBrandContentChange={setBrandContentToggle}
          musicUsageConfirmed={musicUsageConfirmed}
          onMusicUsageConfirmedChange={setMusicUsageConfirmed}
        />
      )}

      {isYouTube && (
        <div
          data-testid={`youtube-compliance-controls-${item.id}`}
          className="mb-4 rounded-lg border border-border bg-secondary/20 p-3 text-xs"
        >
          <label className="inline-flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              data-testid={`youtube-synthetic-media-${item.id}`}
              checked={containsSyntheticMedia}
              onChange={(e) => {
                setContainsSyntheticMedia(e.target.checked);
                setSyntheticTouched(true);
              }}
            />
            <span>{t('publish.youtubeSyntheticLabel')}</span>
          </label>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor={`publish-reason-${item.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('reason')}
        </label>
        <textarea
          id={`publish-reason-${item.id}`}
          rows={2}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={approveDisabled}
          onClick={() => onDecide(item.id, true, buildCompliancePayload())}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {t('publish.approvePublish')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(item.id, false)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          {t('publish.rejectPublish')}
        </button>
      </div>
    </article>
  );
}
