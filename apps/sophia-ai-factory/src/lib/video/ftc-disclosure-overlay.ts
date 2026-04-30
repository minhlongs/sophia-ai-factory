/**
 * ftc-disclosure-overlay.ts — FTC compliance overlay for affiliate video content
 * Phase 14: Launch Hardening
 *
 * Adds "#ad • Affiliate link" text overlay to the last 3 seconds of a video
 * using FFmpeg drawtext filter. Required by FTC 16 C.F.R. § 255 for material
 * connections disclosures in sponsored/affiliate content.
 *
 * @module lib/video/ftc-disclosure-overlay
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Lazy binding: allows test mocks to intercept promisify after module init
let _execFileAsync: typeof execFileAsync | null = null;
type ExecFileAsync = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
function getExecFileAsync(): ExecFileAsync {
  if (!_execFileAsync) _execFileAsync = promisify(execFile) as ExecFileAsync;
  return _execFileAsync as ExecFileAsync;
}
/** Override for testing — replaces the execFile wrapper */ 
export function _setExecFileAsync(fn: ExecFileAsync): void { _execFileAsync = fn; }
export function _resetExecFileAsync(): void { _execFileAsync = null; }

export interface DisclosureOptions {
  /** Duration of the disclosure overlay in seconds. Default: 3. */
  durationSec?: number;
  /** FFmpeg drawtext font size. Default: 24. */
  fontSize?: number;
  /** Text color (FFmpeg color syntax). Default: 'white'. */
  fontColor?: string;
  /** Background box color with alpha (FFmpeg color syntax). Default: 'black@0.5'. */
  boxColor?: string;
  /** X position expression for drawtext. Default: '(w-tw)/2' (centered). */
  x?: string;
  /** Y position expression for drawtext. Default: 'h-th-20' (near bottom). */
  y?: string;
}

export interface ComposedResult {
  /** Path to the output video file with overlay applied. */
  outputPath: string;
  /** Duration of the disclosure overlay used. */
  durationSec: number;
}

/**
 * Probe video duration via ffprobe.
 */
async function probeDuration(inputPath: string): Promise<number> {
  const { stdout } = await getExecFileAsync()('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    inputPath,
  ]);
  const info = JSON.parse(stdout) as { format?: { duration?: string } };
  const dur = parseFloat(info.format?.duration ?? '0');
  if (!dur || isNaN(dur)) throw new Error(`ffprobe: could not determine duration for ${inputPath}`);
  return dur;
}

/**
 * Compose a video with FTC disclosure overlay on the last N seconds.
 *
 * The overlay text "#ad • Affiliate link" is rendered via FFmpeg drawtext
 * filter, appearing only during `[totalDuration - durationSec, totalDuration]`.
 *
 * @param inputPath  Absolute path to the source video file
 * @param opts       Overlay configuration options
 * @returns          Path to the output file in the system temp directory
 *
 * @example
 * const { outputPath } = await composeWithDisclosure('/tmp/my-video.mp4');
 * // outputPath: /tmp/ftc-<uuid>.mp4
 */
export async function composeWithDisclosure(
  inputPath: string,
  opts: DisclosureOptions = {},
): Promise<ComposedResult> {
  const durationSec = opts.durationSec ?? 3;
  const fontSize = opts.fontSize ?? 24;
  const fontColor = opts.fontColor ?? 'white';
  const boxColor = opts.boxColor ?? 'black@0.5';
  const x = opts.x ?? '(w-tw)/2';
  const y = opts.y ?? 'h-th-20';

  const totalDuration = await probeDuration(inputPath);
  const startTime = Math.max(0, totalDuration - durationSec);

  const outputPath = join(tmpdir(), `ftc-${randomUUID()}.mp4`);

  // FFmpeg drawtext filter: enable overlay only during last N seconds
  const drawtextFilter = [
    `drawtext=text='#ad • Affiliate link'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `box=1`,
    `boxcolor=${boxColor}`,
    `boxborderw=8`,
    `x=${x}`,
    `y=${y}`,
    `enable='between(t,${startTime.toFixed(3)},${totalDuration.toFixed(3)})'`,
  ].join(':');

  await getExecFileAsync()('ffmpeg', [
    '-i', inputPath,
    '-vf', drawtextFilter,
    '-c:a', 'copy',
    '-y',
    outputPath,
  ]);

  return { outputPath, durationSec };
}
