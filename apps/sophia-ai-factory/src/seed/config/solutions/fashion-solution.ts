/**
 * Solutions Catalog Data Partition — Fashion & Apparel Solution
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/fashion-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const FASHION_SOLUTION: SolutionIndustry = {
  slug: 'fashion',
  nameEn: 'Fashion & Apparel',
  nameVi: 'Thời Trang & Phụ Kiện',
  category: 'E-Commerce & Retail',
  iconName: 'Shirt',
  heroHeadlineEn: 'Runway Lookbooks & Outfit Transformations In Seconds Without Photo Studios',
  heroHeadlineVi: 'Xuất Hàng Loạt Video Biến Hình OOTD Thời Trang Không Cần Thuê Studio',
  heroSubheadlineEn: 'Transform flat-lay apparel images into dynamic runway walk models, trending styling challenges, and viral haul videos.',
  heroSubheadlineVi: 'Biến ảnh chụp sản phẩm trải phẳng thành video người mẫu catwalk sống động, phối đồ theo xu hướng và clip thử đồ triệu view.',
  painPoints: [
    {
      titleEn: 'High Model & Studio Rentals',
      titleVi: 'Chi Phí Thuê Mẫu & Studio Quá Lớn',
      descEn: 'Studio sessions cost thousands per collection with long editing lead times while micro-trends fade.',
      descVi: 'Mỗi buổi chụp/quay lookbook tốn 15-20 triệu nhưng khi ra video thì trend đã nguội.',
    },
    {
      titleEn: 'Rapid Trend Cycle Obsolescence',
      titleVi: 'Xu Hướng Thay Đổi Quá Nhanh',
      descEn: 'Fast fashion trends change weekly; traditional editing pipelines are too slow to capitalize on virality.',
      descVi: 'Mỗi tuần lại có trend phối đồ mới; làm thủ công không kịp bắt nhịp thuật toán.',
    },
    {
      titleEn: 'High Return Rates Due to Fit Concerns',
      titleVi: 'Tỉ Lệ Trả Hàng Do Khách Không Hình Dung Được Form',
      descEn: 'Customers return items when static photos fail to show fabric drape, texture, and natural movement.',
      descVi: 'Khách hàng phân vân không biết vải rủ hay đứng form, dẫn đến tỉ lệ hoàn đơn cao.',
    },
  ],
  samplePromptTitleEn: '3-Ways-to-Style Capsule Wardrobe Reel',
  samplePromptTitleVi: 'Video 1 Chiếc Áo Phối 3 Phong Cách Chuẩn Gu',
  samplePromptEn: 'Create a 15-second fast-paced styling reel showing a classic beige trench coat styled for office, weekend brunch, and date night. Upbeat trending lo-fi hip hop audio, model turns smoothly with subtle bounce.',
  samplePromptVi: 'Tạo video ngắn 15s phối đồ nhanh: 1 chiếc áo blazer mặc đi làm, đi cafe cuối tuần và đi tiệc tối. Nhạc lofi bắt trend, chuyển cảnh giậm chân biến hình cực mượt.',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 2500,
    traditionalTurnaroundDays: 7,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 30,
    estimatedMonthlySavingsUsd: 2301,
    estimatedVideoOutputPerMonth: 90,
  },
  testimonial: {
    quoteEn: 'We dropped our lookbook production budget by 80% while tripling the volume of daily TikTok Shop videos.',
    quoteVi: 'Chúng tôi cắt giảm 80% chi phí chụp lookbook mà vẫn có đều đặn 3 video thử đồ mỗi ngày trên TikTok Shop.',
    author: 'Elena Vo',
    roleEn: 'Brand Founder',
    roleVi: 'Nhà Sáng Lập Thương Hiệu',
    company: 'Silk & Minimal Studio',
    metrics: '-80% production cost and 3X video output',
  },
  faqs: [
    {
      questionEn: 'Can Sophia handle different model ethnicities and body types?',
      questionVi: 'Sophia có tạo được người mẫu với nhiều vóc dáng và màu da khác nhau không?',
      answerEn: 'Yes! You can specify model demographics, heights, and aesthetics to perfectly match your target audience.',
      answerVi: 'Chắc chắn rồi! Bạn có thể tùy chỉnh độ tuổi, chiều cao và phong cách người mẫu để phù hợp với tệp khách hàng.',
    },
  ],
  keywordsEn: ['ai fashion lookbook', 'apparel video generator', 'tiktok shop ootd video', 'clothing reels automation'],
  keywordsVi: ['video thời trang ai', 'lookbook tự động', 'video phối đồ tiktok shop', 'tạo video ootd'],
};
