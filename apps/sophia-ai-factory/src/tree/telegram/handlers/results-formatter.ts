/**
 * Telegram /results Markdown & Drive URL Sanitizer Helpers
 *
 * Layer: tree/telegram/handlers
 * @module tree/telegram/handlers/results-formatter
 */

export interface CampaignRow {
  id: string;
  title: string;
  video_url: string | null;
  updated_at: string;
  status: string | null;
  user_id: string;
}

type DriveSnippet = {
  mimeType?: string | null;
  name?: string | null;
  url?: string | null;
};

export function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.]/g, '\\$&');
}

export function redactDriveUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lo = raw.toLowerCase();
  if (!lo.includes('drive.google.com') && !lo.includes('docs.google.com')) return raw;
  try {
    const u = new URL(raw);
    u.hash = '';
    if (u.pathname === '/open') u.pathname = '/file/d';
    if (u.searchParams.has('id')) {
      const id = u.searchParams.get('id');
      u.pathname = `/file/d/${encodeURIComponent(id!)}/view`;
      u.search = '';
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function looksLikeDriveSnippet(raw: unknown, fallback: string | null): string | null {
  if (typeof raw === 'string') return redactDriveUrl(raw);
  if (raw && typeof raw === 'object' && 'url' in (raw as DriveSnippet)) {
    const maybe = redactDriveUrl((raw as DriveSnippet).url ?? null);
    if (maybe) return maybe;
  }
  return fallback;
}

export function formatResultsMarkdown(campaigns: CampaignRow[], filterId?: string): string {
  const filtered = filterId ? campaigns.filter((c) => c.id === filterId) : campaigns;

  let header = '✅ *Kết quả / Results:*\n\n';
  if (filterId && filtered.length === 0) {
    return '📭 *Không tìm thấy kết quả / No results found*\n\n_ID không hợp lệ hoặc chưa có video hoàn thành._\n_Invalid ID or no completed video for this campaign._';
  }

  header += `_${filtered.length} chiến dịch hoàn thành / completed campaigns_\n\n`;

  let body = '';
  filtered.forEach((c) => {
    const raw = looksLikeDriveSnippet(c.video_url, c.video_url);
    body += `🎬 *${escapeMd(c.title)}*\n`;
    if (raw) {
      body += `🎥 [Xem video / Watch video](${escapeMd(raw)})\n`;
    } else {
      body += `_(Video URL chưa có / Video URL missing)_\n`;
    }
    body += ` Cập nhật / Updated: ${new Date(c.updated_at).toLocaleDateString()}\n\n`;
  });

  return header + body;
}
