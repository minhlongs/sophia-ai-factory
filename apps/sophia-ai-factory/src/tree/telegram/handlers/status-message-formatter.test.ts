import { describe, expect, it } from 'vitest';
import {
  formatActiveCampaignsList,
  formatSingleCampaignStatus,
  truncateStatusField,
  type CampaignRow,
} from './status-message-formatter';

const campaign: CampaignRow = {
  id: 'campaign-123456789',
  title: 'Summer launch',
  status: 'processing_assets',
  progress: 37,
  created_at: '2026-01-10T12:00:00.000Z',
  updated_at: '2026-01-11T12:00:00.000Z',
};

describe('Telegram status message formatter', () => {
  it('keeps short values and renders nullish values as empty', () => {
    expect(truncateStatusField('short')).toBe('short');
    expect(truncateStatusField(null)).toBe('');
    expect(truncateStatusField(undefined)).toBe('');
    expect(truncateStatusField('12345', 5)).toBe('12345');
  });

  it('truncates only values exceeding the configured maximum and appends an ellipsis', () => {
    expect(truncateStatusField('123456', 5)).toBe('12345…');
    expect(truncateStatusField('abcdef', 0)).toBe('…');
    expect(truncateStatusField('x'.repeat(125))).toBe(`${'x'.repeat(120)}…`);
  });

  it.each([
    ['completed', '✅'],
    ['failed', '❌'],
    ['queued', '⏳'],
    ['processing_assets', '⚙️'],
    [null, '⚙️'],
  ] as const)('formats single campaign status %s with a safe ID, progress, and bilingual labels', (status, emoji) => {
    const message = formatSingleCampaignStatus({ ...campaign, status, progress: null });

    expect(message).toContain(`${emoji} *Trạng thái / Status: Summer launch*`);
    expect(message).toContain('ID: `campaign`');
    expect(message).toContain(`Trạng thái / Status: ${(status ?? 'unknown').replace(/_/g, ' ')}`);
    expect(message).toContain('Tiến độ / Progress: 0%');
    expect(message).toContain('Tạo lúc / Created:');
    expect(message).toContain('Cập nhật / Updated:');
  });

  it('formats the empty active-campaign state in both languages', () => {
    const message = formatActiveCampaignsList([]);

    expect(message).toContain('📊 *Không có chiến dịch đang hoạt động / No Active Campaigns*');
    expect(message).toContain('/campaign <chủ đề>');
    expect(message).toContain('/campaign <topic>');
  });

  it('formats active campaign rows and selects status-specific icons', () => {
    const rows: CampaignRow[] = [
      { ...campaign, status: 'queued' },
      { ...campaign, id: 'campaign-22222222', title: 'A'.repeat(125), status: 'processing_render' },
      { ...campaign, status: 'completed', progress: null },
      { ...campaign, status: 'failed', progress: 100 },
      { ...campaign, status: 'paused', progress: 20 },
      { ...campaign, status: null, progress: null },
    ];
    const message = formatActiveCampaignsList(rows);

    expect(message).toContain('1. ⏳ *Summer launch*');
    expect(message).toContain(`2. ⚙️ *${'A'.repeat(120)}…*`);
    expect(message).toContain('3. ✅ *Summer launch*');
    expect(message).toContain('4. ❌ *Summer launch*');
    expect(message).toContain('5. • *Summer launch*');
    expect(message).toContain('6. • *Summer launch*');
    expect(message).toContain('processing render (37%)');
    expect(message).toContain('unknown (0%)');
  });
});
