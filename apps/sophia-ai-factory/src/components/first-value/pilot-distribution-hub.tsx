'use client';

/**
 * 1-Click Multi-Channel Distribution Hub & 7-Day Publishing Schedule.
 *
 * @module components/first-value/pilot-distribution-hub
 */

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  buildMultiChannelDistributionPack,
  type DistributionChannelId,
} from './pilot-distribution-hub-helpers';

export interface PilotDistributionHubProps {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}

const CHANNEL_LABEL_KEYS: Record<DistributionChannelId, string> = {
  youtube: 'pilotDistTabYoutube',
  tiktok: 'pilotDistTabTiktok',
  reels: 'pilotDistTabReels',
  community: 'pilotDistTabCommunity',
};

const STUDIO_BTN_KEYS: Record<DistributionChannelId, string> = {
  youtube: 'pilotDistOpenYoutube',
  tiktok: 'pilotDistOpenTiktok',
  reels: 'pilotDistOpenReels',
  community: 'pilotDistOpenCommunity',
};

export function PilotDistributionHub(props: PilotDistributionHubProps) {
  const t = useTranslations('firstValue');
  const [activeTab, setActiveTab] = useState<DistributionChannelId>('youtube');
  const [copiedId, setCopiedId] = useState<DistributionChannelId | null>(null);

  const pack = buildMultiChannelDistributionPack({
    script: props.script,
    ctaText: props.ctaText,
    shortUrl: props.shortUrl,
    disclosureTag: props.disclosureTag,
  });

  const activeChannel =
    pack.channels.find((c) => c.id === activeTab) ?? pack.channels[0];

  async function handleCopy(channelId: DistributionChannelId, text: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(channelId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure in restricted contexts
    }
  }

  return (
    <div
      data-testid="pilot-distribution-hub"
      className="space-y-4 rounded-lg border border-border bg-muted/40 p-4"
    >
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('pilotDistHubTitle')}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t('pilotDistHubSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {pack.channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            role="tab"
            aria-selected={activeTab === channel.id}
            data-testid={`pilot-dist-tab-${channel.id}`}
            onClick={() => setActiveTab(channel.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === channel.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {t(CHANNEL_LABEL_KEYS[channel.id])}
          </button>
        ))}
      </div>

      {activeChannel && (
        <div className="space-y-2">
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-foreground">
            {activeChannel.copyText}
          </pre>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="pilot-dist-copy-btn"
              onClick={() => void handleCopy(activeChannel.id, activeChannel.copyText)}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              {copiedId === activeChannel.id ? t('copiedBtn') : t('pilotDistCopyBtn')}
            </button>
            <a
              href={activeChannel.studioUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="pilot-dist-studio-link"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <span>{t(STUDIO_BTN_KEYS[activeChannel.id])}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* 7-Day Cadence Checklist */}
      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold text-foreground">{t('pilotDistScheduleTitle')}</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pack.schedule.map((item) => (
            <div
              key={item.day}
              className="rounded-lg border border-border bg-background p-2.5 text-[11px]"
            >
              <div className="font-semibold text-foreground">
                Day {item.day}: {item.asset}
              </div>
              <div className="text-muted-foreground">{item.channels}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
