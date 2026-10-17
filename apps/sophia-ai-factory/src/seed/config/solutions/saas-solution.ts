/**
 * Solutions Catalog Data Partition — SaaS & B2B Software Solution
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/saas-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const SAAS_SOLUTION: SolutionIndustry = {
  slug: 'saas',
  nameEn: 'SaaS & B2B Software',
  nameVi: 'Phần Mềm SaaS & B2B',
  category: 'Technology',
  iconName: 'Laptop',
  heroHeadlineEn: 'Convert Cold Product Demos Into Product-Led Growth ARR Explosions',
  heroHeadlineVi: 'Biến Video Demo Tính Năng Thành Cỗ Máy Tăng Trưởng ARR Tự Động',
  heroSubheadlineEn: 'Produce snappy feature walkthroughs, UI micro-interactions, and problem-solution teardowns that get developer and enterprise trials instantly.',
  heroSubheadlineVi: 'Tạo video giới thiệu tính năng, tương tác giao diện và giải pháp công nghệ trực quan giúp tăng tỉ lệ đăng ký dùng thử ngay lập tức.',
  painPoints: [
    {
      titleEn: 'Low Demo-to-Trial Conversion',
      titleVi: 'Khách Đọc Landing Page Nhưng Không Dùng Thử',
      descEn: 'Visitors bounce off walls of text and static feature screenshots without understanding the core workflow.',
      descVi: 'Khách rời trang web vì các đoạn mô tả tính năng quá dài dòng, không hình dung được sản phẩm giải quyết việc gì.',
    },
    {
      titleEn: 'Long Sales Cycles for B2B Buyers',
      titleVi: 'Chu Kỳ Bán Hàng B2B Kéo Dài',
      descEn: 'Convincing decision-makers takes dozens of meetings when asynchronous video teardowns could close the gap.',
      descVi: 'Chốt hợp đồng doanh nghiệp mất nhiều tuần nếu không có video demo ngắn gọn gửi cho các cấp phê duyệt.',
    },
    {
      titleEn: 'High Customer Success Onboarding Load',
      titleVi: 'Nhóm Hỗ Trợ Quá Tải Hướng Dẫn Sử Dụng',
      descEn: 'Users churn early when initial product setup lacks step-by-step video guidance.',
      descVi: 'Người dùng bỏ cuộc sớm vì các tài liệu hướng dẫn bắt đầu quá phức tạp và thiếu video thị phạm.',
    },
  ],
  samplePromptTitleEn: '30-Second API Integration Teardown',
  samplePromptTitleVi: 'Video Trực Quan Tích Hợp API Trong 3 Bước',
  samplePromptEn: 'Create a 30-second developer demo showing how simple it is to authenticate and query our GraphQL API with 3 lines of TypeScript. Dynamic code highlights with aesthetic dark-mode IDE b-roll.',
  samplePromptVi: 'Tạo video demo 30s cho lập trình viên: Cách kết nối API GraphQL chỉ với 3 dòng code TypeScript. Giao diện IDE tối màu cực đẹp, chữ chạy mượt mà.',
  roiComparison: {
    traditionalAgencyCostMonthlyUsd: 3200,
    traditionalTurnaroundDays: 10,
    sophiaMonthlyUsd: 199,
    sophiaTurnaroundSeconds: 45,
    estimatedMonthlySavingsUsd: 3001,
    estimatedVideoOutputPerMonth: 60,
  },
  testimonial: {
    quoteEn: 'Adding Sophia-generated feature teasers to our product changelog doubled our monthly active trial starts.',
    quoteVi: 'Gắn video ngắn của Sophia vào trang cập nhật tính năng mới đã giúp lượng tài khoản dùng thử tăng gấp đôi.',
    author: 'Alexandre Roy',
    roleEn: 'Head of Growth',
    roleVi: 'Trưởng Phòng Tăng Trưởng',
    company: 'CloudFlow DB',
    metrics: '+114% trial signups from video changelogs',
  },
  faqs: [
    {
      questionEn: 'Can Sophia capture our real web app UI or do we upload screen recordings?',
      questionVi: 'Sophia có tự dựng giao diện ứng dụng không hay tôi cần tải video quay màn hình lên?',
      answerEn: 'You can input simple prompts and Sophia renders hyper-realistic simulated UI animations, or upload your own 5-second screen snippets.',
      answerVi: 'Bạn chỉ cần nhập mô tả tính năng là Sophia tự dựng hoạt ảnh giao diện đẹp mắt, hoặc tải video quay màn hình lên để ghép nhạc và hiệu ứng.',
    },
  ],
  keywordsEn: ['saas product video marketing', 'b2b software demo reel', 'plg video strategy', 'api explainer shorts'],
  keywordsVi: ['marketing sản phẩm phần mềm', 'video demo tính năng b2b', 'tăng tỷ lệ dùng thử phần mềm', 'video giải pháp công nghệ'],
};
