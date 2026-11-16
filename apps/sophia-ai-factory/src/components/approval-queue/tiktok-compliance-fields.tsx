/**
 * TikTok Content Sharing Guidelines compliance controls for PublishApprovalCard.
 * Enforces creator_info display, explicit privacy_level selection (no default),
 * commercial content toggles, and mandatory Music Usage Confirmation consent.
 * @module components/approval-queue/tiktok-compliance-fields
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { PublishApprovalItem, TikTokPrivacyChoice } from './publish-queue-api';

const ALL_PRIVACY_CHOICES: readonly TikTokPrivacyChoice[] = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'SELF_ONLY',
];

const PRIVACY_LABEL_KEYS: Record<TikTokPrivacyChoice, string> = {
  PUBLIC_TO_EVERYONE: 'publish.privacyPublic',
  MUTUAL_FOLLOW_FRIENDS: 'publish.privacyFriends',
  SELF_ONLY: 'publish.privacySelfOnly',
};

export interface TikTokComplianceFieldsProps {
  item: PublishApprovalItem;
  privacyLevel: TikTokPrivacyChoice | '';
  onPrivacyLevelChange: (value: TikTokPrivacyChoice | '') => void;
  brandOrganicToggle: boolean;
  onBrandOrganicChange: (checked: boolean) => void;
  brandContentToggle: boolean;
  onBrandContentChange: (checked: boolean) => void;
  musicUsageConfirmed: boolean;
  onMusicUsageConfirmedChange: (checked: boolean) => void;
}

export function TikTokComplianceFields({
  item,
  privacyLevel,
  onPrivacyLevelChange,
  brandOrganicToggle,
  onBrandOrganicChange,
  brandContentToggle,
  onBrandContentChange,
  musicUsageConfirmed,
  onMusicUsageConfirmedChange,
}: TikTokComplianceFieldsProps): React.ReactElement {
  const t = useTranslations('approvals');
  const creatorInfo = item.creatorInfo;
  const allowedChoices = creatorInfo?.privacyLevelOptions?.length
    ? ALL_PRIVACY_CHOICES.filter((choice) => creatorInfo.privacyLevelOptions?.includes(choice))
    : ALL_PRIVACY_CHOICES;

  const lockedInteractions = [
    creatorInfo?.commentDisabled ? 'comment' : null,
    creatorInfo?.duetDisabled ? 'duet' : null,
    creatorInfo?.stitchDisabled ? 'stitch' : null,
  ].filter((val): val is string => Boolean(val));

  const hasCreatorMeta = Boolean(
    creatorInfo?.creatorNickname ||
      typeof creatorInfo?.maxVideoPostDurationSec === 'number' ||
      lockedInteractions.length > 0,
  );

  return (
    <div
      data-testid={`tiktok-compliance-controls-${item.id}`}
      className="mb-4 space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs"
    >
      {hasCreatorMeta && (
        <div
          data-testid={`tiktok-creator-info-${item.id}`}
          className="space-y-1 rounded-md border border-border bg-background/70 p-2.5"
        >
          {creatorInfo?.creatorNickname && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{t('publish.creatorNicknameLabel')}:</span>{' '}
              <span className="font-mono text-foreground">{creatorInfo.creatorNickname}</span>
            </p>
          )}
          {typeof creatorInfo?.maxVideoPostDurationSec === 'number' && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{t('publish.creatorMaxDurationLabel')}:</span>{' '}
              <span className="font-mono text-foreground">{creatorInfo.maxVideoPostDurationSec}s</span>
            </p>
          )}
          {lockedInteractions.length > 0 && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{t('publish.creatorInteractionsLocked')}:</span>{' '}
              <span className="font-mono text-amber-800 dark:text-amber-300">{lockedInteractions.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor={`tiktok-privacy-${item.id}`} className="mb-1 block font-semibold text-foreground">
          {t('publish.privacyLevelLabel')}
        </label>
        <select
          id={`tiktok-privacy-${item.id}`}
          data-testid={`tiktok-privacy-select-${item.id}`}
          value={privacyLevel}
          onChange={(e) => onPrivacyLevelChange(e.target.value as TikTokPrivacyChoice | '')}
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">{t('publish.privacyLevelPlaceholder')}</option>
          {allowedChoices.map((choice) => (
            <option key={choice} value={choice}>
              {t(PRIVACY_LABEL_KEYS[choice])}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
        <label className="inline-flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            data-testid={`tiktok-brand-organic-${item.id}`}
            checked={brandOrganicToggle}
            onChange={(e) => onBrandOrganicChange(e.target.checked)}
          />
          <span>{t('publish.brandOrganicLabel')}</span>
        </label>
        <label className="inline-flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            data-testid={`tiktok-brand-content-${item.id}`}
            checked={brandContentToggle}
            onChange={(e) => onBrandContentChange(e.target.checked)}
          />
          <span>{t('publish.brandContentLabel')}</span>
        </label>
      </div>

      <label className="flex items-start gap-2 font-medium text-foreground">
        <input
          type="checkbox"
          data-testid={`tiktok-music-consent-${item.id}`}
          checked={musicUsageConfirmed}
          onChange={(e) => onMusicUsageConfirmedChange(e.target.checked)}
          className="mt-0.5"
        />
        <span>{t('publish.musicConsentLabel')}</span>
      </label>

      {(privacyLevel === '' || !musicUsageConfirmed) && (
        <p data-testid={`tiktok-music-consent-hint-${item.id}`} className="text-amber-800 dark:text-amber-300">
          {t('publish.musicConsentRequiredHint')}
        </p>
      )}

      {(privacyLevel === 'SELF_ONLY' || item.unauditedSelfOnly) && (
        <div
          data-testid={`tiktok-self-only-warning-${item.id}`}
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('publish.selfOnlyWarning')}</span>
        </div>
      )}
    </div>
  );
}
