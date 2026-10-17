/**
 * Solutions Catalog Data Partition — Insurance Solution
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/insurance-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const INSURANCE_SOLUTION: SolutionIndustry = {
  slug: 'insurance',
  nameEn: 'Insurance',
  nameVi: 'Bảo Hiểm',
  category: 'Financial Services',
  iconName: 'ShieldCheck',
  heroHeadlineEn: 'De-Mystify Complex Policies & Sign More Policyholders With Compassionate Video',
  heroHeadlineVi: 'Giải Thích Điều Khoản Dễ Hiểu & Tư Vấn Hợp Đồng Bảo Hiểm Nhanh Chóng',
  heroSubheadlineEn: 'Turn confusing policy legalese into compassionate case studies, financial security roadmaps, and instant trust builders.',
  heroSubheadlineVi: 'Biến những điều khoản khô khan thành câu chuyện bảo vệ gia đình chân thực, minh bạch quyền lợi bồi thường và xây dựng lòng tin.',
  painPoints: [
    {
      titleEn: 'Low Consumer Trust and High Skepticism',
      titleVi: 'Khách Hàng Còn E Ngại & Nghi Ngờ Bảo Hiểm',
      descEn: 'Prospects dread sales pitches and assume insurance contracts hide predatory fine print.',
      descVi: 'Khách thường sợ bị chèo kéo và lo ngại hợp đồng có các điều khoản loại trừ khó hiểu.',
    },
    {
      titleEn: 'Complex Products Hard to Explain Briefly',
      titleVi: 'Sản Phẩm Phức Tạp Khó Truyền Đạt Trong Vài Phút',
      descEn: 'Explaining riders, surrender values, and critical illness tiers usually requires tedious meetings.',
      descVi: 'Giải thích quyền lợi nội trú, bệnh hiểm nghèo và giá trị hoàn lại tốn nhiều buổi gặp mặt.',
    },
    {
      titleEn: 'High Agent Attrition Due to Rejection',
      titleVi: 'Đại Lý Dễ Bỏ Cuộc Vì Bị Từ Chối Quá Nhiều',
      descEn: 'Cold calling and door-to-door prospecting yield high rejection and fast agent burnout.',
      descVi: 'Tìm kiếm khách hàng bằng gọi điện thoại hay phát tờ rơi khiến tư vấn viên mệt mỏi và dễ nản lòng.',
    },
  ],
  samplePromptTitleEn: 'Term vs Whole Life Insurance Comparison in 30 Seconds',
  samplePromptTitleVi: 'So Sánh Bảo Hiểm Tử Kỳ & Trọn Đời Trong 30 Giây',
  samplePromptEn: 'Create a 30-second educational reel comparing Term Life and Universal Life insurance using a clear visual scale. Friendly, financial advisor tone explaining which policy fits young families best.',
  samplePromptVi: 'Tạo video ngắn 30s giải thích sự khác biệt giữa bảo hiểm tử kỳ và trọn đời. Hình ảnh trực quan, giọng đọc chân thành, giúp các cặp vợ chồng trẻ chọn đúng gói bảo vệ.',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 1800,
    traditionalTurnaroundDays: 7,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 45,
    estimatedMonthlySavingsUsd: 1601,
    estimatedVideoOutputPerMonth: 60,
  },
  testimonial: {
    quoteEn: 'My team generated 42 warm consultation requests last month from automated TikTok educational shorts.',
    quoteVi: 'Nhóm tư vấn của tôi nhận được 42 yêu cầu hoạch định tài chính chỉ trong tháng vừa rồi nhờ các video ngắn chia sẻ kiến thức do Sophia tạo ra.',
    author: 'Nguyen Thi Mai',
    roleEn: 'Senior Agency Director',
    roleVi: 'Trưởng Ban Kinh Doanh',
    company: 'PrimeLife Financial',
    metrics: '+42 warm family policy inquiries in 30 days',
  },
  faqs: [
    {
      questionEn: 'Are policy benefit explanations legally compliant?',
      questionVi: 'Nội dung video có đảm bảo tính pháp lý và quy định bảo hiểm không?',
      answerEn: 'Sophia emphasizes objective education, benefit transparency, and disclaimer overlays to ensure full compliance with regional insurance regulations.',
      answerVi: 'Kịch bản tập trung vào việc minh bạch quyền lợi và tự động gắn các lưu ý pháp lý cần thiết để đảm bảo chuẩn mực ngành tài chính.',
    },
  ],
  keywordsEn: ['insurance agent marketing', 'life insurance reels', 'insurance tiktok video maker', 'financial advisor shorts'],
  keywordsVi: ['marketing tư vấn bảo hiểm', 'làm video tiktok bảo hiểm', 'tìm khách hàng bảo hiểm nhân thọ', 'kịch bản tài chính bảo hiểm'],
};
