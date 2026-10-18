/**
 * Solutions Catalog Data Partition — E-commerce & Marketing Automation
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/ecommerce-automation-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const ECOMMERCE_AUTOMATION_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'ecommerce',
    nameEn: 'E-Commerce Brands & Dropshipping',
    nameVi: 'Thương Mại Điện Tử & Bán Hàng Online',
    category: 'Technology',
    iconName: 'ShoppingBag',
    heroHeadlineEn: 'Rapid-Fire Viral Product Hooks That Scale TikTok Shop & Meta Ad ROAS Beyond 4.5X',
    heroHeadlineVi: 'Tạo Hàng Trăm Video Hook Bắt Trend Giúp Nhân Bản Doanh Số TikTok Shop',
    heroSubheadlineEn: 'Produce dozens of high-energy UGC-style product breakdowns, unboxings, and viral problem-solving hooks every day without paying creators $500 per clip.',
    heroSubheadlineVi: 'Tự động sản xuất hàng loạt video trải nghiệm sản phẩm, mở hộp và giải quyết vấn đề thực tế mà không cần tốn tiền triệu thuê KOLs/KOCs.',
    painPoints: [
      {
        titleEn: 'Exorbitant Influencer & UGC Fees',
        titleVi: 'Chi Phí Thuê KOC/KOL Quá Đắt Đỏ',
        descEn: 'Creators demand $300-$800 per video with zero guarantee of viral views or sales conversions.',
        descVi: 'Mỗi video thuê KOC tốn từ vài triệu đến cả chục triệu nhưng không đảm bảo ra được đơn hàng.',
      },
      {
        titleEn: 'Rapid Creative Fatigue in 72 Hours',
        titleVi: 'Quảng Cáo Nhanh Chóng Bị Chai Sau 3 Ngày',
        descEn: 'Winning ad creatives on TikTok exhaust their audience in 72 hours, forcing non-stop manual video production.',
        descVi: 'Một mẫu video win trên TikTok chỉ chạy tốt 3 ngày là bão hòa, bắt buộc phải liên tục có nội dung mới.',
      },
      {
        titleEn: 'Supplier Videos Lack Localization',
        titleVi: 'Video Của Xưởng Trung Quốc Không Phù Hợp Thị Trường',
        descEn: 'Repurposing factory videos with watermarks and foreign subtitles destroys buyer trust and gets flagged.',
        descVi: 'Lấy video của nhà cung cấp có logo lạ và chữ nước ngoài làm mất niềm tin của người mua và dễ bị đánh bản quyền.',
      },
    ],
    samplePromptTitleEn: 'Viral Gadget Problem-Solution TikTok Ad',
    samplePromptTitleVi: 'Kịch Bản Quảng Cáo Đồ Gia Dụng Thông Minh',
    samplePromptEn: 'Create a 15-second punchy product demo for an automatic mini vacuum cleaner. Hook: "Tell me your car seats look like this without telling me your car seats look like this." Fast cuts showing crumbs vanishing instantly.',
    samplePromptVi: 'Tạo video quảng cáo 15s cho máy hút bụi mini cầm tay trên ô tô. Hook: "Nhìn ghế xe thế này là biết chưa có máy này rồi!" Chuyển cảnh nhanh cảnh hút sạch vụn bánh trong 2 giây.',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 2400, traditionalTurnaroundDays: 5, sophiaMonthlyUsd: 199, sophiaTurnaroundSeconds: 30, estimatedMonthlySavingsUsd: 2201, estimatedVideoOutputPerMonth: 120 },
    testimonial: {
      quoteEn: 'We generated $84,000 in revenue last month by testing 10 new Sophia video hooks every single morning.',
      quoteVi: 'Tháng vừa rồi shop chúng tôi đạt hơn 2 tỷ doanh thu nhờ thói quen test 10 mẫu hook video mới của Sophia mỗi buổi sáng.',
      author: 'Ryan Miller', roleEn: 'E-Commerce Founder', roleVi: 'Chủ Thương Hiệu Thời Trang', company: 'AuraTrend Goods', metrics: '$84,000 monthly GMV at 4.2x ROAS',
    },
    faqs: [{
      questionEn: 'Can Sophia integrate directly with our Shopify product catalog?',
      questionVi: 'Sophia có tự lấy hình ảnh và mô tả từ cửa hàng trực tuyến của tôi không?',
      answerEn: 'Yes! Simply paste a product URL or image link, and Sophia pulls product features and writes high-converting video scripts automatically.',
      answerVi: 'Chỉ cần dán link sản phẩm hoặc ảnh mẫu, Sophia sẽ tự động phân tích tính năng nổi bật để viết kịch bản và tạo video hoàn chỉnh.',
    }],
    keywordsEn: ['ecommerce video ads', 'tiktok shop ugc', 'dropshipping creative automation', 'product hook reels'],
    keywordsVi: ['quảng cáo tiktok shop', 'video bán hàng online', 'tự động tạo video sản phẩm', 'kịch bản bán hàng triệu view'],
  },
  {
    slug: 'automation',
    nameEn: 'Marketing Agencies & Automation Ops',
    nameVi: 'Agency Marketing & Tự Động Hóa',
    category: 'Technology',
    iconName: 'Cpu',
    heroHeadlineEn: 'Deliver 10X Video Output For 50+ Clients Without Expanding Your Internal Headcount',
    heroHeadlineVi: 'Cung Cấp Hàng Ngàn Video Cho Khách Hàng Mà Không Cần Mở Rộng Đội Ngũ Nhân Sự',
    heroSubheadlineEn: 'White-label autonomous AI video factories for your agency clients, scaling retainers and margins into 80%+ profitability.',
    heroSubheadlineVi: 'Triển khai xưởng sản xuất video AI mang thương hiệu riêng của bạn cho các khách hàng doanh nghiệp, tối ưu hóa lợi nhuận lên đến hơn 80%.',
    painPoints: [
      {
        titleEn: 'Crushing Video Editing Labor Costs',
        titleVi: 'Chi Phí Thuê Nhân Sự Dựng Video Quá Tốn Kém',
        descEn: 'Hiring full-time video editors caps agency margins at 20-30% and leads to constant turnover headaches.',
        descVi: 'Đội ngũ dựng phim cồng kềnh ăn mòn lợi nhuận của agency và tốn nhiều thời gian quản lý tiến độ.',
      },
      {
        titleEn: 'Bottlenecks During Client Revisions',
        titleVi: 'Mắc Kẹt Trong Vòng Lặp Sửa Video Không Hồi Kết',
        descEn: 'One demanding client demanding 5 rounds of font and pacing revisions paralyzes your creative department.',
        descVi: 'Khách hàng liên tục đòi sửa đổi các chi tiết nhỏ khiến tiến độ cả dự án bị chậm trễ.',
      },
      {
        titleEn: 'Inability to Scale Client Retainers',
        titleVi: 'Không Thể Nhận Thêm Khách Hàng Vì Quá Tải',
        descEn: 'Agency founders turn away lucrative new accounts because video production capacity is maxed out.',
        descVi: 'Người sáng lập agency phải từ chối các hợp đồng béo bở vì công suất của nhân viên dựng phim đã đạt giới hạn.',
      },
    ],
    samplePromptTitleEn: 'Multi-Client Retainer Onboarding Video',
    samplePromptTitleVi: 'Kịch Bản Video Định Kỳ Hàng Tháng Cho Khách Hàng',
    samplePromptEn: 'Generate a 30-second localized monthly promo for a regional fitness chain. Dynamic typography with high-energy EDM beat and brand color styling.',
    samplePromptVi: 'Tạo video 30s quảng cáo chương trình ưu đãi đầu năm cho chuỗi phòng tập gym. Chữ xuất hiện theo nhịp nhạc EDM sôi động, nhận diện thương hiệu chuẩn xác.',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 5000, traditionalTurnaroundDays: 14, sophiaMonthlyUsd: 499, sophiaTurnaroundSeconds: 60, estimatedMonthlySavingsUsd: 4501, estimatedVideoOutputPerMonth: 250 },
    testimonial: {
      quoteEn: 'We onboarded 14 new corporate clients in 60 days using Sophia as our backend production engine.',
      quoteVi: 'Chúng tôi nhận thêm 14 khách hàng doanh nghiệp mới chỉ trong 2 tháng nhờ sử dụng Sophia làm xưởng sản xuất video cốt lõi.',
      author: 'David Chen', roleEn: 'Managing Director', roleVi: 'Tổng Giám Đốc Điều Hành', company: 'Apex Media Growth', metrics: '14 new client retainers managed with 0 new hires',
    },
    faqs: [{
      questionEn: 'Can we white-label Sophia for our agency brand?',
      questionVi: 'Agency của tôi có thể gắn logo và tên miền riêng để gửi cho khách không?',
      answerEn: 'Yes! Enterprise plans include full white-label capabilities with custom domains, agency logos, and client subaccounts.',
      answerVi: 'Hoàn toàn được! Gói Enterprise cho phép bạn sử dụng tên miền riêng, gắn thương hiệu agency và cấp tài khoản con cho từng khách hàng.',
    }],
    keywordsEn: ['agency video automation', 'white label ai video platform', 'b2b content engine', 'video production scaling'],
    keywordsVi: ['tự động hóa video cho agency', 'phần mềm làm video hàng loạt', 'nền tảng video nhãn trắng', 'tối ưu chi phí media'],
  },
];
