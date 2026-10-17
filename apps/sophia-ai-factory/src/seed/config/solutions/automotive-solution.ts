/**
 * Solutions Catalog Data Partition — Automotive & Dealerships Solution
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/automotive-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const AUTOMOTIVE_SOLUTION: SolutionIndustry = {
  slug: 'automotive',
  nameEn: 'Automotive & Dealerships',
  nameVi: 'Ô Tô & Xe Máy',
  category: 'High-Ticket Sales',
  iconName: 'Car',
  heroHeadlineEn: 'High-Octane Vehicle Walkthroughs That Bring Qualified Drivers To Your Showroom',
  heroHeadlineVi: 'Video Trải Nghiệm Xe Đỉnh Cao Kéo Khách Lái Thử Về Showroom',
  heroSubheadlineEn: 'Turn inventory stock listings into cinematic exhaust sound demos, interior tech reviews, and financing breakdowns that spark instant showroom visits.',
  heroSubheadlineVi: 'Biến kho xe sẵn có thành những video tiếng máy phấn khích, trải nghiệm tiện nghi nội thất và tư vấn trả góp rõ ràng giúp khách muốn lái thử ngay.',
  painPoints: [
    {
      titleEn: 'Depreciating Inventory Holding Costs',
      titleVi: 'Chi Phí Lãi Vay Tồn Kho Xe Cao',
      descEn: 'Every week a car sits on the lot bleeds capital and showroom lot fee overhead.',
      descVi: 'Mỗi chiếc xe nằm ở bãi quá lâu làm đọng vốn và tốn chi phí bảo quản.',
    },
    {
      titleEn: 'Buyers Research Extensively Online First',
      titleVi: 'Khách Hàng Nghiên Cứu Rất Kỹ Trên Mạng Trước Khi Đến',
      descEn: 'Car shoppers eliminate dealerships before ever calling unless they see transparent, high-definition video walkthroughs.',
      descVi: 'Người mua xe sẽ loại bỏ những showroom không có video quay thực tế chi tiết từng góc cạnh.',
    },
    {
      titleEn: 'Financing Confusion Deters Buyers',
      titleVi: 'Khách Ngại Thủ Tục Trả Góp Phức Tạp',
      descEn: 'Shoppers hesitate to inquire because they assume monthly payments are outside their current budget.',
      descVi: 'Nhiều khách hàng e dè vì nghĩ chi phí trả góp hàng tháng vượt quá khả năng tài chính.',
    },
  ],
  samplePromptTitleEn: '30-Second Luxury Sedan Walkthrough & Sound Test',
  samplePromptTitleVi: 'Trải Nghiệm Xe Sang 30s Kèm Tiếng Bô Phấn Khích',
  samplePromptEn: 'Create a 30-second cinematic vehicle tour: start with a crisp cold exhaust start sound, pan across leather seat stitching, and highlight the panoramic glass sunroof. Dynamic bass-heavy beat.',
  samplePromptVi: 'Tạo video ngắn 30s cận cảnh nội thất da cao cấp, khởi động máy với âm thanh uy lực và cửa sổ trời toàn cảnh. Nhạc nền dứt khoát, kết thúc bằng ưu đãi lãi suất vay 0%.',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 2800,
    traditionalTurnaroundDays: 7,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 45,
    estimatedMonthlySavingsUsd: 2601,
    estimatedVideoOutputPerMonth: 60,
  },
  testimonial: {
    quoteEn: 'Our test drive appointment requests tripled within 30 days of launching automated inventory shorts.',
    quoteVi: 'Lượng khách đăng ký lái thử tại showroom tăng gấp 3 lần chỉ sau 1 tháng đăng đều đặn các video ngắn giới thiệu xe.',
    author: 'Quang Huy',
    roleEn: 'General Sales Manager',
    roleVi: 'Giám Đốc Kinh Doanh',
    company: 'Apex Auto Gallery',
    metrics: '+180% test drive booking inquiries',
  },
  faqs: [
    {
      questionEn: 'Can we customize dealership branding and location watermark?',
      questionVi: 'Có thể chèn logo showroom và địa chỉ vào góc video không?',
      answerEn: 'Yes, upload your dealership logo and address once, and Sophia will overlay it seamlessly on every vehicle showcase.',
      answerVi: 'Có, bạn chỉ cần tải logo và địa chỉ showroom lên một lần, Sophia sẽ tự động gắn vào góc video một cách tinh tế.',
    },
  ],
  keywordsEn: ['car dealership video marketing', 'auto walkthrough reels', 'car sales tiktok', 'automotive video creator'],
  keywordsVi: ['marketing showroom ô tô', 'video trải nghiệm xe hơi', 'làm video bán xe cũ', 'quảng cáo lái thử xe'],
};
