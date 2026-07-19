import { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import type { WatermarkConfig, SubtitleStyle } from '@/land/video/assembly/composer-ffmpeg';
import { logger } from '@/seed/utils/logger-utility';

export interface BrandKitOverrides {
  watermark: WatermarkConfig | undefined;
  subtitleStyle: SubtitleStyle | undefined;
  introR2Key: string | null;
  outroR2Key: string | null;
}

export async function loadBrandKitOverrides(userId: string): Promise<BrandKitOverrides> {
  const kit = await getBrandKit(userId);
  if (!kit) {
    return { watermark: undefined, subtitleStyle: undefined, introR2Key: null, outroR2Key: null };
  }

  let logoUrl: string | undefined;
  if (kit.logo_r2_key) {
    logoUrl = await resolveR2PublicUrl(kit.logo_r2_key);
  }

  const watermark: WatermarkConfig | undefined = logoUrl
    ? {
        logoUrl,
        position: (kit.logo_position as WatermarkConfig['position']) ?? 'bottom-right',
        opacity: kit.logo_opacity ?? 0.85,
      }
    : undefined;

  const subtitleStyle: SubtitleStyle | undefined = kit.primary_color
    ? {
        fontSize: 48,
        color: kit.primary_color,
        strokeColor: kit.secondary_color ?? 'black',
        strokeWidth: 3,
        position: 'bottom',
        font: kit.font_r2_key ? 'BrandFont' : 'Noto-Sans-Bold',
      }
    : undefined;

  return {
    watermark,
    subtitleStyle,
    introR2Key: kit.intro_r2_key,
    outroR2Key: kit.outro_r2_key,
  };
}

async function resolveR2PublicUrl(r2Key: string): Promise<string | undefined> {
  try {
    const ref = await getVideoBucket();
    if (!ref) return undefined;
    const obj = await ref.bucket.head(r2Key);
    if (!obj) return undefined;
    const customDomain = process.env.R2_PUBLIC_URL;
    if (customDomain) {
      return `${customDomain}/${r2Key}`;
    }
    return `https://pub-sophia-assets.r2.dev/${r2Key}`;
  } catch (err) {
    logger.warn('[BrandKitComposer] Failed to resolve R2 URL', { r2Key, error: String(err) });
    return undefined;
  }
}
