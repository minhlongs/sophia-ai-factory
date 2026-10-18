/**
 * Timeline tracks, settlement records, and token swatches for Stitch Control Deck.
 *
 * @module tree/control-deck/stitch-deck-telemetry-data
 */

import type { ControlDeckDataset } from '@/seed/types/stitch-control-deck';

export const STITCH_TIMELINE_TRACKS: ControlDeckDataset['timelineTracks'] = [
  {
    trackId: 'track-v1',
    trackCode: 'V1',
    label: { en: 'Primary B-Roll & Avatar Synthesis', vi: 'Hình Ảnh Chính & Tổng Hợp Avatar' },
    modelBadge: 'Kling v1.6 Pro · 1080p60',
    startTimecode: '00:00:00:00',
    durationTimecode: '00:00:58:12',
    progressPct: 100,
    accentColorVar: 'var(--color-director-indigo)',
  },
  {
    trackId: 'track-a1',
    trackCode: 'A1',
    label: { en: 'Bilingual Neural Voiceover (EN/VI)', vi: 'Giọng Đọc AI Song Ngữ (EN/VI)' },
    modelBadge: 'ElevenLabs Turbo v3 · -14 LUFS',
    startTimecode: '00:00:00:08',
    durationTimecode: '00:00:56:20',
    progressPct: 100,
    accentColorVar: 'var(--color-neural-violet)',
  },
  {
    trackId: 'track-a2',
    trackCode: 'A2',
    label: { en: 'Dynamic Ducking Cinema Score', vi: 'Nhạc Nền Điện Ảnh Tự Động Hạ Âm' },
    modelBadge: 'Adaptive Stem · Sidechain',
    startTimecode: '00:00:00:00',
    durationTimecode: '00:00:58:12',
    progressPct: 100,
    accentColorVar: 'var(--color-executive-amber)',
  },
  {
    trackId: 'track-sub',
    trackCode: 'SUB',
    label: { en: 'High-Retention Diacritic Captions', vi: 'Phụ Đề Chuẩn Dấu Tiếng Việt Giữ Chân Cao' },
    modelBadge: 'Space Grotesk + Inter · Word-Sync',
    startTimecode: '00:00:00:08',
    durationTimecode: '00:00:56:20',
    progressPct: 94,
    accentColorVar: 'var(--color-telemetry-emerald)',
  },
];

export const STITCH_SETTLEMENTS: ControlDeckDataset['settlements'] = [
  {
    txId: 'NP-USDT-994821',
    provider: { en: 'NOWPayments USDT (TRC-20)', vi: 'NOWPayments USDT (TRC-20)' },
    grossAmountUsd: '$499.00',
    affiliateSplitUsd: '$149.70 (30%)',
    merkleLeafHash: '0x9f8c4a12...71e4b2',
    status: { en: 'SAMPLE', vi: 'DỮ LIỆU MẪU' },
    timestampUtc: '2026-10-17 09:40:12 UTC',
    source: 'sample',
  },
  {
    txId: 'PAYOS-VQR-883104',
    provider: { en: 'PayOS VietQR', vi: 'PayOS VietQR' },
    grossAmountUsd: '$249.00',
    affiliateSplitUsd: '$74.70 (30%)',
    merkleLeafHash: '0x4d2e8b09...39c1a8',
    status: { en: 'SAMPLE', vi: 'DỮ LIỆU MẪU' },
    timestampUtc: '2026-10-17 09:32:45 UTC',
    source: 'sample',
  },
];

export const STITCH_TOKEN_SWATCHES: ControlDeckDataset['tokenSwatches'] = [
  { name: 'Canvas Base', cssVar: '--color-canvas-base', colorValue: '#090A10', role: { en: 'Root non-reflective dark floor', vi: 'Nền gốc tối chống mỏi mắt' } },
  { name: 'Surface Elevation 1', cssVar: '--color-surface-elev-1', colorValue: '#11131F', role: { en: 'Docked inspector racks & KPI cards', vi: 'Khung bảng điều khiển & thẻ chỉ số' } },
  { name: 'Director Indigo', cssVar: '--primary', colorValue: 'hsl(var(--primary))', role: { en: 'Primary transport actions & playhead', vi: 'Nút điều khiển chính & con trỏ phát' } },
  { name: 'Executive Amber', cssVar: '--color-executive-amber', colorValue: '#F59E0B', role: { en: 'Revenue velocity & Half-Kelly gauges', vi: 'Tốc độ doanh thu & đồng hồ Half-Kelly' } },
  { name: 'Telemetry Emerald', cssVar: '--color-telemetry-emerald', colorValue: '#10B981', role: { en: 'Sample status & circuit health', vi: 'Trạng thái mẫu & mức an toàn' } },
];
