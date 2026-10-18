import type { StitchRouteBannerSpec } from './route-banner-specs';

export type StitchWave2RouteBannerKey =
  | 'creative-economy'
  | 'youtube'
  | 'playbooks'
  | 'publish-queue'
  | 'marketplace'
  | 'my-sops'
  | 'challenges'
  | 'handover'
  | 'system-health';

export const STITCH_WAVE2_ROUTE_BANNER_SPECS: Readonly<
  Record<StitchWave2RouteBannerKey, StitchRouteBannerSpec>
> = {
  'creative-economy': {
    ariaLabel: { vi: 'Bản xem trước Kinh Tế Sáng Tạo & Vòng Lặp Học Tập', en: 'Creative Economy & Learning Loop preview' },
    badge: { vi: 'STITCH v4.2 · KINH TẾ SÁNG TẠO', en: 'STITCH v4.2 · CREATIVE ECONOMY' },
    pill: { vi: 'PHÂN BỔ HALF-KELLY', en: 'HALF-KELLY ALLOCATION' },
    title: { vi: 'Vòng lặp học tập 30 ngày, bộ nhớ sáng tạo và cố vấn tái đầu tư Half-Kelly.', en: '30-day learning loop velocity, creative memory, and Half-Kelly reinvestment advisor.' },
    description: { vi: 'Theo dõi hiệu suất tài sản đa kênh, tốc độ hội tụ MAB và đề xuất phân bổ vốn tự động.', en: 'Track multi-channel asset ROI, MAB convergence velocity, and automated capital allocation.' },
    ctaLabel: { vi: 'Mở Bàn Chỉ Huy', en: 'Open Control Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  youtube: {
    ariaLabel: { vi: 'Bản xem trước Đường Ống Tự Động Hóa YouTube', en: 'YouTube Automation Pipeline preview' },
    badge: { vi: 'STITCH v4.2 · TỰ ĐỘNG HÓA YOUTUBE', en: 'STITCH v4.2 · YOUTUBE AUTOMATION' },
    pill: { vi: 'ĐƯỜNG ỐNG TỰ HÀNH', en: 'AUTONOMOUS PIPELINE' },
    title: { vi: 'Điều phối lịch xuất bản YouTube, kịch bản AI và tự động hóa kênh Cash-Cow.', en: 'Orchestrate YouTube publishing calendars, AI scripts, and Cash-Cow channel automation.' },
    description: { vi: 'Quản lý nhịp đăng tải, tiến độ render đa luồng và tối ưu hóa giữ chân khán giả.', en: 'Manage upload cadence, multi-stage render progress, and audience retention optimization.' },
    ctaLabel: { vi: 'Mở Xưởng YouTube', en: 'Open YouTube Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'indigo',
  },
  playbooks: {
    ariaLabel: { vi: 'Bản xem trước Playbook Tự Động Hóa & Quy Tắc Học Máy', en: 'Automation Playbooks & Learning Rules preview' },
    badge: { vi: 'STITCH v4.2 · KHO PLAYBOOK CHIẾN LƯỢC', en: 'STITCH v4.2 · STRATEGIC PLAYBOOKS' },
    pill: { vi: 'TỰ ĐỘNG ÁP DỤNG', en: 'AUTO-APPLY RULES' },
    title: { vi: 'Mẫu chiến dịch thắng cuộc, quy tắc tự động áp dụng và lịch chạy hàng loạt.', en: 'Winning campaign patterns, auto-apply optimization rules, and batch execution schedules.' },
    description: { vi: 'Chuẩn hóa quy trình tăng trưởng từ dữ liệu thực nghiệm với cơ chế hoàn tác an toàn.', en: 'Codify empirical growth workflows with one-click rollback safety guards.' },
    ctaLabel: { vi: 'Mở Bàn Playbook', en: 'Open Playbook Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'emerald',
  },
  'publish-queue': {
    ariaLabel: { vi: 'Bản xem trước Hàng Đợi Xuất Bản Đa Nền Tảng', en: 'Multi-Platform Publish Queue preview' },
    badge: { vi: 'STITCH v4.2 · HÀNG ĐỢI XUẤT BẢN', en: 'STITCH v4.2 · PUBLISH QUEUE' },
    pill: { vi: 'MA TRẬN 5 KÊNH', en: '5-CHANNEL MATRIX' },
    title: { vi: 'Đồng bộ xuất bản YouTube Shorts, TikTok, Instagram Reels, Facebook và X.', en: 'Synchronized publishing across YouTube Shorts, TikTok, Instagram Reels, Facebook, and X.' },
    description: { vi: 'Kiểm soát khung giờ vàng, trạng thái phân phối API và cơ chế thử lại tự động.', en: 'Monitor prime-time slots, API dispatch telemetry, and automated retry resilience.' },
    ctaLabel: { vi: 'Mở Hàng Đợi', en: 'Open Publish Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'indigo',
  },
  marketplace: {
    ariaLabel: { vi: 'Bản xem trước Chợ Quy Trình SOP & Mẫu Tự Động Hóa', en: 'SOP Marketplace & Automation Templates preview' },
    badge: { vi: 'STITCH v4.2 · CHỢ SOP TỰ HÀNH', en: 'STITCH v4.2 · SOP MARKETPLACE' },
    pill: { vi: '36+ QUY TRÌNH MẪU', en: '36+ OFFICIAL SOPS' },
    title: { vi: 'Khám phá và cài đặt quy trình SOP chuẩn hóa cho đại lý video AI và tăng trưởng.', en: 'Discover and install verified SOP workflows for AI video agencies and growth teams.' },
    description: { vi: 'Triển khai ngay các kịch bản TikTok, YouTube SEO và chăm sóc khách hàng tự động.', en: 'Deploy turnkey TikTok, YouTube SEO, and automated lead-nurture blueprints in one click.' },
    ctaLabel: { vi: 'Mở Chợ SOP', en: 'Open Marketplace Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  'my-sops': {
    ariaLabel: { vi: 'Bản xem trước Quản Lý SOP Đã Cài Đặt', en: 'Installed SOPs Management preview' },
    badge: { vi: 'STITCH v4.2 · SOP CỦA TÔI', en: 'STITCH v4.2 · MY INSTALLED SOPS' },
    pill: { vi: 'ĐANG VẬN HÀNH', en: 'ACTIVE WORKFLOWS' },
    title: { vi: 'Quản lý cấu hình, lịch kích hoạt và nhật ký thực thi của các SOP đã cài đặt.', en: 'Manage configurations, cron triggers, and execution logs for your installed SOPs.' },
    description: { vi: 'Theo dõi trạng thái hoạt động và tùy chỉnh tham số vận hành theo từng workspace.', en: 'Monitor operational health and fine-tune execution parameters per workspace.' },
    ctaLabel: { vi: 'Mở Bàn SOP', en: 'Open SOP Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'emerald',
  },
  challenges: {
    ariaLabel: { vi: 'Bản xem trước Thử Thách Tăng Trưởng & Phần Thưởng', en: 'Growth Challenges & Rewards preview' },
    badge: { vi: 'STITCH v4.2 · THỬ THÁCH TĂNG TRƯỞNG', en: 'STITCH v4.2 · GROWTH CHALLENGES' },
    pill: { vi: 'THƯỞNG HOA HỒNG', en: 'COMMISSION BOOST' },
    title: { vi: 'Hoàn thành cột mốc sản xuất để mở khóa tín dụng AI và tăng mức hoa hồng đối tác.', en: 'Complete production milestones to unlock AI credits and partner commission boosts.' },
    description: { vi: 'Theo dõi tiến độ thử thách theo thời gian thực và nhận huy hiệu thành tích.', en: 'Track real-time challenge progression and claim verified achievement rewards.' },
    ctaLabel: { vi: 'Mở Bàn Thử Thách', en: 'Open Challenges Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'amber',
  },
  handover: {
    ariaLabel: { vi: 'Bản xem trước Bàn Giao Hệ Thống & Nghiệm Thu Số', en: 'System Handover & Digital Acceptance preview' },
    badge: { vi: 'STITCH v4.2 · BÀN GIAO & NGHIỆM THU', en: 'STITCH v4.2 · HANDOVER & RUNBOOKS' },
    pill: { vi: 'CHỨNG THỰC SHA-256', en: 'SHA-256 VERIFIED' },
    title: { vi: 'Ký nghiệm thu bàn giao hệ thống White-Label và xác thực chứng chỉ vận hành.', en: 'Execute white-label handover sign-off and verify cryptographic operational certificates.' },
    description: { vi: 'Đảm bảo toàn vẹn cấu hình đại lý, danh mục kiểm tra tự động và sổ tay vận hành.', en: 'Ensure agency provisioning integrity, automated preflight checks, and sovereign runbooks.' },
    ctaLabel: { vi: 'Mở Bàn Nghiệm Thu', en: 'Open Handover Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'emerald',
  },
  'system-health': {
    ariaLabel: { vi: 'Bản xem trước Giám Sát Sức Khỏe Hệ Thống & Đường Ống', en: 'System Health & Pipeline Telemetry preview' },
    badge: { vi: 'STITCH v4.2 · SỨC KHỎE HỆ THỐNG', en: 'STITCH v4.2 · SYSTEM HEALTH' },
    pill: { vi: 'GIÁM SÁT THỜI GIAN THỰC', en: 'LIVE TELEMETRY' },
    title: { vi: 'Giám sát tỷ lệ hoàn thành đường ống, độ trễ phê duyệt và sức khỏe hạ tầng AI.', en: 'Monitor pipeline completion rates, approval turnaround, and AI harness health.' },
    description: { vi: 'Theo dõi chi phí mỗi lần chạy, tỷ lệ thử lại thành công và hàng đợi chờ duyệt.', en: 'Track spend per run, retry recovery rates, and pending human-in-the-loop approvals.' },
    ctaLabel: { vi: 'Mở Bàn Giám Sát', en: 'Open Health Deck' },
    ctaHref: '/dashboard/control-deck',
    tone: 'indigo',
  },
};
