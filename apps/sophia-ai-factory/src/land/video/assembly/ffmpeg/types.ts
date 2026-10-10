export interface SubtitleStyle {
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  position?: 'top' | 'center' | 'bottom';
  font?: string;
}

export interface WatermarkConfig {
  text?: string;
  logoUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  opacity?: number;
}

export interface VideoMetadata {
  durationSeconds: number;
  sizeBytes: number;
  width: number;
  height: number;
  codecName: string;
}

export interface ComposeInput {
  jobId: string;
  tenantId: string;
  audioR2Key?: string | null;
  visualR2Key: string;
  subtitleSrt?: string;
  /** When provided alongside subtitleSrt, captions are burned-in (TikTok/IG ready). */
  subtitleStyle?: SubtitleStyle;
  /** Agency-branding overlay. Merged with text fallback when logo fetch fails. */
  watermark?: WatermarkConfig;
  /** EBU R128 normalize voice track to -14 LUFS for consistent loudness. */
  normalizeAudio?: boolean;
  /** When true, server extracts a poster frame and Worker uploads it to R2. */
  generateThumbnail?: boolean;
  /** Brand kit intro video clip key in R2. */
  introR2Key?: string | null;
  /** Brand kit outro video clip key in R2. */
  outroR2Key?: string | null;
  /** Repurpose start timestamp in seconds. */
  startSec?: number;
  /** Repurpose end timestamp in seconds. */
  endSec?: number;
  /** Crop 16:9 to vertical 9:16. */
  cropVertical?: boolean;
}

export interface ComposeResult {
  finalR2Key: string;
  costUsd: number;
  thumbnailR2Key?: string;
  metadata?: VideoMetadata;
  /** True when fly call short-circuited because the breaker was OPEN. */
  degraded?: boolean;
}
