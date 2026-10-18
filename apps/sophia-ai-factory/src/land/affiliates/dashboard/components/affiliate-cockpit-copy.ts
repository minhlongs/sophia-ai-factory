/**
 * AffiliateCockpitCopy — Bilingual copy and currency formatter for AffiliateCockpitView
 * Layer: land/affiliates/dashboard/components
 */

export function formatCockpitCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export interface AffiliateCockpitCopy {
  title: string;
  subtitle: string;
  gross: string;
  holdback: string;
  netPayable: string;
  refundRate: string;
  riskWarning: string;
  winners: string;
  pruned: string;
  killSwitch: string;
  killSwitchActiveText: string;
  killSwitchNormalText: string;
  topHooksTitle: string;
  hookCol: string;
  cadenceCol: string;
  actionCol: string;
  updating: string;
}

const COCKPIT_COPY_BY_LOCALE: Record<'en' | 'vi', AffiliateCockpitCopy> = {
  vi: {
    title: 'Bảng Điều Khiển Doanh Thu & Rủi Ro Affiliate',
    subtitle: 'Theo dõi hoa hồng thực nhận, ký quỹ rủi ro 10% và thuật toán nhân bản video',
    gross: 'Tổng Doanh Thu (Gross)',
    holdback: 'Ký Quỹ Rủi Ro (10% Holdback)',
    netPayable: 'Hoa Hồng Thực Nhận (Net)',
    refundRate: 'Tỷ Lệ Hoàn Tiền',
    riskWarning: 'Cảnh báo: Tỷ lệ hoàn đơn vượt ngưỡng 15%',
    winners: 'Hook Đột Phá (Scale 4x)',
    pruned: 'Hook Cắt Tỉa (0x)',
    killSwitch: 'Khóa Dừng Khẩn Cấp (Kill Switch)',
    killSwitchActiveText: 'ĐANG KÍCH HOẠT (ĐÃ DỪNG SẢN XUẤT)',
    killSwitchNormalText: 'BÌNH THƯỜNG (TỰ ĐỘNG CHẠY)',
    topHooksTitle: 'Xếp Hạng Video Hook Theo Hiệu Suất (EPC)',
    hookCol: 'Tên Hook',
    cadenceCol: 'Tần Suất / Ngày',
    actionCol: 'Trạng Thái',
    updating: 'Đang cập nhật...',
  },
  en: {
    title: 'Affiliate Revenue & Risk Cockpit',
    subtitle: 'Monitor net commissions, 10% risk holdback, and video scaling pace',
    gross: 'Gross Revenue',
    holdback: 'Risk Reserve (10% Holdback)',
    netPayable: 'Net Payable Commission',
    refundRate: 'Refund Rate',
    riskWarning: 'Alert: Refund rate exceeds 15% threshold',
    winners: 'Scaling Winners (4x/day)',
    pruned: 'Pruned Hooks (0/day)',
    killSwitch: 'Emergency Kill Switch',
    killSwitchActiveText: 'ACTIVE (ALL PRODUCTION PAUSED)',
    killSwitchNormalText: 'NORMAL (RUNNING AUTONOMOUSLY)',
    topHooksTitle: 'Video Hook Ranking by EPC',
    hookCol: 'Hook Name',
    cadenceCol: 'Daily Pace',
    actionCol: 'Status',
    updating: 'Updating...',
  },
};

export function getAffiliateCockpitCopy(locale: 'en' | 'vi'): AffiliateCockpitCopy {
  return COCKPIT_COPY_BY_LOCALE[locale];
}
