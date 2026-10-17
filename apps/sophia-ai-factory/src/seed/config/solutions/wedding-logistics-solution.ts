/**
 * Solutions Catalog Data Partition — Wedding Planner & Logistics Solutions
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/wedding-logistics-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const WEDDING_LOGISTICS_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'wedding-events',
    nameEn: 'Wedding Planners & Studios',
    nameVi: 'Studio & Tổ Chức Tiệc Cưới',
    category: 'Local Hospitality',
    iconName: 'Heart',
    heroHeadlineEn: 'Cinematic Dream Wedding Reels That Book High-Budget Brides A Full Year In Advance',
    heroHeadlineVi: 'Thước Phim Cưới Lãng Mạn Thu Hút Các Cặp Đôi Đặt Lịch Trước Cả Năm',
    heroSubheadlineEn: 'Turn wedding day highlights into breathless social teasers, luxury venue walkthroughs, and bridal trend guides that make your studio the must-hire choice.',
    heroSubheadlineVi: 'Biến những khoảnh khắc hạnh phúc nhất thành các video ngắn lãng mạn, sang trọng trên TikTok, giúp studio của bạn luôn kín lịch chụp.',
    painPoints: [
      {
        titleEn: 'Competing with Low-Cost Freelance Photographers',
        titleVi: 'Cạnh Tranh Với Các Nhiếp Ảnh Gia Tự Do Giá Rẻ',
        descEn: 'Couples fail to perceive premium artistry and venue coordination value from static gallery snapshots.',
        descVi: 'Khách hàng khó nhận ra sự khác biệt về đẳng cấp nếu chỉ xem những bức ảnh chụp tĩnh trên fanpage.',
      },
      {
        titleEn: 'High Production Effort for Teaser Clips',
        titleVi: 'Mất Quá Nhiều Công Sức Làm Clip Teaser Mẫu',
        descEn: 'Video editors spend days cutting wedding trailers when couples demand immediate social previews.',
        descVi: 'Thợ dựng mất cả tuần cắt ghép trong khi cô dâu chú rể muốn có clip ngắn đăng TikTok ngay hôm sau.',
      },
      {
        titleEn: 'Seasonality Feast or Famine',
        titleVi: 'Doanh Thu Phụ Thuộc Vào Mùa Cưới',
        descEn: 'Planners experience quiet spring months unless they keep a steady flow of bridal inspiration reels circulating.',
        descVi: 'Mùa vắng đám cưới dễ hụt dòng tiền nếu không liên tục duy trì hình ảnh thương hiệu để nhận đặt cọc trước.',
      },
    ],
    samplePromptTitleEn: 'Emotional First Look & Outdoor Vow Teaser',
    samplePromptTitleVi: 'Khoảnh Khắc First Look & Trao Lời Thề Nguyện Xúc Động',
    samplePromptEn: 'Create a 30-second romantic wedding trailer focusing on the groom seeing his bride in her gown for the first time, tearful vows under fairy lights, and an enthusiastic confetti exit. Hook: "Warning: Have tissues ready before watching this entrance."',
    samplePromptVi: 'Tạo video ngắn 30s ngọt ngào: Ánh mắt chú rể lần đầu ngắm cô dâu trong váy cưới lộng lẫy, giọt nước mắt hạnh phúc và pháo hoa rực rỡ. Hook: "Hãy chuẩn bị khăn giấy trước khi xem khoảnh khắc thiêng liêng này."',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2800,
      traditionalTurnaroundDays: 14,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 60,
      estimatedMonthlySavingsUsd: 2601,
      estimatedVideoOutputPerMonth: 50,
    },
    testimonial: {
      quoteEn: 'Brides mention our emotional Sophia-edited TikTok trailers in almost every initial inquiry message.',
      quoteVi: 'Hầu như cô dâu nào nhắn tin cho studio cũng nhắc đến những đoạn video ngắn xúc động mà chúng tôi đăng trên kênh TikTok.',
      author: 'Mai Phuong',
      roleEn: 'Creative Director',
      roleVi: 'Giám Đốc Nghệ Thuật',
      company: 'Lumiere Bridal Studio',
      metrics: '38 full wedding packages booked 8 months ahead',
    },
    faqs: [
      {
        questionEn: 'Can Sophia match our custom color grading and romantic music moods?',
        questionVi: 'Sophia có chỉnh màu điện ảnh theo phong cách riêng của studio không?',
        answerEn: 'Yes! Select cinematic LUT presets, pastel bridal aesthetics, and licensed emotional royalty-free acoustic tracks.',
        answerVi: 'Được chứ! Bạn có thể chọn tone màu trong trẻo, màu phim cổ điển cùng kho nhạc acoustic lãng mạn có sẵn bản quyền.',
      },
    ],
    keywordsEn: ['wedding video marketing', 'bridal reels', 'wedding planner tiktok', 'destination wedding video'],
    keywordsVi: ['marketing studio ảnh cưới', 'video đám cưới tiktok', 'quảng cáo tiệc cưới trọn gói', 'thước phim phóng sự cưới'],
  },
  {
    slug: 'logistics-b2b',
    nameEn: 'Freight & Express Logistics',
    nameVi: 'Vận Tải Hàng Hóa & Logistics B2B',
    category: 'B2B & Enterprise',
    iconName: 'Truck',
    heroHeadlineEn: 'Showcase Fleet Reliability & Warehouse Efficiency That Wins Major Enterprise Supply Contracts',
    heroHeadlineVi: 'Khẳng Định Năng Lực Vận Tải & Kho Bãi Chuyên Nghiệp Để Ký Hợp Đồng Lớn',
    heroSubheadlineEn: 'Convert complex freight lane pricing, cross-border customs handling, and real-time cold-chain capabilities into authoritative B2B video proof.',
    heroSubheadlineVi: 'Giới thiệu năng lực xe container, kho bãi tự động và quy trình thông quan thông suốt bằng video ngắn chuyên nghiệp cho đối tác doanh nghiệp.',
    painPoints: [
      {
        titleEn: 'Invisible Fleet Scale in Email Pitch Decks',
        titleVi: 'Hồ Sơ Năng Lực Dạng PDF Không Thể Hiện Được Quy Mô',
        descEn: 'Procurement officers skim PDF brochures and fail to appreciate extensive regional warehouse hubs.',
        descVi: 'Khách hàng B2B thường không đọc hết tài liệu chào thầu hàng chục trang và đánh giá thấp năng lực đội xe.',
      },
      {
        titleEn: 'Perceived Commodity Price Wars',
        titleVi: 'Bị Ép Giá Cước Vận Chuyển Xuống Mức Tối Thiểu',
        descEn: 'Shippers treat freight as a race to the bottom unless zero-damage records and on-time tech are highlighted.',
        descVi: 'Khách hàng luôn so sánh từng đồng cước xe nếu bạn không chứng minh được tỷ lệ giao đúng hạn và an toàn hàng hóa.',
      },
      {
        titleEn: 'Long B2B Decision Cycles',
        titleVi: 'Chu Kỳ Đàm Phán Ký Kết Hợp Đồng Kéo Dài',
        descEn: 'Supply chain heads take months to switch logistics providers without compelling visual proof of operational superiority.',
        descVi: 'Trưởng phòng cung ứng các tập đoàn mất hàng tháng để cân nhắc đổi đối tác vận tải nếu thiếu bằng chứng trực quan.',
      },
    ],
    samplePromptTitleEn: 'Cold-Chain Pharma Dispatch Compliance Video',
    samplePromptTitleVi: 'Quy Trình Kiểm Soát Nhiệt Độ Vận Chuyển Hàng Dược Phẩm',
    samplePromptEn: 'Produce a 45-second B2B video showcasing active GPS thermal sensors inside refrigerated trailers delivering vaccines with 0.1°C variance tolerance. Hook: "When a single degree difference costs millions, here is how modern cold-chain runs."',
    samplePromptVi: 'Tạo video B2B 45s: Cảm biến IoT giám sát nhiệt độ thùng xe lạnh theo thời gian thực, đảm bảo chuẩn GDP y tế. Hook: "Chỉ lệch 1 độ C có thể làm hỏng lô hàng triệu đô — Đây là cách chúng tôi bảo vệ hàng hóa của bạn."',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 3500,
      traditionalTurnaroundDays: 20,
      sophiaMonthlyUsd: 299,
      sophiaTurnaroundSeconds: 60,
      estimatedMonthlySavingsUsd: 3201,
      estimatedVideoOutputPerMonth: 40,
    },
    testimonial: {
      quoteEn: 'Sending a tailored 30-second fleet capabilities video with our bid helped us secure a $240K annual distribution contract.',
      quoteVi: 'Gửi video 30 giây quay thực tế đội xe kèm báo giá đã giúp chúng tôi thuyết phục đối tác và ký hợp đồng vận tải 6 tỷ đồng/năm.',
      author: 'Tran Huu Tuan',
      roleEn: 'Commercial Director',
      roleVi: 'Giám Đốc Thương Mại',
      company: 'VinaTrans Express Logistics',
      metrics: 'Won $240K annual enterprise shipping tender',
    },
    faqs: [
      {
        questionEn: 'Can we generate English videos for international shipping clients?',
        questionVi: 'Công ty có thể xuất video tiếng Anh cho khách hàng xuất nhập khẩu quốc tế không?',
        answerEn: 'Yes! Full dual-language generation produces native American/British English voiceovers alongside Vietnamese editions in parallel.',
        answerVi: 'Chắc chắn rồi! Hệ thống hỗ trợ song ngữ hoàn hảo với giọng đọc tiếng Anh bản xứ chuẩn quốc tế chỉ sau một click.',
      },
    ],
    keywordsEn: ['b2b logistics video marketing', 'freight fleet showcase', 'warehouse automation reel', 'cold chain shipping promo'],
    keywordsVi: ['marketing công ty logistics', 'video giới thiệu đội xe vận tải', 'quảng cáo kho bãi thông minh', 'dịch vụ vận chuyển b2b'],
  },
];
