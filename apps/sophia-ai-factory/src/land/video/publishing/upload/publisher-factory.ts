import { TikTokPublisher } from '@/land/video/publishing/providers/tiktok-publisher';
import { YouTubePublisher } from '@/land/video/publishing/providers/youtube-publisher';
import { InstagramPublisher } from '@/land/video/publishing/providers/instagram-publisher';
import { FacebookPublisher } from '@/land/video/publishing/providers/facebook-publisher';
import { TwitterPublisher } from '@/land/video/publishing/providers/twitter-publisher';
import { PinterestPublisher } from '@/land/video/publishing/providers/pinterest-publisher';
import { LinkedInPublisher } from '@/land/video/publishing/providers/linkedin-publisher';
import { ZaloPublisher } from '@/land/video/publishing/providers/zalo-publisher';
import { ThreadsPublisher } from '@/land/video/publishing/providers/threads';
import { WhatsAppAdapter } from '@/land/video/publishing/providers/whatsapp-adapter';
import type { PublishingChannel, Publisher } from '@/seed/types';

export function buildPublisher(
  channel: Pick<PublishingChannel, 'provider' | 'external_account_id'>,
  accessToken: string
): Publisher {
  switch (channel.provider) {
    case 'tiktok':
      return new TikTokPublisher(accessToken);
    case 'youtube':
      return new YouTubePublisher(accessToken);
    case 'instagram':
      return new InstagramPublisher(accessToken, channel.external_account_id);
    case 'facebook':
      return new FacebookPublisher(accessToken, channel.external_account_id);
    case 'twitter':
      return new TwitterPublisher(accessToken);
    case 'pinterest':
      return new PinterestPublisher(accessToken, channel.external_account_id);
    case 'linkedin':
      return new LinkedInPublisher(accessToken, channel.external_account_id);
    case 'zalo':
      return new ZaloPublisher(accessToken);
    case 'threads':
      return new ThreadsPublisher(accessToken, channel.external_account_id);
    case 'whatsapp':
      return new WhatsAppAdapter(channel.external_account_id, accessToken);
    case 'telegram':
      return {
        upload: async (videoUrl: string, meta) => {
          const { publishToTelegram } = await import('@/tree/publishing/providers/telegram-publisher');
          const res = await publishToTelegram({
            jobId: 'direct',
            userId: 'direct',
            videoUrl,
            caption: meta.caption,
            chatId: channel.external_account_id,
          });
          return res.externalPostId;
        },
        pollStatus: async () => 'live',
        getMetrics: async () => ({ views: 0, likes: 0, comments: 0 }),
      };
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }
}
