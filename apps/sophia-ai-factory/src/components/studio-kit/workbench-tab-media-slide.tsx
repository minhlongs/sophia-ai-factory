'use client';

/**
 * Tab 2 — Media & Slide Studio (Carousel SVG Live Preview & Browser TTS Chunks).
 */

import { useMemo, useState } from 'react';
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

  const svgMarkup = useMemo(
    () =>
      renderCarouselSlideSvg({
        slideNumber: 1,
        totalSlides: 5,
        headline,
        body,
        footerUrl: 'sophia.agencyos.network/r/demo',
        disclosureTag: '#ad #affiliate',
      }),
    [headline, body],
  );

  const ttsChunks = useMemo(() => splitTextForTtsWorker(`${headline}. ${body}`, 120), [headline, body]);

  function handleDownloadSvg() {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sophia-carousel-slide-1.svg';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          {locale === 'vi' ? 'Tiêu đề Slide Carousel' : 'Carousel Slide Headline'}
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          {locale === 'vi' ? 'Nội dung chính' : 'Slide Body Copy'}
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-slate-500">
            {locale === 'vi'
              ? `Browser TTS $0 GPU: ${ttsChunks.length} đoạn giọng đọc sẵn sàng`
              : `Browser TTS $0 GPU: ${ttsChunks.length} voice chunks ready`}
          </span>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
          >
            {locale === 'vi' ? 'Tải Slide SVG' : 'Download SVG'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3 dark:border-slate-800">
        <div
          className="mx-auto aspect-[4/5] max-h-[340px] w-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      </div>
    </div>
  );
}
