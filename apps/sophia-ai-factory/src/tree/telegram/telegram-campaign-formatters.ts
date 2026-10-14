/**
 * Telegram Bot Campaign Message Formatters and D1 Row Contract.
 * @module tree/telegram/telegram-campaign-formatters
 */

export interface CampaignD1Row {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  audience: string | null;
  status: string | null;
  progress: number | null;
  template_id: string | null;
  script_content: string | null;
  audio_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function formatActiveCampaignsMessage(campaigns: CampaignD1Row[]): string {
  let message = '📊 *Active Campaigns:*\n\n';
  campaigns.forEach((c) => {
    const statusEmoji = c.status === 'queued' ? '⏳' : '⚙️';
    message += `${statusEmoji} *${c.title}*\n`;
    message += `Status: ${c.status?.replace('_', ' ')}\n`;
    message += `Progress: ${c.progress ?? 0}%\n\n`;
  });
  return message;
}

export function formatCompletedCampaignsMessage(campaigns: CampaignD1Row[]): string {
  let message = '✅ *Recent Results:*\n\n';
  campaigns.forEach((c) => {
    message += `🎬 *${c.title}*\n`;
    if (c.video_url) {
      message += `[Watch Video](${c.video_url})\n`;
    } else {
      message += `(Video URL missing)\n`;
    }
    message += `Completed: ${new Date(c.updated_at).toLocaleDateString()}\n\n`;
  });
  return message;
}
