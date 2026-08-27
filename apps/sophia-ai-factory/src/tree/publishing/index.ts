// Tree wrapper — redirect through local module
export * from './providers/telegram-publisher';

// Publishing adapters
export { youtubeAdapter } from './youtube-adapter';
export { tiktokAdapter } from './tiktok-adapter';
export { instagramAdapter } from './instagram-adapter';
export { facebookAdapter } from './facebook-adapter';

// Distribution registry
export {
  getAdapter,
  getSupportedPlatforms,
  isPlatformSupported,
  executePublish,
  checkPublishStatus,
  refreshPlatformToken,
} from './distribution-registry';

// Types
export type { Platform, PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
