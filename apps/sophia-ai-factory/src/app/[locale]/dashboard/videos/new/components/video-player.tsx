'use client';

/**
 * VideoPlayer — displays the finished generated video.
 * Renders a native <video controls> element + download link.
 */

import { useTranslations } from 'next-intl';

interface VideoPlayerProps {
  src: string;
  missionId: string;
}

export function VideoPlayer({ src, missionId }: VideoPlayerProps) {
  const t = useTranslations('dashboard.videos');

  const filename = `sophia-video-${missionId.slice(0, 8)}.mp4`;

  return (
    <div className="flex flex-col gap-4">
      <video
        src={src}
        controls
        className="w-full rounded-lg border border-border shadow-sm"
        aria-label={t('create.title')}
      />
      <div className="flex justify-end gap-2">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground underline"
        >
          {t('openInNewTab')}
        </a>
        <a
          href={src}
          download={filename}
          className="text-sm font-medium underline"
        >
          {t('download')}
        </a>
      </div>
    </div>
  );
}
