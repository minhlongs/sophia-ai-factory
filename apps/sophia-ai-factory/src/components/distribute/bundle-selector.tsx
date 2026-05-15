/**
 * bundle-selector.tsx — One-click bundle publish UI
 *
 * Renders 4 preset bundle buttons. Each button shows:
 *   - Bundle name
 *   - Channel description
 *   - Loading spinner while publishing
 *   - Disabled when no channels in bundle are connected
 *
 * Used inside DistributePanel alongside the manual channel selector.
 *
 * @module components/distribute/bundle-selector
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { BundleId } from '@/lib/publishing/bundle-definitions';
import { BUNDLE_IDS, getBundleChannels } from '@/lib/publishing/bundle-definitions';
import { publishToBundle } from '@/lib/publishing/bundle-publisher';
import type { ChannelPublishResult } from '@/lib/publishing/bundle-publisher';
import type { UserChannel } from '@/seed/db/get-user-channels';
import { PROVIDER_LABELS } from '@/app/[locale]/dashboard/videos/[id]/distribute/channel-meta';

interface Props {
  videoId: string;
  channels: UserChannel[];
  caption: string;
  scheduledAt?: number;
  /** Offer vertical — triggers crypto rules when 'crypto'. */
  offerVertical?: string;
  jurisdiction?: string;
  locale?: 'en' | 'vi';
  onPublishStart?: (bundleId: BundleId) => void;
  onPublishComplete?: (bundleId: BundleId, results: ChannelPublishResult[]) => void;
}

export function BundleSelector({
  videoId,
  channels,
  caption,
  scheduledAt,
  offerVertical,
  jurisdiction = 'US',
  locale = 'en',
  onPublishStart,
  onPublishComplete,
}: Props) {
  const t = useTranslations('dashboard.videos.distribute');
  const [publishingBundle, setPublishingBundle] = useState<BundleId | null>(null);

  const activeProviders = new Set(
    channels.filter((c) => c.status === 'active').map((c) => c.provider),
  );

  async function handleBundlePublish(bundleId: BundleId) {
    if (publishingBundle) return;

    setPublishingBundle(bundleId);
    onPublishStart?.(bundleId);

    try {
      const result = await publishToBundle({
        videoId,
        bundleId,
        caption,
        scheduledAt,
        activeProviders,
        offerVertical,
        jurisdiction,
        locale,
      });

      onPublishComplete?.(bundleId, result.channels);

      if (result.successCount === 0) {
        toast.warning(t('bundles.allSkipped'));
      } else if (result.failedCount > 0 || result.skippedCount > 0) {
        toast.info(
          t('bundles.partialToast', {
            success: result.successCount,
            skipped: result.skippedCount,
            failed: result.failedCount,
          }),
        );
      } else {
        toast.success(t('bundles.successToast', { count: result.successCount }));
      }
    } catch {
      toast.error(t('errorToast'));
    } finally {
      setPublishingBundle(null);
    }
  }

  return (
    <section aria-label={t('bundles.title')} className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t('bundles.title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('bundles.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BUNDLE_IDS.map((bundleId) => {
          const connectedInBundle = getBundleChannels(bundleId, activeProviders);
          const isDisabled = connectedInBundle.length === 0 || publishingBundle !== null;
          const isPublishing = publishingBundle === bundleId;

          const labelKey = `bundles.${bundleId}.label` as const;
          const descKey = `bundles.${bundleId}.description` as const;
          const label = t(labelKey as Parameters<typeof t>[0]);

          return (
            <button
              key={bundleId}
              type="button"
              disabled={isDisabled}
              onClick={() => handleBundlePublish(bundleId)}
              className="flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('bundles.publishButton', { label })}
            >
              <span className="text-sm font-semibold leading-tight">
                {isPublishing ? t('bundles.publishing') : label}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                {t(descKey as Parameters<typeof t>[0])}
              </span>
              {connectedInBundle.length > 0 && (
                <span className="mt-2 text-xs text-muted-foreground">
                  {connectedInBundle
                    .map((p) => PROVIDER_LABELS[p] ?? p)
                    .join(', ')}
                </span>
              )}
              {connectedInBundle.length === 0 && (
                <span className="mt-2 text-xs text-orange-500 dark:text-orange-400">
                  {t('noChannels')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
