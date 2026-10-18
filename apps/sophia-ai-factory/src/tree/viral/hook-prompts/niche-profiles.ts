/**
 * @file niche-profiles.ts
 * @description Domain profiles and psychological hook archetypes for viral niches.
 * @layer tree
 */

import type { ViralNiche } from '@/seed/types/growth';
import type { NicheProfile } from './types';

export { ARCHETYPE_DEFINITIONS } from './hook-archetype-definitions';

export const NICHE_PROFILES: Record<ViralNiche, NicheProfile> = {
  ai_automation: {
    id: 'ai_automation',
    name: 'AI Automation & Agency',
    nameVi: 'Tự Động Hóa AI & Agency',
    targetAudience: 'Agency owners, operational managers, developers, and B2B founders',
    targetAudienceVi: 'Chủ agency, quản lý vận hành, lập trình viên và nhà sáng lập B2B',
    primaryPains: [
      'Paying $5K-$10K/mo for human staff performing repetitive manual workflows',
      'Client churn due to slow turnaround and inconsistent execution',
      'Struggling to generate qualified inbound leads without huge ad spend',
    ],
    primaryPainsVi: [
      'Chi trả 50M-150M/tháng cho nhân sự thủ công lặp đi lặp lại',
      'Khách hàng rời bỏ vì thời gian bàn giao chậm và chất lượng thất thường',
      'Thiếu hụt lead B2B chất lượng cao nếu không đốt tiền vào quảng cáo',
    ],
    desires: [
      'Deploy 24/7 autonomous video and sales agents',
      'Scale agency capacity 10x without adding headcount',
      'Predictable $10K-$50K MRR pipeline on autopilot',
    ],
    desiresVi: [
      'Triển khai agent bán hàng và sản xuất video tự động 24/7',
      'Mở rộng quy mô agency gấp 10 lần mà không cần tăng nhân sự',
      'Dòng doanh thu định kỳ $10K-$50K MRR ổn định',
    ],
    recommendedKeywords: ['#AIAutomation', '#AgencyScaling', '#AIAgents', '#WorkflowAutomation', '#NoCodeAI'],
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce & TikTok Shop',
    nameVi: 'Thương Mại Điện Tử & TikTok Shop',
    targetAudience: 'Online store owners, TikTok Shop creators, dropshippers, brand marketers',
    targetAudienceVi: 'Chủ shop online, nhà sáng tạo TikTok Shop, dropshipper, marketer thương hiệu',
    primaryPains: [
      'Skyrocketing Facebook and TikTok ad CPMs with tanking ROAS',
      'High cost and slow turnaround of hiring UGC creators ($100-$300 per video)',
      'Product catalog videos taking weeks to produce instead of hours',
    ],
    primaryPainsVi: [
      'Chi phí quảng cáo TikTok/Facebook tăng phi mã, ROAS sụt giảm nghiêm trọng',
      'Thuê KOC/KOL làm UGC tốn kém và mất thời gian (1-5 triệu/video)',
      'Quay dựng video cho toàn bộ danh mục sản phẩm mất hàng tuần trời',
    ],
    desires: [
      'Generate 100 high-converting product videos daily on autopilot',
      'Achieve 4x-10x ROAS with irresistible video hooks and unboxing proof',
      'Dominate TikTok Shop FYP and Shopee Video feeds with viral reach',
    ],
    desiresVi: [
      'Tự động tạo 100 video sản phẩm chuyển đổi cao mỗi ngày',
      'Tối ưu ROAS từ 4x đến 10x nhờ hook cuốn hút và visual chân thực',
      'Chiếm lĩnh xu hướng TikTok Shop và Shopee Video thu hút hàng triệu view',
    ],
    recommendedKeywords: ['#TikTokShop', '#EcommerceHacks', '#Dropshipping', '#UGCAds', '#EcommerceMarketing'],
  },
  solopreneur: {
    id: 'solopreneur',
    name: 'Solopreneur & 1-Person Business',
    nameVi: 'Kinh Doanh Độc Lập & Solopreneur',
    targetAudience: 'Solo founders, course creators, digital product sellers, freelancers',
    targetAudienceVi: 'Solo founder, người bán sản phẩm số, người dạy khóa học, freelancer',
    primaryPains: [
      'Trapped in the time-for-money hamster wheel with zero leverage',
      'Imposter syndrome or fear of showing face on camera',
      'Overwhelmed by marketing, content creation, and sales funnels alone',
    ],
    primaryPainsVi: [
      'Mắc kẹt trong vòng xoáy bán thời gian đổi tiền mà không có đòn bẩy',
      'Ngại xuất hiện trước ống kính hoặc không có thời gian tự quay video',
      'Quá tải khi phải tự làm nội dung, marketing và chốt đơn một mình',
    ],
    desires: [
      'Build a faceless short-video empire hitting $5K-$10K MRR',
      'Complete time and location freedom powered by autonomous AI systems',
      'Scale high-ticket digital products without hiring employees',
    ],
    desiresVi: [
      'Xây dựng kênh video không lộ mặt đạt cột mốc $5K-$10K MRR',
      'Tự do thời gian và địa điểm nhờ hệ thống AI vận hành tự động',
      'Bán sản phẩm số và dịch vụ giá trị cao mà không cần nhân viên',
    ],
    recommendedKeywords: ['#Solopreneur', '#1PersonBusiness', '#PassiveIncome', '#FacelessChannel', '#SideHustle'],
  },
};
