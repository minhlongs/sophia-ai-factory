/**
 * Solutions Catalog Data Partition — Fitness Coaches & Legal Services
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/fitness-lawyer-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const FITNESS_LAWYER_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'fitness',
    nameEn: 'Fitness & Gyms',
    nameVi: 'Thể Hình & Phòng Gym',
    category: 'Health & Wellness',
    iconName: 'Dumbbell',
    heroHeadlineEn: 'Fill Gym Memberships & High-Ticket PT Rosters With Daily Form & Nutrition Hooks',
    heroHeadlineVi: 'Lấp Đầy Học Viên Kèm 1-1 & Thẻ Tập Gym Nhờ Video Chia Sẻ Động Lực Mỗi Ngày',
    heroSubheadlineEn: 'Produce motivational workout routines, common form mistake fixes, and rapid meal prep teardowns that attract dedicated health enthusiasts.',
    heroSubheadlineVi: 'Sản xuất video hướng dẫn bài tập, sửa lỗi kỹ thuật và thực đơn dinh dưỡng chuẩn khoa học giúp phòng tập luôn đông đúc.',
    painPoints: [
      {
        titleEn: 'High Member Churn After 60 Days',
        titleVi: 'Hội Viên Bỏ Tập Sau 1-2 Tháng Đầu',
        descEn: 'Beginners quit when they feel intimidated by complex gym machines and lack ongoing guidance.',
        descVi: 'Người mới tập dễ bỏ cuộc vì bỡ ngỡ với máy tập và không có động lực duy trì đều đặn.',
      },
      {
        titleEn: 'Trainers Spend Hours Recording Alone',
        titleVi: 'Huấn Luyện Viên Tốn Thời Gian Tự Quay Tự Sửa',
        descEn: 'PTs spend gym floor hours struggling with tripods and video editing instead of training paying clients.',
        descVi: 'PT mất hàng giờ loay hoay dựng chân máy quay clip thay vì tập trung huấn luyện học viên có phí.',
      },
      {
        titleEn: 'Price Wars With Cheap Commercial Gyms',
        titleVi: 'Bị Cạnh Tranh Gay Gắt Về Giá Vé Tập',
        descEn: 'Personal coaching is commoditized unless trainers clearly demonstrate personalized methodology through video.',
        descVi: 'Nếu không chứng minh được chuyên môn bằng video, bạn sẽ dễ bị ép giá với các phòng tập giá rẻ.',
      },
    ],
    samplePromptTitleEn: '3 Common Squat Form Mistakes Hurting Your Knees',
    samplePromptTitleVi: '3 Lỗi Sai Khi Squat Khiến Bạn Đau Khớp Gối',
    samplePromptEn: 'Create a 30-second form correction reel showing side-by-side: incorrect knee cave vs proper hip-hinge squat technique. Hook: "If your knees hurt after leg day, you are making this fatal mistake."',
    samplePromptVi: 'Tạo video ngắn 30s sửa tư thế: So sánh trực quan lỗi khép gối khi Squat và cách gồng core đúng. Hook: "Nếu tập chân xong mà đau đầu gối thay vì mỏi đùi, bạn đang mắc lỗi nghiêm trọng này."',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2000,
      traditionalTurnaroundDays: 7,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 45,
      estimatedMonthlySavingsUsd: 1801,
      estimatedVideoOutputPerMonth: 60,
    },
    testimonial: {
      quoteEn: 'I added 12 new 1-on-1 personal training clients in my first month using automated workout tip reels.',
      quoteVi: 'Tôi nhận thêm 12 học viên kèm 1-1 ngay trong tháng đầu nhờ chia sẻ mẹo tập luyện do Sophia tự động sản xuất.',
      author: 'Coach Alex Doan',
      roleEn: 'Head Strength Coach',
      roleVi: 'Huấn Luyện Viên Trưởng',
      company: 'IronPeak Performance',
      metrics: '12 new personal training retainers closed in 30 days',
    },
    faqs: [
      {
        questionEn: 'Can Sophia generate dynamic workout motion b-roll?',
        questionVi: 'Sophia có tạo được các cảnh chuyển động tập gym sinh động không?',
        answerEn: 'Yes! Sophia integrates specialized fitness b-roll libraries with energetic cinematic lighting and rhythm-matched sound effects.',
        answerVi: 'Được chứ! Sophia có sẵn kho dữ liệu động tác tập thể hình đẹp mắt, chuyển cảnh khớp từng nhịp bass sôi động.',
      },
    ],
    keywordsEn: ['gym video marketing', 'fitness trainer reels', 'workout motivation tiktok', 'pt client acquisition'],
    keywordsVi: ['marketing phòng tập gym', 'video hướng dẫn tập thể hình', 'kênh tiktok fitness', 'tìm học viên pt gym'],
  },
  {
    slug: 'lawyer',
    nameEn: 'Lawyers & Legal Services',
    nameVi: 'Luật Sư & Tư Vấn Pháp Lý',
    category: 'Professional Services',
    iconName: 'Scale',
    heroHeadlineEn: 'Establish Authoritative Legal Credibility & Attract High-Retainer Clients',
    heroHeadlineVi: 'Khẳng Định Uy Tín Luật Sư Chuyên Nghiệp & Thu Hút Thân Chủ Lớn',
    heroSubheadlineEn: 'Break down legal precedents, business compliance risks, and rights protection into clear, trustworthy video breakdowns.',
    heroSubheadlineVi: 'Giải thích luật đất đai, tranh chấp kinh doanh và bảo vệ quyền lợi hợp pháp một cách sắc bén, nâng tầm thương hiệu văn phòng luật.',
    painPoints: [
      {
        titleEn: 'Strict Bar Association Advertising Rules',
        titleVi: 'Quy Định Quảng Cáo Ngành Luật Khắt Khe',
        descEn: 'Attorneys cannot use hype-filled advertising and need dignified, educational legal thought leadership.',
        descVi: 'Luật sư không được quảng cáo phô trương, cần xuất hiện đĩnh đạc và chia sẻ giá trị thực tế.',
      },
      {
        titleEn: 'Clients Delay Seeking Advice Until Crisis Strikes',
        titleVi: 'Thân Chủ Chỉ Tìm Luật Sư Khi Đã Xảy Ra Hậu Quả Nặng',
        descEn: 'Businesses sign ambiguous contracts without legal review because they dread expensive hourly consultation fees.',
        descVi: 'Nhiều doanh nghiệp ký hợp đồng sơ sài vì ngại chi phí luật sư ban đầu, dẫn đến tranh chấp phức tạp.',
      },
      {
        titleEn: 'Expensive Legal Retainer Sales Cycles',
        titleVi: 'Khó Thuyết Phục Khách Ký Hợp Đồng Cố Vấn Dài Hạn',
        descEn: 'Firms struggle to demonstrate ongoing retainer value before an actual courtroom dispute occurs.',
        descVi: 'Khách hàng khó thấy hết giá trị của gói tư vấn thường xuyên nếu chưa từng trải nghiệm năng lực giải quyết vấn đề của bạn.',
      },
    ],
    samplePromptTitleEn: '3 Red Flags in Commercial Leases Every Founder Must Spot',
    samplePromptTitleVi: '3 Cái Bẫy Trong Hợp Đồng Thuê Mặt Bằng Kinh Doanh',
    samplePromptEn: 'Create a 45-second professional legal advisory reel breaking down hidden rent escalation clauses in commercial property leases. Serious, authoritative courtroom tone with polished typography.',
    samplePromptVi: 'Tạo video tư vấn pháp lý 45s: 3 điều khoản bất lợi về tăng giá thuê mặt bằng và tiền đặt cọc mà chủ shop thường bỏ qua. Tông giọng sắc bén, chuẩn mực, tạo dựng niềm tin tuyệt đối.',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 3500,
      traditionalTurnaroundDays: 14,
      sophiaMonthlyUsd: 299,
      sophiaTurnaroundSeconds: 60,
      estimatedMonthlySavingsUsd: 3201,
      estimatedVideoOutputPerMonth: 40,
    },
    testimonial: {
      quoteEn: 'Our commercial contract review retainers grew by $45,000 within two months of launching our short legal breakdown series.',
      quoteVi: 'Doanh thu dịch vụ rà soát hợp đồng kinh tế của văn phòng chúng tôi tăng hơn 1 tỷ đồng chỉ sau 2 tháng làm video chia sẻ pháp lý trên mạng xã hội.',
      author: 'Atty. Vu Hoang Long',
      roleEn: 'Managing Partner',
      roleVi: 'Luật Sư Điều Hành',
      company: 'Long & Associates Law Firm',
      metrics: '$45,000 new commercial retainer volume added',
    },
    faqs: [
      {
        questionEn: 'Do videos maintain formal legal decorum and ethical standards?',
        questionVi: 'Video có giữ được sự trang trọng và chuẩn mực đạo đức nghề luật không?',
        answerEn: 'Yes! Scripts are structured specifically for licensed attorneys with formal phrasing, objective legal logic, and standard informational disclaimers.',
        answerVi: 'Chắc chắn! Văn phong được thiết kế riêng cho giới luật sư, ngôn từ chỉn chu, viện dẫn điều luật rõ ràng và tự động chèn miễn trừ trách nhiệm tư vấn cá nhân.',
      },
    ],
    keywordsEn: ['law firm video marketing', 'attorney reels', 'legal advice tiktok', 'commercial lawyer clients'],
    keywordsVi: ['marketing văn phòng luật', 'video tư vấn pháp luật', 'luật sư tiktok', 'quảng cáo dịch vụ luật'],
  },
];
