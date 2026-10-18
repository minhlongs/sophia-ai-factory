const MAX_FIELD_LENGTH = 120;
const TRUNCATION_SUFFIX = '…';

export interface CampaignRow {
  id: string;
  title: string;
  status: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
}

export function truncateStatusField(
  value: string | null | undefined,
  max = MAX_FIELD_LENGTH,
): string {
  const base = value ?? '';
  return base.length > max ? `${base.slice(0, max)}${TRUNCATION_SUFFIX}` : base;
}

export function formatSingleCampaignStatus(row: CampaignRow): string {
  const headerEmoji =
    row.status === 'completed'
      ? '✅'
      : row.status === 'failed'
        ? '❌'
        : row.status === 'queued'
          ? '⏳'
          : '⚙️';

  const statusHuman = row.status?.replace(/_/g, ' ') ?? 'unknown';
  const title = truncateStatusField(row.title);
  let message = `${headerEmoji} *Trạng thái / Status: ${title}*\n\n`;
  message += ` ID: \`${row.id.slice(0, 8)}\`\n`;
  message += ` Trạng thái / Status: ${statusHuman}\n`;
  message += ` Tiến độ / Progress: ${row.progress ?? 0}%\n`;
  message += ` Tạo lúc / Created: ${new Date(row.created_at).toLocaleDateString()}\n`;
  message += ` Cập nhật / Updated: ${new Date(row.updated_at).toLocaleDateString()}\n`;
  return message;
}

export function formatActiveCampaignsList(campaigns: CampaignRow[]): string {
  const headerEmoji = '📊';
  if (campaigns.length === 0) {
    return (
      `${headerEmoji} *Không có chiến dịch đang hoạt động / No Active Campaigns*\n\n` +
      `Tạo chiến dịch mới với /campaign <chủ đề>.\n\n` +
      `_Create a new one with \`/campaign <topic>\`._`
    );
  }

  const statusEmoji = (s: string | null | undefined) => {
    if (s === 'queued') return '⏳';
    if (s?.startsWith('processing_')) return '⚙️';
    if (s === 'completed') return '✅';
    if (s === 'failed') return '❌';
    return '•';
  };

  let message = `${headerEmoji} *Chiến dịch đang chạy / Active Campaigns:*\n\n`;
  campaigns.forEach((c, idx) => {
    const emoji = statusEmoji(c.status);
    const statusHuman = (c.status ?? 'unknown').replace(/_/g, ' ');
    const title = truncateStatusField(c.title);
    message += `${idx + 1}. ${emoji} *${title}*\n`;
    message += ` ID: \`${c.id.slice(0, 8)}\`\n`;
    message += ` TT / Status: ${statusHuman} (${c.progress ?? 0}%)\n`;
    message += ` Tạo / Created: ${new Date(c.created_at).toLocaleDateString()}\n\n`;
  });
  return message;
}
