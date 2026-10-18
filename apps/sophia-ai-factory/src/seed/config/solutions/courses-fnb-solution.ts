/**
 * Solutions Catalog Data Partition — Online Courses & F&B Restaurants
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/courses-fnb-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const COURSES_FNB_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'courses-coaching',
    nameEn: 'Online Courses & Coaching',
    nameVi: 'Khóa Học & Huấn Luyện Viên',
    category: 'Education & Knowledge',
    iconName: 'GraduationCap',
    heroHeadlineEn: 'Turn Frameworks Into Viral Micro-Lessons That Fill Cohorts On Autopilot',
    heroHeadlineVi: 'Biến Kiến Thức Chuyên Môn Thành Bài Học Ngắn Thu Hút Học Viên Tự Động',
    heroSubheadlineEn: 'Produce punchy 60-second educational breakdowns, mental model teardowns, and actionable case studies that build instant authority.',
    heroSubheadlineVi: 'Đóng gói kiến thức thành các clip 60 giây dễ hiểu, phân tích tình huống thực tế và xây dựng uy tín chuyên gia trong ngành.',
    painPoints: [
      {
        titleEn: 'Low Trust and Authority Skepticism',
        titleVi: 'Khách Hàng Nghi Ngờ Về Giá Trị Thực Tế',
        descEn: 'The internet is crowded with fake gurus; creators need consistent, high-value proofs of expertise to convert students.',
        descVi: 'Khách hàng sợ gặp phải khóa học lý thuyết suông; cần video chia sẻ bài học thực chiến để chứng minh năng lực.',
      },
      {
        titleEn: 'Camera Shyness and Tedious Recording Cycles',
        titleVi: 'Ngại Đứng Trước Máy Quay & Tốn Thời Gian',
        descEn: 'Instructors burn out after hours of speaking to a camera, editing retakes, and fixing audio mistakes.',
        descVi: 'Nhiều giảng viên mất hàng giờ ghi hình, nói vấp phải quay lại và mất công cắt ghép.',
      },
      {
        titleEn: 'Rising Paid Ad Lead Costs',
        titleVi: 'Chi Phí Chạy Quảng Cáo Facebook Quá Đắt',
        descEn: 'Cost per lead on Meta ads has surged 200%, demanding organic video hooks to drive down blended CPA.',
        descVi: 'Giá lead quảng cáo Facebook ngày càng đắt, cần video ngắn kéo traffic tự nhiên để giảm giá vốn.',
      },
    ],
    samplePromptTitleEn: 'Actionable 60-Second Framework Mini-Lesson',
    samplePromptTitleVi: 'Kịch Bản Bài Học Ngắn 60s Giải Quyết Vấn Đề',
    samplePromptEn: 'Create a 60-second micro-lesson explaining the 3 common mistake beginners make in financial accounting. Hook: "If you are still calculating your net profit this way, you are lying to your investors." Call to action: Comment "AUDIT" to receive the free spreadsheet template.',
    samplePromptVi: 'Tạo video ngắn 60s chia sẻ 3 sai lầm chí mạng khi lập kế hoạch tài chính. Hook: "Nếu bạn vẫn tính điểm hòa vốn kiểu này, bạn đang đốt sạch vốn mà không hề biết." Kêu gọi hành động: Nhắn tin nhận bảng tính mẫu miễn phí.',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 2200, traditionalTurnaroundDays: 10, sophiaMonthlyUsd: 199, sophiaTurnaroundSeconds: 60, estimatedMonthlySavingsUsd: 2001, estimatedVideoOutputPerMonth: 60 },
    testimonial: {
      quoteEn: 'I booked out my $2,000 cohort in 12 days purely using Sophia-generated bite-sized lesson shorts on YouTube.',
      quoteVi: 'Khóa coaching 20 triệu của tôi kín chỗ trong 12 ngày hoàn toàn nhờ các video bài học ngắn do Sophia tạo trên YouTube Shorts.',
      author: 'David Thorne', roleEn: 'Executive Career Coach', roleVi: 'Chuyên Gia Cố Vấn Doanh Nghiệp', company: 'Leadership Forge', metrics: '35 cohort seats filled ($70K revenue) in 12 days',
    },
    faqs: [{
      questionEn: 'Can Sophia voice videos in a professional, academic tone?',
      questionVi: 'Giọng đọc AI có đủ chuẩn mực và truyền cảm như giảng viên thật không?',
      answerEn: 'Yes! Choose from deep, authoritative narrative voices engineered specifically for masterclasses and corporate training.',
      answerVi: 'Có! Hệ thống sở hữu kho giọng đọc truyền cảm, ấm áp và đĩnh đạc, phù hợp với các chương trình đào tạo chuyên sâu.',
    }],
    keywordsEn: ['course creator video marketing', 'coaching reels generator', 'youtube shorts mini lessons', 'expert authority clips'],
    keywordsVi: ['marketing khóa học online', 'video bài học ngắn', 'kênh youtube kiến thức', 'thu hút học viên tự động'],
  },
  {
    slug: 'fnb-restaurants',
    nameEn: 'Restaurants, Cafes & Food Brands',
    nameVi: 'Nhà Hàng, Quán Cafe & Ẩm Thực',
    category: 'Local Hospitality',
    iconName: 'Utensils',
    heroHeadlineEn: 'Mouthwatering Sensory Sizzles That Pack Dining Rooms and Weekend Tables',
    heroHeadlineVi: 'Thước Phim Ẩm Thực Đậm Đà Vị Giác Giúp Quán Luôn Kín Bàn Đặt Trước',
    heroSubheadlineEn: 'Produce viral sizzling audio clips, chef technique close-ups, and seasonal culinary promos that trigger uncontrollable cravings.',
    heroSubheadlineVi: 'Sản xuất video cận cảnh món ăn nghi ngút khói, tiếng xèo xèo hấp dẫn và ưu đãi cuối tuần kích thích thực khách ghé quán ngay.',
    painPoints: [
      {
        titleEn: 'Competing with Trend Food Reviewers',
        titleVi: 'Phụ Thuộc Vào Reviewer Ẩm Thực Tốn Kém',
        descEn: 'Food bloggers charge millions per review with fleeting benefits and no guaranteed quality control.',
        descVi: 'Mời reviewer tốn vài triệu đến cả chục triệu nhưng khách chỉ đông được 2-3 hôm rồi lại vắng.',
      },
      {
        titleEn: 'Low Weekday Foot Traffic',
        titleVi: 'Vắng Khách Vào Các Ngày Đầu Tuần',
        descEn: 'Restaurants sit half-empty Tuesday afternoons without targeted lunch special video pushes.',
        descVi: 'Các ngày từ thứ 2 đến thứ 5 lượng khách giảm mạnh, cần video quảng cáo combo trưa để kéo khách.',
      },
      {
        titleEn: 'Difficult to Convey Flavor in Static Photos',
        titleVi: 'Ảnh Chụp Tĩnh Không Thể Hiện Hết Vị Ngon',
        descEn: 'Static menu photos fail to communicate sizzling audio, melting cheese, and fresh bubbling broth.',
        descVi: 'Ảnh chụp món ăn trên mạng xã hội không tạo được cảm giác thèm ăn bằng video có âm thanh chân thực.',
      },
    ],
    samplePromptTitleEn: 'Sensory Sizzling Wagyu Steak Reel',
    samplePromptTitleVi: 'Cận Cảnh Bò Wagyu Xèo Xèo Trên Chảo Gang Nóng Hổi',
    samplePromptEn: 'Create a 15-second ASMR culinary reel: Thick cut steak searing with rosemary butter, smoke curling upwards, cutting open to reveal perfect medium-rare pink center. Hook: "Listen to that sizzle."',
    samplePromptVi: 'Tạo video ngắn 15s cận cảnh: Miếng thịt bò áp chảo bơ tỏi thơm lừng, xắt lát mềm mọng nước sốt tiêu đen. Âm thanh xèo xèo chân thực, kết thúc với ưu đãi tặng món tráng miệng khi đặt bàn trước.',
    roiComparison: { traditionalAgencyCostMonthlyUsd: 1800, traditionalTurnaroundDays: 7, sophiaMonthlyUsd: 199, sophiaTurnaroundSeconds: 30, estimatedMonthlySavingsUsd: 1601, estimatedVideoOutputPerMonth: 60 },
    testimonial: {
      quoteEn: 'Our weekday lunch reservation rate jumped 65% after running daily 15-second kitchen ASMR specials.',
      quoteVi: 'Lượng khách đặt bàn ăn trưa các ngày trong tuần tăng 65% sau khi quán đăng đều đặn các clip nấu nướng âm thanh hấp dẫn.',
      author: 'Chef Le Tuan', roleEn: 'Head Chef & Owner', roleVi: 'Bếp Trưởng & Chủ Nhà Hàng', company: 'The Copper Pot Bistro', metrics: '+65% weekday lunch bookings',
    },
    faqs: [{
      questionEn: 'Can Sophia integrate real sizzle and cooking sound effects (ASMR)?',
      questionVi: 'Sophia có tự ghép âm thanh nấu nướng xèo xèo (ASMR) vào clip không?',
      answerEn: 'Yes! Sophia automatically aligns high-fidelity culinary audio effects — sizzling pans, ice clinking, and sauce pours — with video cuts.',
      answerVi: 'Có! Hệ thống tự động khớp tiếng xèo xèo của chảo, tiếng rót nước và âm thanh chế biến sống động theo từng khung hình.',
    }],
    keywordsEn: ['restaurant video marketing', 'food asmr reels', 'cafe promotion tiktok', 'culinary short video'],
    keywordsVi: ['marketing nhà hàng quán ăn', 'video món ăn hấp dẫn', 'quảng cáo quán cafe', 'làm video tiktok ẩm thực'],
  },
];
