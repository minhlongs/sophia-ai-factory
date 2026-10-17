/**
 * Solutions Catalog Data Partition — Home Services & Cleaning
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/home-services-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const HOME_SERVICES_SOLUTION: SolutionIndustry = {
  slug: 'home-services',
  nameEn: 'Home Services & Cleaning',
  nameVi: 'Dịch Vụ Nhà Cửa & Vệ Sinh',
  category: 'Local Hospitality',
  iconName: 'Home',
  heroHeadlineEn: 'Satisfying Deep-Clean & Renovation Videos That Keep Local Technicians Fully Dispatched',
  heroHeadlineVi: 'Video Vệ Sinh Nhà Cửa Thỏa Mãn Mắt Nhìn Giúp Đội Thợ Luôn Kín Lịch',
  heroSubheadlineEn: 'Leverage the viral phenomenon of oddly satisfying cleaning transformations, pest elimination, and HVAC repairs to dominate local residential service calls.',
  heroSubheadlineVi: 'Tận dụng sức hút kỳ diệu của những video dọn dẹp trước/sau siêu sạch để thu hút cư dân trong khu vực gọi dịch vụ sửa chữa và vệ sinh nhà cửa.',
  painPoints: [
    {
      titleEn: 'Competing on Low Price with Unvetted Freelancers',
      titleVi: 'Bị Cạnh Tranh Giá Rẻ Bởi Thợ Nghiệp Dư',
      descEn: 'Professional companies lose jobs to cheap handymen unless they showcase superior equipment and safety rigor.',
      descVi: 'Khách dễ chọn thợ tự do giá rẻ nếu không thấy được sự chuyên nghiệp, máy móc hiện đại của công ty bạn.',
    },
    {
      titleEn: 'Unpredictable Local Lead Flow',
      titleVi: 'Lượng Khách Gọi Lúc Nhiều Lúc Ít Thất Thường',
      descEn: 'Service crews sit idle on slow weeks when offline flyers and word-of-mouth dry up.',
      descVi: 'Đội ngũ thợ phải ngồi chờ việc vào những tuần vắng khách do tiếp thị truyền thống không hiệu quả.',
    },
    {
      titleEn: 'High Google Local Service Ad Costs',
      titleVi: 'Chi Phí Chạy Quảng Cáo Tìm Thợ Quá Đắt',
      descEn: 'Plumbing and HVAC search keywords cost upwards of $40 per phone lead in crowded urban markets.',
      descVi: 'Giá đấu thầu từ khóa sửa chữa điện nước, thông cống trên Google quá đắt đỏ và bị đối thủ click ảo.',
    },
  ],
  samplePromptTitleEn: 'Ultra-Satisfying Grout & Tile Deep Clean Reel',
  samplePromptTitleVi: 'Video Trước & Sau Tẩy Ố Sàn Gạch Cực Kỳ Thỏa Mãn',
  samplePromptEn: 'Create a 30-second hyper-satisfying split-screen transformation showing black grime instantly lifting off bathroom tiles under 200°C steam pressure. Hook: "Wait until you see what was hiding under these tiles for 10 years."',
  samplePromptVi: 'Tạo video ngắn 30s trước/sau: Máy phun hơi nước nóng 150 độ đánh bay vết ố vàng trên sàn nhà vệ sinh trong tích tắc. Hook: "Xem đến giây thứ 15 để thấy sự thay đổi kỳ diệu của căn nhà này."',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 1800,
    traditionalTurnaroundDays: 7,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 45,
    estimatedMonthlySavingsUsd: 1601,
    estimatedVideoOutputPerMonth: 60,
  },
  testimonial: {
    quoteEn: 'One satisfying upholstery cleaning reel went viral on Facebook Reels, generating 84 direct booking calls in 72 hours.',
    quoteVi: 'Chỉ một video ngắn quay cận cảnh giặt thảm siêu sạch đã mang về cho chúng tôi 84 cuộc gọi đặt lịch trong 3 ngày.',
    author: 'Quoc Bao',
    roleEn: 'Operations Manager',
    roleVi: 'Trưởng Phòng Vận Hành',
    company: 'CleanMaster Home Services',
    metrics: '+84 residential bookings from 1 viral transformation reel',
  },
  faqs: [
    {
      questionEn: 'Can Sophia add our local city and hotline to every video?',
      questionVi: 'Sophia có tự chèn khu vực phục vụ và hotline vào từng video không?',
      answerEn: 'Yes! Automated geo-targeted overlays insert your hotline, service radius, and license badge on every output clip.',
      answerVi: 'Có! Hệ thống tự động gắn tên quận/huyện, số hotline và logo công ty lên góc video để người xem tiện liên hệ ngay.',
    },
  ],
  keywordsEn: ['home cleaning video ads', 'hvac repair reels', 'pressure washing tiktok', 'local service marketing'],
  keywordsVi: ['quảng cáo dịch vụ vệ sinh nhà cửa', 'video dọn dẹp nhà tiktok', 'sửa chữa điện nước tại nhà', 'marketing dịch vụ gia đình'],
};
