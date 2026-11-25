'use client';

/**
 * Browser Canvas 9:16 slide rasterizer + H.264/AVC1 MP4 file builder & download trigger.
 *
 * Renders each approved script scene + a dedicated CTA & Referral Shortlink end-card
 * onto an offscreen `<canvas>` (with automatic deterministic fallback in headless/JSDOM)
 * and encodes a genuine ISO BMFF `.mp4` (`ftyp` `isom`, `avc1` H.264).
 *
 * @module components/first-value/pilot-browser-mp4-renderer
 */

import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  encodePilotSlidesToMp4,
  renderDeterministicRgbaSlide,
  type EncodedPilotMp4Artifact,
  type PilotMp4SlideSpec,
} from '@/seed/video/pilot-mp4-encoder';

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

async function loadProductImages(urls?: readonly string[]): Promise<HTMLImageElement[]> {
  if (!urls || urls.length === 0 || typeof Image === 'undefined') return [];
  const loaded = await Promise.all(
    urls.slice(0, 5).map(
      (url) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    ),
  );
  return loaded.filter((img): img is HTMLImageElement => img !== null);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  zoomFactor: number,
): void {
  const imgRatio = (img.naturalWidth || width) / (img.naturalHeight || height);
  const canvasRatio = width / height;
  let drawW = width * zoomFactor;
  let drawH = height * zoomFactor;
  if (imgRatio > canvasRatio) {
    drawW = drawH * imgRatio;
  } else {
    drawH = drawW / imgRatio;
  }
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function drawSlideOnCanvas(
  slide: PilotMp4SlideSpec,
  width: number,
  height: number,
  productImages: readonly HTMLImageElement[] = [],
): Uint8Array {
  if (typeof document === 'undefined') {
    return renderDeterministicRgbaSlide(slide, width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return renderDeterministicRgbaSlide(slide, width, height);
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  if (productImages.length > 0) {
    const img = productImages[slide.accentIndex % productImages.length];
    if (img) {
      drawCoverImage(ctx, img, width, height, 1.04 + (slide.accentIndex % 3) * 0.03);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.fillStyle = '#4338ca';
  ctx.fillRect(16, 20, width - 32, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.fillText(slide.label.slice(0, 36), 26, 42);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  const headlineLines = wrapCanvasText(ctx, slide.headline, width - 40, 3);
  headlineLines.forEach((line, idx) => {
    ctx.fillText(line, 20, 96 + idx * 24);
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px Inter, system-ui, sans-serif';
  const bodyLines = wrapCanvasText(ctx, slide.body, width - 40, 8);
  bodyLines.forEach((line, idx) => {
    ctx.fillText(line, 20, 190 + idx * 21);
  });

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(16, height - 118, width - 32, 88);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  const ctaLines = wrapCanvasText(ctx, slide.footerCta, width - 48, 2);
  ctaLines.forEach((line, idx) => {
    ctx.fillText(line, 24, height - 92 + idx * 18);
  });

  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.fillText(slide.referralShortUrl.slice(0, 44), 24, height - 44);

  const imageData = ctx.getImageData(0, 0, width, height);
  return new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
}

export function buildSlidesFromAcceptedScript(args: {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}): readonly PilotMp4SlideSpec[] {
  const sceneSlides: PilotMp4SlideSpec[] = args.script.scenes.map((scene, index) => ({
    label: `SCENE ${scene.scene_number} • ${args.disclosureTag}`,
    headline: scene.title?.trim() || args.script.title,
    body: scene.narration,
    footerCta: args.ctaText,
    referralShortUrl: args.shortUrl,
    durationSec: Math.max(2, Math.min(30, Math.round(scene.duration_estimate || 6))),
    accentIndex: index,
  }));

  sceneSlides.push({
    label: `CALL TO ACTION • ${args.disclosureTag}`,
    headline: args.ctaText,
    body: args.script.title,
    footerCta: args.ctaText,
    referralShortUrl: args.shortUrl,
    durationSec: 4,
    accentIndex: sceneSlides.length,
  });

  return sceneSlides;
}

export async function renderAndDownloadPilotMp4(args: {
  readonly artifactId: string;
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
  readonly productImageUrls?: readonly string[];
}): Promise<EncodedPilotMp4Artifact> {
  const slides = buildSlidesFromAcceptedScript(args);
  const productImages = await loadProductImages(args.productImageUrls);
  const encoded = await encodePilotSlidesToMp4({
    slides,
    width: 320,
    height: 576,
    renderRgbaFrame: (slide, w, h) => drawSlideOnCanvas(slide, w, h, productImages),
  });

  if (typeof document !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([encoded.bytes as BlobPart], { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `sophia-pilot-${args.artifactId}.mp4`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 10_000);
  }

  return encoded;
}
