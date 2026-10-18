import { youtubeAdapter } from './youtube-adapter';
import { tiktokAdapter } from './tiktok-adapter';
import { instagramAdapter } from './instagram-adapter';
import { facebookAdapter } from './facebook-adapter';
import type { Platform, PlatformAdapter } from './platform-adapter';

/**
 * Registry of all platform adapters for multi-channel distribution.
 * Single source of truth for the 7 platforms defined in creative-domain.ts:94
 * and the publishing_channels CHECK constraint.
 *
 * Unknown platforms fail loud — no silent fallbacks.
 */

const adapterMap: Map<Platform, PlatformAdapter> = new Map([
  ['youtube', youtubeAdapter],
  ['tiktok', tiktokAdapter],
  ['instagram', instagramAdapter],
  ['facebook', facebookAdapter],
  // x, whatsapp, blog will be added when their adapters land
]);

export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapterMap.get(platform);
  if (!adapter) {
    const supported = Array.from(adapterMap.keys()).join(', ');
    throw new Error(
      `[distribution-registry] No adapter registered for platform '${platform}'. Supported: ${supported}`,
    );
  }
  return adapter;
}

export function getSupportedPlatforms(): Platform[] {
  return Array.from(adapterMap.keys());
}

export function isPlatformSupported(platform: string): platform is Platform {
  return adapterMap.has(platform as Platform);
}
