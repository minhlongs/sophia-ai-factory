/**
 * Solutions Catalog Data Partition
 * Layer: Seed (Configuration and static data, imports only seed)
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { COSMETICS_SOLUTION } from './cosmetics-solution';

const REAL_ESTATE_SOLUTION: SolutionIndustry = {
  slug: 'real-estate',
  nameEn: 'Real Estate',
  nameVi: 'Bất Động Sản',
  category: 'High-Ticket Sales',
  iconName: 'Building2',
  heroHeadlineEn: 'Close Multi-Million Dollar Properties Faster With Automated AI Video Tours',
  heroHeadlineVi: 'Chốt Giao Dịch Nhà Đất Triệu Đô Nhanh Hơn Với Video Tour AI Tự Động',
  heroSubheadlineEn: 'Turn property photos and listing descriptions into cinematic walkthroughs, neighbourhood guides, and viral TikTok Reels in 60 seconds.',
  heroSubheadlineVi: 'Biến hình ảnh và mô tả dự án thành video walkthrough điện ảnh, review khu vực và clip viral TikTok chỉ trong 60 giây.',
  painPoints: [
    {
      titleEn: 'Exorbitant Video Production Costs',
      titleVi: 'Chi Phí Thuê Ekip Quay Phim Quá Đắt Đỏ',
      descEn: 'Traditional videography costs $1,500 - $3,000 per property with 2-week delays, losing hot buyer momentum.',
      descVi: 'Mỗi video quay nhà đất tốn 10 - 30 triệu VNĐ và mất 2 tuần hậu kỳ, làm nguội tệp khách mua tiềm năng.',
    },
    {
      titleEn: 'Repetitive Listing Explanations',
      titleVi: 'Tốn Hàng Giờ Lặp Lại Thông Tin Căn Hộ',
      descEn: 'Agents waste dozens of hours repeating square footage, zoning laws, and pricing to unqualified leads.',
      descVi: 'Môi giới mất hàng chục giờ lặp lại diện tích, pháp lý và giá cho những khách hàng chưa đủ tiêu chuẩn tài chính.',
    },
    {
      titleEn: 'Low Social Media Reach',
      titleVi: 'Kênh TikTok & Reels Thiếu Nội Dung Đều Đặn',
      descEn: 'Static images get buried by social algorithms that strictly prioritize daily short-form video content.',
      descVi: 'Hình ảnh tĩnh bị thuật toán bóp tương tác, nhường chỗ hoàn toàn cho các video ngắn đăng tải đều đặn mỗi ngày.',
    },
  ],
  samplePromptTitleEn: 'Luxury Penthouse Tour Hook & Breakdown',
  samplePromptTitleVi: 'Kịch Bản Hook Review Penthouse Triệu Đô',
  samplePromptEn: 'Create a 45-second high-energy luxury penthouse walkthrough in downtown, highlighting private elevator access, panoramic sunset terrace views, and exclusive 24/7 concierge amenities. Hook: "Would you spend $1.8M just for this elevator view?"',
  samplePromptVi: 'Tạo video 45 giây review căn Penthouse view sông đẳng cấp: thang máy riêng, ban công ngắm hoàng hôn 360 độ và tiện ích đặc quyền. Mở đầu bằng câu hook: "Liệu bạn có sẵn sàng chi 45 tỷ chỉ để sở hữu góc thang máy này?"',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 3200,
    traditionalTurnaroundDays: 14,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 60,
    estimatedMonthlySavingsUsd: 3001,
    estimatedVideoOutputPerMonth: 60,
  },
  testimonial: {
    quoteEn: 'Sophia AI helped our agency generate 38 qualified buyer inquiries in 30 days without hiring a single cameraman.',
    quoteVi: 'Sophia AI giúp sàn bất động sản của tôi chốt 38 khách nét trong 30 ngày mà không cần thuê bất kỳ thợ quay nào.',
    author: 'Marcus Vance',
    roleEn: 'Managing Broker',
    roleVi: 'Giám Đốc Kinh Doanh Sàn',
    company: 'Vance Prestige Realty',
    metrics: '+340% inbound inquiries in 30 days',
  },
  faqs: [
    {
      questionEn: 'Can I generate videos using only property photos?',
      questionVi: 'Tôi có thể tạo video chỉ từ hình ảnh căn hộ chụp bằng điện thoại không?',
      answerEn: 'Yes! Sophia AI Factory automatically analyzes property photos, enhances lighting, stitches cinematic transitions, and adds AI voiceover with synced subtitles.',
      answerVi: 'Hoàn toàn được! Sophia AI Factory tự động xử lý ảnh, tạo chuyển cảnh điện ảnh mượt mà, lồng tiếng AI truyền cảm và chèn phụ đề tự động.',
    },
    {
      questionEn: 'Does Sophia support Vietnamese voiceover accents?',
      questionVi: 'Sophia có hỗ trợ giọng đọc tiếng Việt Bắc/Nam chuẩn không?',
      answerEn: 'Yes, Sophia supports 50+ hyper-natural voices including Northern and Southern Vietnamese regional tones with natural emotional inflections.',
      answerVi: 'Có, Sophia tích hợp hơn 50 giọng đọc tự nhiên bao gồm cả giọng Hà Nội và Sài Gòn với ngữ điệu bán hàng chuyên nghiệp.',
    },
    {
      questionEn: 'How does the Telegram bot lead qualification work?',
      questionVi: 'Tính năng phân loại khách hàng qua Telegram Bot hoạt động ra sao?',
      answerEn: 'A deep-link in your video caption routes buyers directly into our automated qualification bot to collect budget, preferred location, and timing before alerting you.',
      answerVi: 'Đường link trong video dẫn khách thẳng vào Bot Telegram để khảo sát ngân sách, khu vực mong muốn và thời điểm mua rồi gửi thông báo ngay cho bạn.',
    },
  ],
  keywordsEn: ['real estate ai video', 'property listing video generator', 'realtor tiktok marketing', 'automated property tours'],
  keywordsVi: ['video bất động sản ai', 'tạo video bán nhà tự động', 'marketing bđs tiktok', 'review căn hộ tự động'],
};

export const REAL_ESTATE_COSMETICS_SOLUTIONS: SolutionIndustry[] = [
  REAL_ESTATE_SOLUTION,
  COSMETICS_SOLUTION,
];
