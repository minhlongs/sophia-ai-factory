// i18n-namespace: nicheStudio
/**
 * Niche Syndication Preview Card
 *
 * Displays multi-platform distribution payloads (YouTube Shorts, TikTok, Instagram Reels)
 * with 1-click clipboard actions for captions and compliance-safe pinned comments.
 *
 * @module components/niche-studio/niche-syndication-preview-card
 */

import React, { useState } from 'react';
import type { NicheSyndicationPackage, SocialPlatform } from '@/tree/video/syndication/niche-syndication-types';

interface NicheSyndicationPreviewCardProps {
  syndication: NicheSyndicationPackage | null;
  t: (key: string) => string;
}

export function NicheSyndicationPreviewCard({
  syndication,
  t,
}: NicheSyndicationPreviewCardProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('youtube_shorts');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!syndication) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur text-center text-muted-foreground">
        <p className="text-sm">{t('syndicationEmpty')}</p>
      </div>
    );
  }

  const payload = syndication.platforms[activePlatform];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
            <span>🌐</span> {t('syndicationTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('syndicationSubtitle')}</p>
        </div>
        <div className="flex gap-1.5 bg-muted/40 p-1 rounded-xl">
          {(['youtube_shorts', 'tiktok', 'instagram_reels'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePlatform(p)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                activePlatform === p
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'youtube_shorts' ? 'YouTube' : p === 'tiktok' ? 'TikTok' : 'Reels'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-foreground">{t('fieldCaption')}</span>
            <button
              type="button"
              onClick={() => handleCopy(payload.caption, 'caption')}
              className="text-primary hover:underline font-medium"
            >
              {copiedKey === 'caption' ? `✓ ${t('copied')}` : t('copy')}
            </button>
          </div>
          <div className="bg-muted/30 border border-border/40 rounded-xl p-3 text-foreground/90 whitespace-pre-wrap font-mono text-xs max-h-32 overflow-y-auto">
            {payload.caption}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <span>📌</span> {t('fieldPinnedComment')}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(payload.pinnedComment.text, 'pinned')}
              className="text-primary hover:underline font-medium"
            >
              {copiedKey === 'pinned' ? `✓ ${t('copied')}` : t('copy')}
            </button>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 rounded-xl p-3 font-mono text-xs whitespace-pre-wrap">
            {payload.pinnedComment.text}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-muted-foreground pt-1 border-t border-border/30 gap-2">
          <span>⏰ {t('optimalTimes')}: {payload.optimalPostingTimesUtc.join(', ')} UTC</span>
          {payload.soundRecommendation && (
            <span>🎵 {payload.soundRecommendation}</span>
          )}
        </div>
      </div>
    </div>
  );
}
