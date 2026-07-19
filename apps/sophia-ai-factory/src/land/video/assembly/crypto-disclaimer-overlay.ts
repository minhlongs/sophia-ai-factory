/**
 * crypto-disclaimer-overlay.ts — 15-second crypto disclaimer end-card for video
 *
 * Parallel to ftc-disclosure-overlay.ts.
 * Renders the FULL jurisdiction disclaimer as a text overlay on the
 * final 15 seconds of a crypto-vertical video.
 *
 * Text is mandatory and NOT user-removable.
 *
 * ⚠️ Node builtins: child_process, os, path, crypto — ONLY used inside
 * composeWithCryptoDisclaimer() via dynamic import (see ftc-disclosure-overlay.ts).
 *
 * @module lib/video/crypto-disclaimer-overlay
 */

import { getDisclaimerForJurisdiction } from '@/seed/config/crypto-disclaimer-registry';

// ── Types ─────────────────────────────────────────────────────

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

// ── Test hooks ─────────────────────────────────────────────────

type ExecFileAsync = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
let _execFileAsync: ExecFileAsync | null = null;

/** Override for testing — set null to skip ffmpeg and get a stub result */
export function _setExecFileAsync(fn: ExecFileAsync | null): void {
  _execFileAsync = fn;
}

export function _resetExecFileAsync(): void {
  _execFileAsync = null;
}

// ── Dynamic Node builtin loader (SSR-safe) ────────────────────

async function loadNodeBuiltins(): Promise<{
  execFile: typeof import('node:child_process').execFile;
  promisify: typeof import('node:util').promisify;
  randomUUID: typeof import('node:crypto').randomUUID;
  tmpdir: typeof import('node:os').tmpdir;
  join: typeof import('node:path').join;
} | null> {
  if (_execFileAsync !== null) {
    const [osMod, pathMod, cryptoMod] = await Promise.all([
      import('node:os').catch(() => null),
      import('node:path').catch(() => null),
      import('node:crypto').catch(() => null),
    ]);
    if (!osMod || !pathMod || !cryptoMod) return null;
    return {
      execFile: (() => { }) as unknown as typeof import('node:child_process').execFile,
      promisify: (() => { }) as unknown as typeof import('node:util').promisify,
      randomUUID: cryptoMod.randomUUID,
      tmpdir: osMod.tmpdir,
      join: pathMod.join,
    };
  }

  try {
    const [cp, util, crypto, os, path] = await Promise.all([
      import('node:child_process'),
      import('node:util'),
      import('node:crypto'),
      import('node:os'),
      import('node:path'),
    ]);
    return {
      execFile: cp.execFile,
      promisify: util.promisify,
      randomUUID: crypto.randomUUID,
      tmpdir: os.tmpdir,
      join: path.join,
    };
  } catch {
    return null;
  }
}

// ── Probe FFprobe duration ────────────────────────────────────

async function probeDuration(
  execFileAsync: ExecFileAsync,
  inputPath: string,
): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    inputPath,
  ]);
  const info = JSON.parse(stdout) as { format?: { duration?: string } };
  const dur = parseFloat(info.format?.duration ?? '0');
  if (!dur || isNaN(dur)) {
    throw new Error(`ffprobe: cannot determine duration for ${inputPath}`);
  }
  return dur;
}

// ── Primary entry point ──────────────────────────────────────

/**
 * Compose a video with a 15-second crypto regulatory disclaimer end-card.
 *
 * The overlay uses the FULL jurisdiction disclaimer (not the short caption version).
 * Text wraps at ~60 chars via FFmpeg drawtext.
 *
 * @param inputPath Source video file path
 * @param jurisdiction Target audience jurisdiction (e.g. 'US', 'EU')
 * @param opts Overlay config
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

  const builtins = await loadNodeBuiltins();
  if (!builtins) {
    return {
      outputPath: inputPath,
      durationSec,
      jurisdiction,
      disclaimerPreview: fullText.slice(0, 80) + (fullText.length > 80 ? '...' : ''),
    };
  }

  const execFileAsync = _execFileAsync ?? builtins.promisify(builtins.execFile);
  const totalDuration = await probeDuration(execFileAsync, inputPath);
  const startTime = Math.max(0, totalDuration - durationSec);

  const outputPath = builtins.join(builtins.tmpdir(), `crypto-disc-${builtins.randomUUID()}.mp4`);

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

  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-vf', drawtextFilter,
    '-c:a', 'copy',
    '-y', outputPath,
  ]);

  return {
    outputPath,
    durationSec,
    jurisdiction,
    disclaimerPreview: fullText.slice(0, 80) + (fullText.length > 80 ? '...' : ''),
  };
}
