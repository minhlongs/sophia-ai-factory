import { truncateMarkdownV2Safely } from '@/tree/telegram/format-markdown-v2';
import {
  type CampaignRow,
  MAX_CAMPAIGN_TITLE_LEN,
  MAX_CAMPAIGN_MESSAGE_LEN,
} from './types-and-db';

const STATUS_EMOJI: Record<string, string> = {
  draft: '📝',
  queued: '⏳',
  processing_script: '⚙️',
  processing_video: '🎬',
  completed: '✅',
  failed: '❌',
  video_timeout: '⏰',
};

/**
 * Format a list of CampaignRow records into a MarkdownV2-safe Telegram message.
 */
export function formatCampaignListMessage(campaigns: CampaignRow[]): string {
  let message = '📋 *All Campaigns:*\n\n';
  campaigns.forEach((c, i) => {
    const emoji = STATUS_EMOJI[c.status ?? ''] || '❓';
    const shortId = c.id.slice(0, 8);
    const date = new Date(c.created_at).toLocaleDateString();
    const title = truncateMarkdownV2Safely(c.title, MAX_CAMPAIGN_TITLE_LEN);
    message += `${emoji} *${title}*\n`;
    message += ` ID: \`${shortId}\` | Status: ${c.status ?? 'unknown'} | Progress: ${c.progress ?? 0}%\n`;
    message += ` Created: ${date}\n`;
    if (i < campaigns.length - 1) message += '\n';
  });

  const finalMessage = truncateMarkdownV2Safely(message, MAX_CAMPAIGN_MESSAGE_LEN);
  return (
    finalMessage +
    (finalMessage.length >= MAX_CAMPAIGN_MESSAGE_LEN ? '…\n_(truncated)_' : '')
  );
}
