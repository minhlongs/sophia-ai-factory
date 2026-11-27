'use client';

/**
 * Tab 2 — Media & Slide Studio (Carousel SVG Live Preview & Browser TTS Chunks).
 */

import { useDeferredValue, useMemo, useState } from 'react';
import { renderCarouselSlideSvg } from '@/seed/video/carousel-svg-builder';
import { splitTextForTtsWorker } from '@/seed/video/browser-tts-device-probe';

export function WorkbenchTabMediaSlide({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [headline, setHeadline] = useState(
    locale === 'vi' ? '3 Sai Lầm Khi Chạy Affiliate Crypto 2026' : '3 Crypto Affiliate Mistakes in 2026',
  );
  const [body, setBody] = useState(
    locale === 'vi'
      ? 'Đừng gắn link thẳng trong caption TikTok. Hãy dùng bình luận đầu tiên và lọc bot ASN.'
      : 'Never put raw links in TikTok captions. Use delayed first comments and edge ASN bot filtering.',
  );

  const deferredHeadline = useDeferredValue(headline);
  const deferredBody = useDeferredValue(body);

  const svgMarkup = useMemo(
    () =>
      renderCarouselSlideSvg({
        slideNumber: 1,
        totalSlides: 5,
        headline: deferredHeadline,
        body: deferredBody,
        footerUrl: 'sophia-ai-factory.agencyos-openclaw.workers.dev/r/demo',
        disclosureTag: '#ad #affiliate',
      }),
    [deferredHeadline, deferredBody],
  );

  const svgDataUri = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`,
    [svgMarkup],
  );

  const ttsChunks = useMemo(
    () => splitTextForTtsWorker(`${deferredHeadline}. ${deferredBody}`, 120),
    [deferredHeadline, deferredBody],
  );

  function handleDownloadSvg() {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sophia-carousel-slide-1.svg';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-xs font-medium text-muted-foreground">
          {locale === 'vi' ? 'Tiêu đề Slide Carousel' : 'Carousel Slide Headline'}
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          {locale === 'vi' ? 'Nội dung chính' : 'Slide Body Copy'}
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
          <span className="text-muted-foreground">
            {locale === 'vi'
              ? `Giọng đọc trình duyệt $0: ${ttsChunks.length} đoạn sẵn sàng`
              : `Browser Voiceover $0: ${ttsChunks.length} segments ready`}
          </span>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="md3-pill-button min-h-[40px] bg-primary px-4 py-1.5 font-medium text-primary-foreground"
          >
            {locale === 'vi' ? 'Tải Slide' : 'Download Slide'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUri}
          alt={locale === 'vi' ? 'Xem trước slide Carousel' : 'Carousel slide preview'}
          className="mx-auto aspect-[4/5] max-h-[340px] w-full object-contain"
        />
      </div>
    </div>
  );
}
