/**
 * Solutions Catalog Data Partition
 * Layer: Seed (Configuration and static data, imports only seed)
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const REAL_ESTATE_COSMETICS_SOLUTIONS: SolutionIndustry[] = [
  {
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
  },

  {
    slug: 'cosmetics',
    nameEn: 'Cosmetics & Beauty',
    nameVi: 'Mỹ Phẩm & Thẩm Mỹ',
    category: 'E-Commerce & Retail',
    iconName: 'Sparkles',
    heroHeadlineEn: 'Viral Beauty Demos & Skincare Transformations That Sell Out Inventory',
    heroHeadlineVi: 'Video Biến Hình Mỹ Phẩm & Skincare Viral Cháy Hàng Trong Tích Tắc',
    heroSubheadlineEn: 'Produce hundreds of thumb-stopping before/after reels, ingredient breakdowns, and UGC-style reviews tailored for TikTok Shop and Shopee.',
    heroSubheadlineVi: 'Tự động xuất hàng trăm video biến hình trước/sau, giải mã thành phần và review chân thực chuẩn UGC cho TikTok Shop và Shopee.',
    painPoints: [
      {
        titleEn: 'High KOC / Influencer Booking Fees',
        titleVi: 'Phí Thuê KOC & Beauty Blogger Đắt Đỏ',
        descEn: 'Beauty influencers charge $500 - $2,000 per video with zero guarantee of viral views or sales conversion.',
        descVi: 'Thuê một KOC review tốn từ 10 - 50 triệu/clip nhưng không cam kết ra đơn hay view.',
      },
      {
        titleEn: 'Strict Advertising Compliance Bans',
        titleVi: 'Tài Khoản Dễ Bị Khóa Do Vi Phạm Quảng Cáo',
        descEn: 'Ad accounts get banned for non-compliant claim wording without automated compliance scanning.',
        descVi: 'Nhiều video bị TikTok bóp tương tác do vi phạm chính sách cam kết hiệu quả quá đà.',
      },
      {
        titleEn: 'High Creative Fatigue',
        titleVi: 'Mẫu Video Nhanh Chóng Bị Bão Hòa',
        descEn: 'Beauty ad creatives fatigue within 7 days, demanding a relentless stream of fresh hooks and visual variations.',
        descVi: 'Mỗi mẫu video chỉ chạy hiệu quả 5-7 ngày là cạn tương tác, đòi hỏi liên tục sản xuất góc quay mới.',
      },
    ],
    samplePromptTitleEn: 'Retinol Serum Before & After UGC Script',
    samplePromptTitleVi: 'Kịch Bản UGC Serum Niacinamide Giảm Thâm',
    samplePromptEn: 'Generate a 30-second TikTok UGC-style testimonial addressing stubborn acne marks. Hook: "If you are still scrubbing your skin with physical exfoliants in 2026, stop right now!" Emphasize visible glow in 14 days with clinical ingredient proof.',
    samplePromptVi: 'Tạo video ngắn 30s phong cách KOC chia sẻ kinh nghiệm xử lý thâm mụn. Hook: "Nếu 2026 bạn vẫn còn dùng tẩy tế bào chết hạt to, dừng ngay lại trước khi rách da!" Trình bày thành phần 10% Niacinamide và kết quả sau 14 ngày.',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2800,
      traditionalTurnaroundDays: 10,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 45,
      estimatedMonthlySavingsUsd: 2601,
      estimatedVideoOutputPerMonth: 80,
    },
    testimonial: {
      quoteEn: 'Our TikTok Shop GMV tripled in two weeks after launching 5 daily Sophia-generated skincare hooks.',
      quoteVi: 'Doanh số TikTok Shop của thương hiệu mỹ phẩm chúng tôi tăng gấp 3 sau khi đăng đều đặn 5 video mỗi ngày từ Sophia.',
      author: 'Chloe Nguyen',
      roleEn: 'Head of Growth',
      roleVi: 'Trưởng Phòng Tăng Trưởng',
      company: 'Aura Derma Lab',
      metrics: '3.2x GMV growth on TikTok Shop',
    },
    faqs: [
      {
        questionEn: 'Can I insert my actual product packaging into generated videos?',
        questionVi: 'Tôi có thể đưa bao bì sản phẩm thật vào video không?',
        answerEn: 'Yes, simply upload your transparent product PNG and Sophia will seamlessly composite it into realistic lifestyle scenes.',
        answerVi: 'Được chứ, chỉ cần tải lên ảnh sản phẩm tách nền, Sophia sẽ ghép tự nhiên vào bối cảnh đời thực và bàn trang điểm.',
      },
      {
        questionEn: 'How does Sophia ensure video claims comply with advertising policies?',
        questionVi: 'Sophia có kiểm duyệt từ ngữ tránh bị bóp tương tác không?',
        answerEn: 'Sophia built-in content filters automatically detect and suggest safe phrasing to protect your TikTok ad accounts from policy bans.',
        answerVi: 'Bộ lọc nội dung của Sophia tự động gợi ý cách dùng từ chuẩn chính sách để video không bị quét từ cấm trên TikTok/Facebook.',
      },
    ],
    keywordsEn: ['beauty ai video generator', 'skincare tiktok ads', 'cosmetics ugc video maker', 'tiktok shop beauty marketing'],
    keywordsVi: ['làm video mỹ phẩm ai', 'quảng cáo skincare tiktok', 'ugc review mỹ phẩm', 'tăng doanh số tiktok shop'],
  },
];
