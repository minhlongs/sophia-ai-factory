import type { ControlDeckDataset } from '@/seed/types/stitch-control-deck';
import { STITCH_CONTROL_DECK_SCREENS } from './stitch-deck-screens';
import {
  STITCH_TIMELINE_TRACKS,
  STITCH_SETTLEMENTS,
  STITCH_TOKEN_SWATCHES,
} from './stitch-deck-telemetry-data';

export const STITCH_CONTROL_DECK_DATASET: ControlDeckDataset = {
  projectId: '8279482791013273159',
  designSystemAssetId: 'assets/7751c3f406364fb3aa630d4177bb50cd',
  directionName: {
    en: "Direction A — Director's Control Deck (Cinema Graphite & Photon Indigo)",
    vi: "Hướng A — Bàn Chỉ Huy Đạo Diễn (Than Chì Điện Ảnh & Chàm Photon)",
  },
  screens: STITCH_CONTROL_DECK_SCREENS,
  mabArms: [
    {
      armId: 'arm-alpha-01',
      hookName: { en: 'Contrarian Founder Secret (0–3s Pattern Interrupt)', vi: 'Bí Mật Ngược Đám Đông Của Nhà Sáng Lập (Ngắt Nhịp 0–3s)' },
      alpha: 142,
      beta: 19,
      winProbabilityPct: 88.2,
      halfKellyAllocationPct: 18.4,
      roasMultiplier: '4.6x',
      isChampion: true,
    },
    {
      armId: 'arm-beta-02',
      hookName: { en: 'Visual Revenue Ledger Proof + Split-Screen Demo', vi: 'Bằng Chứng Sổ Cái Doanh Thu + Demo Chia Đôi Màn Hình' },
      alpha: 89,
      beta: 31,
      winProbabilityPct: 74.1,
      halfKellyAllocationPct: 11.2,
      roasMultiplier: '3.2x',
      isChampion: false,
    },
    {
      armId: 'arm-gamma-03',
      hookName: { en: 'Bilingual Case Study: Zero-Editor 30-Video Sprint', vi: 'Case Study Song Ngữ: 30 Video Không Cần Dựng Phim' },
      alpha: 64,
      beta: 28,
      winProbabilityPct: 69.5,
      halfKellyAllocationPct: 8.5,
      roasMultiplier: '2.8x',
      isChampion: false,
    },
  ],
  advisors: [
    {
      advisorId: 'sun-tzu',
      personaTitle: { en: 'Sun Tzu · Strategic Positioning', vi: 'Tôn Tử · Định Vị Chiến Lược' },
      domainFocus: { en: 'Asymmetric Niche Dominance (始計)', vi: 'Chiếm Lĩnh Ngách Bất Đối Xứng (始計)' },
      verdictSummary: {
        en: 'Capture high-intent B2B SaaS Shorts in VN/SEA before competitors saturate English keywords.',
        vi: 'Đánh chiếm ngách Shorts B2B SaaS tại VN/Đông Nam Á trước khi đối thủ bão hòa từ khóa tiếng Anh.',
      },
      confidenceScorePct: 97,
      accentToken: 'var(--color-director-indigo)',
    },
    {
      advisorId: 'munger',
      personaTitle: { en: 'Charlie Munger · Inversion & Risk', vi: 'Charlie Munger · Tư Duy Ngược & Rủi Ro' },
      domainFocus: { en: 'Half-Kelly Capital Preservation', vi: 'Bảo Toàn Vốn Theo Chuẩn Half-Kelly' },
      verdictSummary: {
        en: 'Cap daily exploration spend at 18.4% of net margin; auto-halt any creative arm below 1.8x ROAS.',
        vi: 'Giới hạn ngân sách thử nghiệm ở mức 18.4% biên lợi nhuận ròng; tự ngắt nhánh dưới 1.8x ROAS.',
      },
      confidenceScorePct: 95,
      accentToken: 'var(--color-executive-amber)',
    },
    {
      advisorId: 'feynman',
      personaTitle: { en: 'Richard Feynman · First-Principles Clarity', vi: 'Richard Feynman · Nguyên Lý Gốc Rõ Ràng' },
      domainFocus: { en: 'Zero-Jargon Script Compression', vi: 'Nén Kịch Bản Không Thuật Ngữ Rối Rắm' },
      verdictSummary: {
        en: 'Replace technical AI pipeline terms with tangible time-saved and revenue-earned analogies in first 5s.',
        vi: 'Thay thế thuật ngữ kỹ thuật bằng ví dụ thực tế về thời gian tiết kiệm và doanh thu trong 5 giây đầu.',
      },
      confidenceScorePct: 96,
      accentToken: 'var(--color-telemetry-emerald)',
    },
    {
      advisorId: 'ogilvy',
      personaTitle: { en: 'David Ogilvy · Direct-Response Hook', vi: 'David Ogilvy · Mở Đầu Chuyển Đổi Trực Tiếp' },
      domainFocus: { en: 'Headline & CTA Conversion Velocity', vi: 'Tốc Độ Chuyển Đổi Tiêu Đề & Kêu Gọi Hành Động' },
      verdictSummary: {
        en: 'Lead with the $4,200/month editor replacement figure in the top caption bar across all 9:16 cuts.',
        vi: 'Đặt ngay con số tiết kiệm $4,200/tháng chi phí dựng phim ở dòng tiêu đề đầu tiên của mọi video 9:16.',
      },
      confidenceScorePct: 98,
      accentToken: 'var(--color-neural-violet)',
    },
  ],
  timelineTracks: STITCH_TIMELINE_TRACKS,
  settlements: STITCH_SETTLEMENTS,
  tokenSwatches: STITCH_TOKEN_SWATCHES,
};
