import { logger } from '@/seed/utils/logger-utility';

export interface ThumbnailVariant {
  variantIndex: number;
  strategy: ThumbnailStrategy;
  frameTimeSec: number;
  textOverlay?: string;
  colorScheme?: 'original' | 'high-contrast' | 'warm' | 'cool';
}

export type ThumbnailStrategy =
  | 'key-frame'
  | 'text-overlay'
  | 'high-contrast'
  | 'action-shot'
  | 'close-up';

const STRATEGIES: ThumbnailStrategy[] = [
  'key-frame',
  'text-overlay',
  'high-contrast',
  'action-shot',
  'close-up',
];

export function generateThumbnailVariants(
  videoDurationSec: number,
  title: string,
  count: number = 5,
): ThumbnailVariant[] {
  const variantCount = Math.min(count, STRATEGIES.length);
  const variants: ThumbnailVariant[] = [];

  for (let i = 0; i < variantCount; i++) {
    const strategy = STRATEGIES[i];
    const frameTimeSec = getFrameTime(strategy, videoDurationSec, i);

    variants.push({
      variantIndex: i,
      strategy,
      frameTimeSec,
      textOverlay: strategy === 'text-overlay' ? title : undefined,
      colorScheme: strategy === 'high-contrast' ? 'high-contrast' : 'original',
    });
  }

  logger.info('[thumbnail-variant] Generated variants', { count: variants.length });
  return variants;
}

function getFrameTime(strategy: ThumbnailStrategy, duration: number, index: number): number {
  switch (strategy) {
    case 'key-frame':
      return duration * 0.25;
    case 'text-overlay':
      return duration * 0.1;
    case 'high-contrast':
      return duration * 0.5;
    case 'action-shot':
      return duration * 0.75;
    case 'close-up':
      return duration * 0.33;
    default:
      return duration * ((index + 1) / 6);
  }
}

export function getThumbnailFFmpegCommand(
  videoUrl: string,
  frameTimeSec: number,
  variant: ThumbnailVariant,
): string {
  const filters: string[] = [];
  if (variant.colorScheme === 'high-contrast') {
    filters.push('eq=contrast=1.5:brightness=0.05');
  }
  const filterArg = filters.length > 0 ? `-vf "${filters.join(',')}"` : '';
  return `ffmpeg -ss ${frameTimeSec} -i "${videoUrl}" -vframes 1 ${filterArg} -f image2 pipe:1`;
}
