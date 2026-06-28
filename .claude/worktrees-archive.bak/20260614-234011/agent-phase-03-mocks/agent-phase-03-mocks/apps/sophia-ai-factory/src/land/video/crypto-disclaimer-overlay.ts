/**
 * crypto-disclaimer-overlay.ts — 15-second crypto disclaimer end-card for video
 *
 * Parallel to ftc-disclosure-overlay.ts.
 * Renders the FULL jurisdiction disclaimer as a text overlay on the
 * final 15 seconds of a crypto-vertical video.
 *
 * Text is mandatory and NOT user-removable.
 *
 * @module lib/video/crypto-disclaimer-overlay
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDisclaimerForJurisdiction } from '@/seed/config/crypto-disclaimer-registry';

type ExecFileAsync = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
let _execFileAsync: ExecFileAsync | null = null;

function getExecFileAsync(): ExecFileAsync {
  if (!_execFileAsync) _execFileAsync = promisify(execFile) as ExecFileAsync;
  return _execFileAsync as ExecFileAsync;
}

/** Override for testing. */
export function _setExecFileAsync(fn: ExecFileAsync): void { _execFileAsync = fn; }
export function _resetExecFileAsync(): void { _execFileAsync = null; }

export interface CryptoOverlayOptions {
  /** Duration of disclaimer end-card in seconds. Default: 15. */
  durationSec?: number;
  /** FFmpeg drawtext font size. Default: 20. */
  fontSize?: number;
  /** Font color (FFmpeg syntax). Default: 'white'. */
  fontColor?: string;
  /** Box color with alpha. Default: 'black@0.65'. */
  boxColor?: string;
  /** Locale for disclaimer text. Default: 'en'. */
  locale?: 'en' | 'vi';
}

export interface CryptoOverlayResult {
  outputPath: string;
  durationSec: number;
  jurisdiction: string;
  disclaimerPreview: string;
}

async function probeDuration(inputPath: string): Promise<number> {
  const { stdout } = await getExecFileAsync()('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    inputPath,
  ]);
  const info = JSON.parse(stdout) as { format?: { duration?: string } };
  const dur = parseFloat(info.format?.duration ?? '0');
  if (!dur || isNaN(dur)) throw new Error(`ffprobe: cannot determine duration for ${inputPath}`);
  return dur;
}

/**
 * Compose a video with a 15-second crypto regulatory disclaimer end-card.
 *
 * The overlay uses the FULL jurisdiction disclaimer (not the short caption version).
 * Text wraps at ~60 chars via FFmpeg drawtext.
 *
 * @param inputPath  Source video file path
 * @param jurisdiction  Target audience jurisdiction (e.g. 'US', 'EU')
 * @param opts  Overlay config
 */
export async function composeWithCryptoDisclaimer(
  inputPath: string,
  jurisdiction: string,
  opts: CryptoOverlayOptions = {},
): Promise<CryptoOverlayResult> {
  const durationSec = opts.durationSec ?? 15;
  const fontSize = opts.fontSize ?? 20;
  const fontColor = opts.fontColor ?? 'white';
  const boxColor = opts.boxColor ?? 'black@0.65';
  const locale = opts.locale ?? 'en';

  const disclaimer = getDisclaimerForJurisdiction(jurisdiction);
  const fullText = disclaimer.full[locale];

  // Escape FFmpeg drawtext special chars: ' : \
  const escapedText = fullText
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');

  const totalDuration = await probeDuration(inputPath);
  const startTime = Math.max(0, totalDuration - durationSec);

  const outputPath = join(tmpdir(), `crypto-disc-${randomUUID()}.mp4`);

  const drawtextFilter = [
    `drawtext=text='${escapedText}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `box=1`,
    `boxcolor=${boxColor}`,
    `boxborderw=10`,
    `x=20`,
    `y=h-th-30`,
    `line_spacing=4`,
    `enable='between(t,${startTime.toFixed(3)},${totalDuration.toFixed(3)})'`,
  ].join(':');

  await getExecFileAsync()('ffmpeg', [
    '-i', inputPath,
    '-vf', drawtextFilter,
    '-c:a', 'copy',
    '-y',
    outputPath,
  ]);

  return {
    outputPath,
    durationSec,
    jurisdiction,
    disclaimerPreview: fullText.slice(0, 80) + (fullText.length > 80 ? '...' : ''),
  };
}
