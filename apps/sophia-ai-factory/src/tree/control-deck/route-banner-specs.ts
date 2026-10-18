import type { BilingualText } from '@/seed/types/stitch-control-deck';
import { STITCH_WAVE2_ROUTE_BANNER_SPECS, type StitchWave2RouteBannerKey } from './route-banner-wave2-specs';

export { STITCH_WAVE2_ROUTE_BANNER_SPECS, type StitchWave2RouteBannerKey };
export type StitchRouteBannerKey =
  | 'dashboard'
  | 'missions'
  | 'affiliate'
  | 'settings'
  | 'partner'
  | 'approvals'
  | StitchWave2RouteBannerKey;
export type StitchRouteBannerTone = 'amber' | 'indigo' | 'emerald';

export interface StitchRouteBannerSpec {
  readonly ariaLabel: BilingualText;
  readonly badge: BilingualText;
  readonly pill: BilingualText;
  readonly title: BilingualText;
  readonly description: BilingualText;
  readonly ctaLabel: BilingualText;
  readonly ctaHref: string;
  readonly tone: StitchRouteBannerTone;
}

export interface ResolvedRouteBannerCopy {
  readonly ariaLabel: string;
  readonly badge: string;
  readonly pill: string;
  readonly title: string;
  readonly description: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  readonly tone: StitchRouteBannerTone;
}

export const STITCH_ROUTE_BANNER_SPECS: Readonly<Record<StitchRouteBannerKey, StitchRouteBannerSpec>> = {
  dashboard: {
    ariaLabel: { vi: 'Bản xem trước Director’s Control Deck', en: "Director's Control Deck preview" },
    badge: { vi: 'STITCH v4.2 · 18 MÀN HÌNH GIAO DIỆN', en: 'STITCH v4.2 · 18 DESIGN SCREENS' },
    pill: { vi: 'SỐ LIỆU MẪU', en: 'SAMPLE TELEMETRY' },
    title: { vi: 'Director’s Control Deck — Bản xem trước thiết kế', en: 'Director’s Control Deck — Design Preview' },
    description: {
      vi: 'Giao diện MAB · Hội đồng 4 cố vấn · Timeline video · Sổ cái thanh toán minh họa',
      en: 'MAB interface · 4-advisor council · Video timeline · Illustrative payment ledger',
    },
    ctaLabel: { vi: 'Mở bản xem trước', en: 'Open Design Preview' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  missions: {
    ariaLabel: { vi: 'Bản xem trước quy trình phòng dựng video AI', en: 'AI video studio workflow preview' },
    badge: { vi: 'PHÒNG DỰNG VIDEO AI · BẢN XEM TRƯỚC', en: 'AI VIDEO STUDIO · DESIGN PREVIEW' },
    pill: { vi: 'Ý TƯỞNG GIAO DIỆN', en: 'CONCEPT UI' },
    title: { vi: 'Quy trình biên tập video nhiều khung hình và bản nháp chiến dịch.', en: 'A preview of multi-format video editing and campaign planning.' },
    description: { vi: 'Quy trình biên tập video nhiều khung hình và bản nháp chiến dịch.', en: 'A preview of multi-format video editing and campaign planning.' },
    ctaLabel: { vi: 'Mở Bàn Điều Khiển', en: 'Open Studio Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'indigo',
  },
  affiliate: {
    ariaLabel: { vi: 'Bảng hoa hồng đối tác', en: 'Partner commission overview' },
    badge: { vi: 'HOA HỒNG ĐỐI TÁC', en: 'PARTNER COMMISSIONS' },
    pill: { vi: 'HOA HỒNG', en: 'COMMISSION' },
    title: { vi: 'Theo dõi mã đối tác và mức hoa hồng áp dụng.', en: 'Review your partner code and applicable commission rate.' },
    description: { vi: 'Theo dõi mã đối tác và mức hoa hồng áp dụng.', en: 'Review your partner code and applicable commission rate.' },
    ctaLabel: { vi: 'Mở Bảng Đối Tác', en: 'Open Partner Dashboard' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  settings: {
    ariaLabel: { vi: 'Quản lý khóa BYOK và xuất dữ liệu workspace', en: 'BYOK key management and workspace export' },
    badge: { vi: 'QUẢN LÝ KHÓA BYOK', en: 'BYOK KEY MANAGEMENT' },
    pill: { vi: 'XUẤT WORKSPACE', en: 'WORKSPACE EXPORT' },
    title: { vi: 'Quản lý khóa nhà cung cấp và xuất dữ liệu workspace.', en: 'Manage provider keys and export workspace data.' },
    description: { vi: 'Quản lý khóa nhà cung cấp và xuất dữ liệu workspace.', en: 'Manage provider keys and export workspace data.' },
    ctaLabel: { vi: 'Quản Lý Khóa BYOK', en: 'BYOK Key Management' },
    ctaHref: '/dashboard/control-deck',
    tone: 'emerald',
  },
  partner: {
    ariaLabel: { vi: 'Cổng Quản Trị Subaccount Đại Lý White-Label Stitch v4.2', en: 'Stitch v4.2 White-Label Agency Subaccount Portal' },
    badge: { vi: 'BẢN XEM TRƯỚC · QUẢN LÝ SUBACCOUNT', en: 'DESIGN PREVIEW · AGENCY SUBACCOUNTS' },
    pill: { vi: 'BẢN MẪU GIAO DIỆN', en: 'UI CONCEPT' },
    title: { vi: 'Quản lý subaccount, hạn mức theo tenant và báo cáo song ngữ.', en: 'Manage agency subaccounts, tenant quotas, and bilingual reports.' },
    description: { vi: 'Quản lý subaccount, hạn mức theo tenant và báo cáo song ngữ.', en: 'Manage agency subaccounts, tenant quotas, and bilingual reports.' },
    ctaLabel: { vi: 'Mở Bàn Chỉ Huy Đại Lý', en: 'Open Agency Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  approvals: {
    ariaLabel: { vi: 'Bản xem trước trải nghiệm di động', en: 'Mobile workflow design preview' },
    badge: { vi: 'TRẢI NGHIỆM DI ĐỘNG · BẢN XEM TRƯỚC', en: 'MOBILE WORKFLOW · DESIGN PREVIEW' },
    pill: { vi: 'Ý TƯỞNG GIAO DIỆN', en: 'UI CONCEPT' },
    title: { vi: 'Phác thảo quy trình duyệt video và nhận thông báo thanh toán trên di động.', en: 'A concept for mobile video approvals and payment notifications.' },
    description: { vi: 'Phác thảo quy trình duyệt video và nhận thông báo thanh toán trên di động.', en: 'A concept for mobile video approvals and payment notifications.' },
    ctaLabel: { vi: 'Bàn Điều Khiển Di Động', en: 'Mobile Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'indigo',
  },
  ...STITCH_WAVE2_ROUTE_BANNER_SPECS,
};

export function resolveRouteBannerCopy(
  key: StitchRouteBannerKey,
  isVi: boolean,
): ResolvedRouteBannerCopy {
  const spec = STITCH_ROUTE_BANNER_SPECS[key];
  const lang = isVi ? 'vi' : 'en';
  return {
    ariaLabel: spec.ariaLabel[lang],
    badge: spec.badge[lang],
    pill: spec.pill[lang],
    title: spec.title[lang],
    description: spec.description[lang],
    ctaLabel: spec.ctaLabel[lang],
    ctaHref: spec.ctaHref,
    tone: spec.tone,
  };
}
