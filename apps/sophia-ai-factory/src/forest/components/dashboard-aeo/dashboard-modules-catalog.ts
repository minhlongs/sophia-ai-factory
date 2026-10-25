/**
 * Catalog of the 16+ core dashboard modules with bilingual metadata and prompt suggestions.
 * Layer: forest/components/dashboard-aeo
 */

export interface DashboardModuleDescriptor {
  readonly slug: string;
  readonly titleVi: string;
  readonly titleEn: string;
  readonly purposeVi: string;
  readonly purposeEn: string;
  readonly recommendedPromptVi: string;
  readonly recommendedPromptEn: string;
}

export const DASHBOARD_MODULES_CATALOG: Readonly<Record<string, DashboardModuleDescriptor>> = {
  overview: {
    slug: 'overview',
    titleVi: 'Trung Tâm Chỉ Huy Tổng Quan (Executive Overview)',
    titleEn: 'Executive Command Overview',
    purposeVi: 'Theo dõi tổng doanh thu Affiliate USDT, tiến độ dựng video AI, hạn mức MCU và trạng thái sẵn sàng.',
    purposeEn: 'Monitor aggregate USDT affiliate revenue, AI video render velocity, MCU quota, and readiness.',
    recommendedPromptVi: 'Hãy phân tích hiệu suất phễu video AI hiện tại và đề xuất 3 hành động tối ưu hóa chuyển đổi affiliate.',
    recommendedPromptEn: 'Analyze current AI video funnel metrics and recommend 3 high-leverage affiliate conversion optimizations.',
  },
  campaigns: {
    slug: 'campaigns',
    titleVi: 'Chiến Dịch Sản Xuất Video AI (Campaigns)',
    titleEn: 'AI Video Production Campaigns',
    purposeVi: 'Quản lý luồng tự động tạo kịch bản, giọng đọc ElevenLabs, avatar HeyGen/D-ID và lịch đăng đa kênh.',
    purposeEn: 'Manage automated scripting, ElevenLabs voice synthesis, HeyGen/D-ID avatars, and multi-channel scheduling.',
    recommendedPromptVi: 'Dựa trên trạng thái chiến dịch này, hãy đề xuất 5 tiêu đề video chuẩn AEO/GEO có CTR cao nhất.',
    recommendedPromptEn: 'Based on this campaign state, suggest 5 high-CTR AEO/GEO video hooks and titles.',
  },
  affiliate: {
    slug: 'affiliate',
    titleVi: 'Đế Chế Tiếp Thị Liên Kết 9 Mạng Lưới (Affiliate Empire)',
    titleEn: '9-Network Affiliate Empire',
    purposeVi: 'Theo dõi shortlink /r/code, EPC, tỷ lệ nhấp và hoa hồng trên Impact, PartnerStack, Binance, Bybit, ClickBank.',
    purposeEn: 'Track /r/code shortlinks, EPC, click-through rates, and commissions across 9 affiliate networks.',
    recommendedPromptVi: 'Hãy đánh giá mạng lưới affiliate nào có EPC tốt nhất cho ngách video hiện tại.',
    recommendedPromptEn: 'Evaluate which affiliate network offers the highest EPC for our active video vertical.',
  },
  monetization: {
    slug: 'monetization',
    titleVi: 'Kiếm Tiền & Đối Soát Thanh Toán USDT (Monetization)',
    titleEn: 'USDT Monetization & NOWPayments Settlement',
    purposeVi: 'Quản lý dòng tiền NOWPayments IPN, PayOS nội địa, hạn mức gói cước và đối soát hoa hồng.',
    purposeEn: 'Manage NOWPayments USDT IPN webhooks, PayOS domestic rails, tier quotas, and payout reconciliation.',
    recommendedPromptVi: 'Kiểm tra tỷ lệ hoàn vốn (ROI) giữa chi phí MCU/BYOK và doanh thu hoa hồng thực nhận.',
    recommendedPromptEn: 'Audit the ROI ratio between MCU/BYOK compute spend and settled affiliate commissions.',
  },
  youtube: {
    slug: 'youtube',
    titleVi: 'Tự Động Hóa Kênh YouTube Không Lộ Mặt (Faceless YouTube)',
    titleEn: 'Faceless YouTube Channel Automation',
    purposeVi: 'Quản lý lịch đăng, kịch bản, SEO metadata và tối ưu hóa thời lượng xem trên YouTube.',
    purposeEn: 'Orchestrate publishing calendars, scripts, SEO metadata, and retention learnings across YouTube channels.',
    recommendedPromptVi: 'Tối ưu hóa mô tả video YouTube và chương mục (timestamps) để AI Answer Engine trích dẫn.',
    recommendedPromptEn: 'Optimize YouTube descriptions and chapter timestamps for AI Answer Engine citation.',
  },
  sops: {
    slug: 'sops',
    titleVi: 'Thư Viện Quy Trình Tự Động Hóa (SOP Marketplace)',
    titleEn: 'Autonomous SOP Workflows',
    purposeVi: 'Cài đặt và thực thi các quy trình chuẩn hóa (SOP) chạy ngầm trên Inngest & Cloudflare Workers.',
    purposeEn: 'Install and execute standardized autonomous SOP pipelines backed by Inngest and Cloudflare Workers.',
    recommendedPromptVi: 'Đề xuất cấu hình SOP tự động hóa phù hợp nhất với hạn mức gói hiện tại.',
    recommendedPromptEn: 'Recommend the optimal autonomous SOP schedule within current tier limits.',
  },
  missions: {
    slug: 'missions',
    titleVi: 'Nhiệm Vụ Đa Tác Tử AI (Agent Missions)',
    titleEn: 'Multi-Agent Autonomous Missions',
    purposeVi: 'Điều phối đội ngũ C-Level AI Agents thực thi mục tiêu tăng trưởng từ đầu đến cuối.',
    purposeEn: 'Coordinate C-Level AI Agents executing end-to-end growth and content missions.',
    recommendedPromptVi: 'Chia nhỏ mục tiêu doanh thu tháng này thành 3 nhiệm vụ cụ thể cho đội ngũ AI Agent.',
    recommendedPromptEn: 'Decompose this month revenue target into 3 concrete autonomous agent missions.',
  },
  settings: {
    slug: 'settings',
    titleVi: 'Cấu Hình Hệ Thống & BYOK (Settings & Security)',
    titleEn: 'System Settings & BYOK Security Vault',
    purposeVi: 'Quản lý khóa BYOK đã mã hóa, bảo mật 2 lớp (MFA), tên miền riêng và trạng thái Open-Core.',
    purposeEn: 'Manage encrypted BYOK keys, MFA security, custom domains, and Open-Core readiness.',
    recommendedPromptVi: 'Kiểm tra danh sách các kết nối BYOK cần thiết để vận hành toàn bộ dây chuyền không gián đoạn.',
    recommendedPromptEn: 'Verify the required BYOK provider checklist for uninterrupted production.',
  },
};
