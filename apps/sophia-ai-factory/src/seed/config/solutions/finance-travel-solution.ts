/**
 * Solutions Catalog Data Partition — Finance Advisors & Travel Tourism
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/finance-travel-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const FINANCE_TRAVEL_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'finance-investing',
    nameEn: 'Wealth Advisors & Financial Planners',
    nameVi: 'Cố Vấn Tài Chính & Đầu Tư',
    category: 'Financial Services',
    iconName: 'TrendingUp',
    heroHeadlineEn: 'Sophisticated Macro Teardowns That Win High-Net-Worth Advisory Accounts',
    heroHeadlineVi: 'Phân Tích Kinh Tế Vĩ Mô Sắc Bén Thu Hút Khách Hàng Tài Sản Lớn',
    heroSubheadlineEn: 'Convert complex fiscal trends, inflation hedging, and wealth preservation frameworks into authoritative, trustworthy video counsel.',
    heroSubheadlineVi: 'Giải thích biến động thị trường, danh mục đầu tư bền vững và quản trị tài chính gia đình bằng video chuyên sâu, đẳng cấp.',
    painPoints: [
      {
        titleEn: 'High Client Acquisition Costs in Wealth Management',
        titleVi: 'Chi Phí Tiếp Cận Khách Hàng VIP Quá Cao',
        descEn: 'Traditional golf outings, dinner seminars, and private referrals are slow and expensive.',
        descVi: 'Tổ chức hội thảo hay nhờ giới thiệu truyền thống tốn nhiều chi phí mà số lượng khách mới không đều.',
      },
      {
        titleEn: 'Market Volatility Creates Client Panic',
        titleVi: 'Thị Trường Biến Động Khiến Nhà Đầu Tư Hoang Mang',
        descEn: 'Advisors lose clients to panic selling when they lack the speed to publish calm, rational market update videos.',
        descVi: 'Nhà đầu tư dễ bán tháo theo cảm xúc nếu chuyên gia không kịp thời có video phân tích bình ổn tâm lý.',
      },
      {
        titleEn: 'Strict Financial Compliance Rules',
        titleVi: 'Rào Cản Pháp Lý Trong Tư Vấn Đầu Tư',
        descEn: 'Advisors cannot make guaranteed return promises; educational storytelling is the only compliant growth channel.',
        descVi: 'Không được cam kết lợi nhuận; chia sẻ kiến thức quản trị rủi ro là con đường thu hút khách hợp pháp duy nhất.',
      },
    ],
    samplePromptTitleEn: 'Asset Allocation When Inflation Stays Stubborn',
    samplePromptTitleVi: 'Chiến Lược Phân Bổ Tài Sản Khi Lạm Phát Kéo Dài',
    samplePromptEn: 'Create a 45-second high-finance breakdown comparing cash drag vs diversified dividend portfolios during high-rate regimes. Hook: "Holding cash in 2026 feels safe, but here is how the silent tax of inflation is eroding your purchasing power."',
    samplePromptVi: 'Tạo video tài chính 45s phân tích thiệt hại khi để tiền mặt quá nhiều so với danh mục cổ tức và bất động sản dòng tiền. Hook: "Giữ tiền mặt tạo cảm giác an toàn, nhưng đây là cách lạm phát đang âm thầm bào mòn tài sản của bạn."',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 3200,
      traditionalTurnaroundDays: 14,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 60,
      estimatedMonthlySavingsUsd: 3001,
      estimatedVideoOutputPerMonth: 40,
    },
    testimonial: {
      quoteEn: 'I onboarded $4.2M in new advisory assets under management directly from viewers of my Sophia educational shorts.',
      quoteVi: 'Tôi đã tiếp nhận quản lý thêm hơn 100 tỷ đồng vốn ủy thác từ những thân chủ theo dõi chuỗi video tư vấn của tôi.',
      author: 'Jonathan Sterling',
      roleEn: 'Private Wealth Advisor',
      roleVi: 'Cố Vấn Tài Chính Cấp Cao',
      company: 'Sterling Capital Advisors',
      metrics: '$4.2M new AUM onboarded in 90 days',
    },
    faqs: [
      {
        questionEn: 'Do videos comply with strict financial advisory regulations?',
        questionVi: 'Video có tuân thủ quy định quản lý tài chính và chứng khoán không?',
        answerEn: 'Yes, scripts are engineered for wealth advisors with objective educational tones and automatic compliance disclaimers.',
        answerVi: 'Có, kịch bản được viết theo văn phong trung lập, mang tính giáo dục tài chính và tự động gắn miễn trừ trách nhiệm đầu tư.',
      },
    ],
    keywordsEn: ['wealth management video marketing', 'financial advisor reels', 'investment education shorts', 'private wealth leads'],
    keywordsVi: ['marketing cố vấn tài chính', 'video quản lý tài sản', 'chia sẻ kiến thức đầu tư', 'kênh tài chính cá nhân'],
  },
  {
    slug: 'travel-tourism',
    nameEn: 'Travel Agencies & Tourism',
    nameVi: 'Du Lịch & Tour Trải Nghiệm',
    category: 'Travel & Lifestyle',
    iconName: 'Compass',
    heroHeadlineEn: 'Dreamy Destination Teasers That Fill Tour Departures Months Ahead',
    heroHeadlineVi: 'Thước Phim Cảnh Đẹp Khiến Du Khách Muốn Xách Balo Lên Và Đi Ngay',
    heroSubheadlineEn: 'Produce breathless aerial landscapes, hidden culinary spots, and itinerary teasers that trigger irresistible travel desire.',
    heroSubheadlineVi: 'Tạo video phong cảnh flycam ngoạn mục, ẩm thực địa phương độc đáo và lịch trình tour hấp dẫn kích thích đặt tour sớm.',
    painPoints: [
      {
        titleEn: 'Text Itineraries Fail to Inspire',
        titleVi: 'Lịch Trình Dạng Văn Bản Không Chạm Đến Cảm Xúc',
        descEn: 'Travelers scroll past generic PDF day-by-day itineraries without feeling the emotional pull of the destination.',
        descVi: 'Khách hàng lướt qua các bài viết lịch trình tour dài dòng vì không hình dung được trải nghiệm thực tế.',
      },
      {
        titleEn: 'High Stock Footage Costs for Exotic Locations',
        titleVi: 'Chi Phí Mua Dữ Liệu Flycam Điểm Đến Đắt Đỏ',
        descEn: 'Licensing 4K drone footage of remote travel destinations costs hundreds of dollars per video clip.',
        descVi: 'Mua bản quyền video cảnh đẹp nước ngoài tốn kém nhiều triệu đồng cho mỗi điểm đến.',
      },
      {
        titleEn: 'Last-Minute Booking Slump',
        titleVi: 'Hụt Khách Giờ Chót Vào Mùa Thấp Điểm',
        descEn: 'Tour operators take losses on pre-booked flight seats when marketing campaigns fail to sell out group departures.',
        descVi: 'Đại lý ôm vé máy bay và phòng khách sạn dễ bị lỗ nếu không kịp đẩy mạnh quảng cáo cận ngày khởi hành.',
      },
    ],
    samplePromptTitleEn: '3 Hidden Wonders of Ha Long Bay Beyond the Crowds',
    samplePromptTitleVi: '3 Trải Nghiệm Bí Mật Tại Vịnh Hạ Long Ít Người Biết',
    samplePromptEn: 'Create a 30-second breathtaking travel teaser: emerald sea kayaking through secluded sea caves, luxury wooden junk boat sunset deck, and fresh grilled squid. Hook: "Skip the tourist traps. Here is the secret Hạ Long Bay."',
    samplePromptVi: 'Tạo video du lịch 30s: Chèo kayak qua hang biển xanh ngọc, ngắm hoàng hôn trên du thuyền gỗ cổ điển và thưởng thức hải sản tươi rói. Hook: "Đừng đi Hạ Long theo cách thông thường, hãy trải nghiệm điều này."',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2200,
      traditionalTurnaroundDays: 7,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 45,
      estimatedMonthlySavingsUsd: 2001,
      estimatedVideoOutputPerMonth: 60,
    },
    testimonial: {
      quoteEn: 'Our private island tour bookings sold out 4 months in advance thanks to Sophia-rendered aerial reels.',
      quoteVi: 'Tour khám phá đảo cao cấp của chúng tôi đã kín chỗ trước 4 tháng nhờ những video ngắn cảnh biển tuyệt đẹp do Sophia tạo ra.',
      author: 'Bao Tram',
      roleEn: 'Tour Operations Director',
      roleVi: 'Giám Đốc Điều Hành Tour',
      company: 'Indochina Nomad Travel',
      metrics: 'Sold out 12 tour departures 4 months in advance',
    },
    faqs: [
      {
        questionEn: 'Can Sophia generate videos for specific international destinations?',
        questionVi: 'Sophia có tạo được video cho các điểm đến quốc tế như Nhật Bản hay Châu Âu không?',
        answerEn: 'Yes! Sophia covers global travel hotspots with authentic regional landmarks, cultural aesthetics, and multi-language narrations.',
        answerVi: 'Được chứ! Sophia có dữ liệu điểm đến toàn cầu, tái hiện chân thực danh lam thắng cảnh và phong tục văn hóa từng quốc gia.',
      },
    ],
    keywordsEn: ['travel agency video marketing', 'tourism promo reels', 'destination guide tiktok', 'travel tour shorts'],
    keywordsVi: ['marketing công ty du lịch', 'video cảnh đẹp du lịch', 'quảng cáo tour du lịch', 'kênh tiktok du lịch trải nghiệm'],
  },
];
