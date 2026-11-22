'use client';

/**
 * Platform-specific fail-closed compliance controls for Compliance Publish Gate.
 *
 * Enforces explicit human selection (never defaults privacy to public or falls back
 * to open choices when creator_info returns empty privacy options).
 *
 * @module components/publish-gate/compliance-controls
 */

import { useTranslations } from 'next-intl';
import type {
  PublishGateCompliance,
  PublishGatePlatform,
  TikTokPrivacyLevel,
  YouTubePrivacyStatus,
} from '@/tree/publish-gate/types';

interface ComplianceControlsProps {
  readonly platform: PublishGatePlatform;
  readonly compliance: PublishGateCompliance;
  readonly allowedPrivacyOptions: readonly string[];
  readonly onChange: (next: PublishGateCompliance) => void;
}

export function ComplianceControls({
  platform,
  compliance,
  allowedPrivacyOptions,
  onChange,
}: ComplianceControlsProps) {
  const t = useTranslations('publishGate');

  if (platform === 'tiktok') {
    const tt = compliance.tiktok ?? {
      privacyLevel: null,
      commercialContentToggle: false,
      brandOrganicToggle: false,
      brandContentToggle: false,
      isAigc: compliance.aiSyntheticDisclosure,
      musicUsageConfirmed: false,
      brandedContentPolicyConfirmed: false,
      allowComment: true,
      allowDuet: false,
      allowStitch: false,
      useDraftInboxFallback: false,
    };
    const updateTt = (patch: Partial<typeof tt>) =>
      onChange({
        ...compliance,
        aiSyntheticDisclosure: patch.isAigc ?? tt.isAigc,
        commercialDisclosure: patch.commercialContentToggle ?? tt.commercialContentToggle,
        tiktok: { ...tt, ...patch },
      });

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="pg-tt-privacy">
            {t('privacyLabel')}
          </label>
          <select
            id="pg-tt-privacy"
            value={tt.privacyLevel ?? ''}
            onChange={(e) =>
              updateTt({
                privacyLevel: (e.target.value || null) as TikTokPrivacyLevel | null,
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t('selectExplicitPlaceholder')}</option>
            {allowedPrivacyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={tt.musicUsageConfirmed}
            onChange={(e) => updateTt({ musicUsageConfirmed: e.target.checked })}
          />
          <span>{t('tiktokMusicAttestation')}</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={tt.isAigc}
            onChange={(e) => updateTt({ isAigc: e.target.checked })}
          />
          <span>{t('aiSyntheticLabel')}</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={tt.commercialContentToggle}
            onChange={(e) => updateTt({ commercialContentToggle: e.target.checked })}
          />
          <span>{t('commercialDisclosureLabel')}</span>
        </label>

        {tt.commercialContentToggle && (
          <div className="flex flex-col gap-2 pl-5">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={tt.brandOrganicToggle}
                onChange={(e) => updateTt({ brandOrganicToggle: e.target.checked })}
              />
              <span>{t('tiktokBrandOrganic')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={tt.brandContentToggle}
                onChange={(e) => updateTt({ brandContentToggle: e.target.checked })}
              />
              <span>{t('tiktokBrandContent')}</span>
            </label>
            {tt.brandContentToggle && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={tt.brandedContentPolicyConfirmed}
                  onChange={(e) =>
                    updateTt({ brandedContentPolicyConfirmed: e.target.checked })
                  }
                />
                <span>{t('tiktokBrandedPolicyConfirm')}</span>
              </label>
            )}
          </div>
        )}
      </div>
    );
  }

  if (platform === 'youtube') {
    const yt = compliance.youtube ?? {
      privacyStatus: null,
      selfDeclaredMadeForKids: null,
      containsSyntheticMedia: null,
    };
    const updateYt = (patch: Partial<typeof yt>) =>
      onChange({
        ...compliance,
        aiSyntheticDisclosure: Boolean(patch.containsSyntheticMedia ?? yt.containsSyntheticMedia),
        youtube: { ...yt, ...patch },
      });

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="pg-yt-privacy">
            {t('privacyLabel')}
          </label>
          <select
            id="pg-yt-privacy"
            value={yt.privacyStatus ?? ''}
            onChange={(e) =>
              updateYt({
                privacyStatus: (e.target.value || null) as YouTubePrivacyStatus | null,
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t('selectExplicitPlaceholder')}</option>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="pg-yt-kids">
            {t('youtubeMadeForKidsLabel')}
          </label>
          <select
            id="pg-yt-kids"
            value={yt.selfDeclaredMadeForKids === null ? '' : String(yt.selfDeclaredMadeForKids)}
            onChange={(e) =>
              updateYt({
                selfDeclaredMadeForKids: e.target.value === '' ? null : e.target.value === 'true',
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t('selectExplicitPlaceholder')}</option>
            <option value="false">{t('optionNo')}</option>
            <option value="true">{t('optionYes')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground" htmlFor="pg-yt-synthetic">
            {t('youtubeSyntheticLabel')}
          </label>
          <select
            id="pg-yt-synthetic"
            value={yt.containsSyntheticMedia === null ? '' : String(yt.containsSyntheticMedia)}
            onChange={(e) =>
              updateYt({
                containsSyntheticMedia: e.target.value === '' ? null : e.target.value === 'true',
              })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t('selectExplicitPlaceholder')}</option>
            <option value="false">{t('optionNo')}</option>
            <option value="true">{t('optionYes')}</option>
          </select>
        </div>
      </div>
    );
  }

  const ig = compliance.instagram ?? {
    accountType: 'BUSINESS' as const,
    loginProvider: 'facebook_login' as const,
    isPaidPartnership: false,
    brandedContentSponsorIds: [],
    containerReady: true,
  };
  const updateIg = (patch: Partial<typeof ig>) =>
    onChange({
      ...compliance,
      commercialDisclosure: patch.isPaidPartnership ?? ig.isPaidPartnership,
      instagram: { ...ig, ...patch },
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor="pg-ig-account">
          {t('instagramAccountTypeLabel')}
        </label>
        <select
          id="pg-ig-account"
          value={ig.accountType}
          onChange={(e) =>
            updateIg({ accountType: e.target.value as 'BUSINESS' | 'CREATOR' | 'PERSONAL' })
          }
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="BUSINESS">BUSINESS</option>
          <option value="CREATOR">CREATOR</option>
          <option value="PERSONAL">PERSONAL</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={ig.containerReady}
          onChange={(e) => updateIg({ containerReady: e.target.checked })}
        />
        <span>{t('instagramContainerReadyLabel')}</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={ig.isPaidPartnership}
          onChange={(e) => updateIg({ isPaidPartnership: e.target.checked })}
        />
        <span>{t('instagramPaidPartnershipLabel')}</span>
      </label>
    </div>
  );
}
