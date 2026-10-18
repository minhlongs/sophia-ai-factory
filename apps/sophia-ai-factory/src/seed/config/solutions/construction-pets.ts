/**
 * Solutions Catalog Data Partition
 * Layer: Seed (Configuration and static data, imports only seed)
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const CONSTRUCTION_PETS_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'construction',
    nameEn: 'Construction & Architecture',
    nameVi: 'Xây Dựng & Kiến Trúc',
    category: 'High-Ticket Sales',
    iconName: 'Hammer',
    heroHeadlineEn: 'Stunning Blueprint-To-Reality Time-Lapses That Land High-Ticket Building Contracts',
    heroHeadlineVi: 'Video Quá Trình Thi Công Từ Bản Vẽ Đến Thực Tế Giúp Ký Hợp Đồng Tiền Tỷ',
    heroSubheadlineEn: 'Turn structural blueprints, 3D renderings, and site progress photos into breathtaking building transformation videos that prove craftsmanship.',
    heroSubheadlineVi: 'Biến bản vẽ thiết kế 3D và hình ảnh công trường thành những video lột xác công trình ấn tượng, khẳng định uy tín và chất lượng thi công.',
    painPoints: [
      {
        titleEn: 'Homeowners Fear Subcontractor Delays & Budget Overruns',
        titleVi: 'Chủ Nhà Sợ Bị Đội Vốn & Chậm Tiến Độ',
        descEn: 'Clients hesitate to sign large building contracts without seeing transparent proof of on-time project execution.',
        descVi: 'Khách xây nhà rất lo lắng nhà thầu làm ẩu, kéo dài thời gian và phát sinh chi phí.',
      },
      {
        titleEn: 'Hard to Show Value in Unfinished Concrete',
        titleVi: 'Khó Cho Khách Thấy Nét Đẹp Khi Công Trình Chưa Xong',
        descEn: 'Showing raw rebar and concrete confuses clients unless bridged with 3D architectural vision overlays.',
        descVi: 'Hình ảnh công trường thô ráp không gây ấn tượng nếu không được lồng ghép với bản vẽ phối cảnh hoàn thiện.',
      },
      {
        titleEn: 'Long Sales Cycles for Multi-Billion VND Contracts',
        titleVi: 'Thời Gian Thương Thảo Hợp Đồng Kéo Dài Hàng Tháng',
        descEn: 'High-ticket residential and commercial projects require continuous brand authority to beat rival contractors.',
        descVi: 'Những hợp đồng xây dựng tiền tỷ đòi hỏi nhà thầu phải liên tục thể hiện năng lực để vượt qua đối thủ.',
      },
    ],
    samplePromptTitleEn: 'Modern Villa Foundation-to-Finish Time-Lapse',
    samplePromptTitleVi: 'Hành Trình Thi Công Biệt Thự Hiện Đại Từ Móng Đến Hoàn Thiện',
    samplePromptEn: 'Create a 40-second dynamic progress reel of a 3-story modern villa: foundation pouring, steel framing, interior joinery, and the final night-lit reveal. Hook: "Building your dream home should not be a nightmare. Here is how we delivered 350m2 in 120 days."',
    samplePromptVi: 'Tạo video 40s hành trình xây dựng biệt thự vườn 3 tầng: Đổ móng vững chắc, cất nóc, hoàn thiện nội thất và bàn giao chìa khóa trao tay. Hook: "Xây nhà không hề là cơn ác mộng nếu bạn chọn đúng nhà thầu tận tâm. Xem cách chúng tôi hoàn thiện 350m2 trong 120 ngày."',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 3400, traditionalTurnaroundDays: 14, sophiaMonthlyUsd: 199, sophiaTurnaroundSeconds: 60, estimatedMonthlySavingsUsd: 3201, estimatedVideoOutputPerMonth: 40 },
    testimonial: {
      quoteEn: 'A homeowner saw our villa progress reel on Facebook and signed an 8.5 billion VND design & build turnkey contract.',
      quoteVi: 'Một gia chủ tình cờ xem được video thi công biệt thự của chúng tôi trên Facebook và đã tin tưởng ký hợp đồng trọn gói 8,5 tỷ đồng.',
      author: 'Kts. Duc Thang', roleEn: 'Principal Architect & Contractor', roleVi: 'Kiến Trúc Sư Trưởng', company: 'Thang Long Design Build', metrics: '8.5B VND residential build contract signed',
    },
    faqs: [{
      questionEn: 'Can we create videos using our architectural 3D Sketchup/Lumion renders?',
      questionVi: 'Tôi có thể tải ảnh phối cảnh 3D từ Lumion hoặc SketchUp lên không?',
      answerEn: 'Yes! Sophia adds camera sweeps, animated lighting, and background ambiance to breathe life into still 3D renders.',
      answerVi: 'Rất tuyệt vời! Sophia tự động tạo góc quay lướt điện ảnh, hiệu ứng ánh sáng ngày/đêm sống động cho các ảnh phối cảnh 3D tĩnh.',
    }],
    keywordsEn: ['construction marketing video', 'architecture reels generator', 'home builder tiktok', 'construction lead gen'],
    keywordsVi: ['marketing công ty xây dựng', 'video thiết kế kiến trúc', 'clip thi công nhà trọn gói', 'tìm khách xây nhà biệt thự'],
  },
  {
    slug: 'pets',
    nameEn: 'Pets & Veterinary',
    nameVi: 'Thú Cưng & Thú Y',
    category: 'Healthcare & Wellness',
    iconName: 'PawPrint',
    heroHeadlineEn: 'Heartwarming Pet Care & Grooming Transformations That Win Devoted Fur Parents',
    heroHeadlineVi: 'Video Chăm Sóc & Spa Thú Cưng Đáng Yêu Khiến Hội Yêu Chó Mèo Mê Mẩn',
    heroSubheadlineEn: 'Produce viral pet grooming reveals, vet wellness advice, and playful adoption reels that establish your clinic as the friendliest neighborhood haven.',
    heroSubheadlineVi: 'Xuất những video cắt tỉa lông chó mèo biến hình ngoạn mục, lời khuyên chăm sóc thú cưng từ bác sĩ thú y giúp phòng khám luôn đông khách.',
    painPoints: [
      {
        titleEn: 'Pet Parents Anxious About Rough Handling',
        titleVi: 'Chủ Nuôi Lo Lắng Thú Cưng Bị Đau Hoặc Sợ Hãi',
        descEn: 'Pet owners hesitate to try new groomers or vets unless they see gentle, fear-free handling via video.',
        descVi: 'Chủ chó mèo rất sợ giao thú cưng cho nơi làm ẩu; video tận tâm vuốt ve sẽ tạo dựng lòng tin tuyệt đối.',
      },
      {
        titleEn: 'High Competition Among Neighborhood Pet Stores',
        titleVi: 'Cạnh Tranh Gay Gắt Giữa Các Pet Shop Trong Khu Vực',
        descEn: 'Pet shops struggle to differentiate on pet food alone without offering high-margin grooming packages.',
        descVi: 'Bán thức ăn thú cưng lợi nhuận mỏng; cần các gói dịch vụ spa/tỉa lông để gia tăng lợi nhuận.',
      },
      {
        titleEn: 'Emergency Care Inquiries Happen Fast Online',
        titleVi: 'Khách Cần Tư Vấn Cấp Cứu Nhanh Chóng',
        descEn: 'Owners urgently search social media when their pets show acute distress or unusual behavior.',
        descVi: 'Khi thú cưng bỏ ăn hay nôn mửa, chủ nuôi thường tìm kiếm video triệu chứng để đưa đi viện kịp thời.',
      },
    ],
    samplePromptTitleEn: 'Matted Poodle Glow-Up Grooming Transformation',
    samplePromptTitleVi: 'Màn Lột Xác Spa Cắt Tỉa Lông Cho Bé Cún Poodle',
    samplePromptEn: 'Create a 25-second heartwarming grooming reel: gentle shampoo lather, scissor scissoring around the face, and the adorable happy tail wag finish. Hook: "From walking mop to runway superstar in 25 seconds."',
    samplePromptVi: 'Tạo video 25s đáng yêu: Tắm bọt êm ái cho bé cún, cắt tỉa tròn xoe khuôn mặt như gấu bông và cái vẫy đuôi mừng rỡ. Hook: "Từ một cục bông rối xù biến thành siêu mẫu 4 chân chỉ sau buổi spa này."',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 1800, traditionalTurnaroundDays: 5, sophiaMonthlyUsd: 199, sophiaTurnaroundSeconds: 40, estimatedMonthlySavingsUsd: 1601, estimatedVideoOutputPerMonth: 60 },
    testimonial: {
      quoteEn: 'Our pet salon grooming bookings doubled in 3 weeks after our grooming transformation reels went viral locally.',
      quoteVi: 'Lịch spa thú cưng của tiệm chúng tôi kín từ sáng đến tối sau khi chuỗi video cắt tỉa biến hình cún cưng lên xu hướng địa phương.',
      author: 'Ngoc Anh', roleEn: 'Founder & Head Groomer', roleVi: 'Chủ Spa Thú Cưng', company: 'PawParadise Grooming Lounge', metrics: '2x grooming bookings in 3 weeks',
    },
    faqs: [{
      questionEn: 'Can we add appointment booking links directly to our veterinary Telegram or WhatsApp?',
      questionVi: 'Có thể gắn link đặt lịch khám thú y qua Telegram hay Zalo không?',
      answerEn: 'Yes! Sophia integrates 1-click booking deep links so pet owners can schedule appointments in seconds.',
      answerVi: 'Được chứ! Sophia hỗ trợ gắn link điều hướng trực tiếp sang Zalo hoặc Telegram để khách gửi ảnh tình trạng thú cưng và đặt lịch.',
    }],
    keywordsEn: ['pet marketing video', 'dog grooming reels', 'vet clinic tiktok', 'pet shop video generator'],
    keywordsVi: ['marketing spa thú cưng', 'video cắt tỉa lông chó mèo', 'phòng khám thú y tiktok', 'chăm sóc thú cưng tự động'],
  },
];
