/**
 * Solutions Catalog Data Partition — Dental & Medical Clinic Profiles
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/dental-medical-solution
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export const DENTAL_MEDICAL_SOLUTIONS: SolutionIndustry[] = [
  {
    slug: 'dental',
    nameEn: 'Dental Clinics',
    nameVi: 'Nha Khoa & Răng Hàm Mặt',
    category: 'Healthcare',
    iconName: 'Activity',
    heroHeadlineEn: 'Book 50+ High-Ticket Dental Implants & Veneer Patients Every Month',
    heroHeadlineVi: 'Thu Hút 50+ Khách Hàng Niềng Răng & Trồng Răng Implant Mỗi Tháng',
    heroSubheadlineEn: 'Turn complex clinical procedures into captivating 3D visual shorts that alleviate patient anxiety and drive high-intent appointments.',
    heroSubheadlineVi: 'Biến kỹ thuật nha khoa phức tạp thành các video ngắn 3D trực quan, xóa tan nỗi sợ đau và thúc đẩy bệnh nhân đặt lịch.',
    painPoints: [
      {
        titleEn: 'Patient Fear & Hesitation',
        titleVi: 'Bệnh Nhân Sợ Đau & Lo Lắng Chi Phí',
        descEn: 'Patients delay high-ticket procedures because text ads cannot explain the painless modern process.',
        descVi: 'Khách hàng chần chừ làm răng sứ/implant vì quảng cáo chữ không giải thích được công nghệ không đau.',
      },
      {
        titleEn: 'Extensive Doctor Consultation Time',
        titleVi: 'Bác Sĩ Mất Quá Nhiều Thời Gian Tư Vấn Sơ Bộ',
        descEn: 'Doctors repeat the same answers to basic questions instead of performing high-value procedures.',
        descVi: 'Bác sĩ chuyên khoa phải tốn hàng giờ giải thích đi giải thích lại các câu hỏi cơ bản về quy trình.',
      },
      {
        titleEn: 'High Local PPC Click Costs',
        titleVi: 'Chi Phí Chạy Quảng Cáo Tìm Kiếm Đỏ Lửa',
        descEn: 'Dental keywords on Google Ads exceed $15-$30 per click, making paid search unprofitable.',
        descVi: 'Giá thầu từ khóa nha khoa trên Google đắt đỏ từ 50.000đ - 200.000đ/click nhưng tỷ lệ chốt đơn thấp.',
      },
    ],
    samplePromptTitleEn: '3D All-on-4 Implant Education Video',
    samplePromptTitleVi: 'Video Trực Quan Quy Trình Trồng Răng Implant Không Đau',
    samplePromptEn: 'Create a 30-second patient education video explaining how dental implants restore full chewing ability in 24 hours. Calm clinical tone with aesthetic photorealistic b-roll.',
    samplePromptVi: 'Tạo video giáo dục bệnh nhân 30s giải thích công nghệ phục hình răng All-on-4 ăn nhai sau 24h. Giọng đọc nhẹ nhàng, ấm áp, giải tỏa tâm lý sợ đau cho bệnh nhân lớn tuổi.',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 2500,
      traditionalTurnaroundDays: 7,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 30,
      estimatedMonthlySavingsUsd: 2301,
      estimatedVideoOutputPerMonth: 60,
    },
    testimonial: {
      quoteEn: 'Sophia generated 45 patient education clips for our 3 clinics. Our implant consult bookings surged 82% in month one.',
      quoteVi: 'Sophia đã tự động sản xuất 45 video tư vấn cho chuỗi 3 phòng khám của tôi. Lịch hẹn khám implant tăng 82% ngay tháng đầu.',
      author: 'Dr. Le Hoang Nam',
      roleEn: 'Lead Implantologist',
      roleVi: 'Bác Sĩ Trưởng Khoa Cấy Ghép',
      company: 'SmileCare International',
      metrics: '+82% implant consultation bookings in 30 days',
    },
    faqs: [
      {
        questionEn: 'Are medical claims verified for clinical accuracy?',
        questionVi: 'Nội dung video có đảm bảo chuẩn xác về mặt y khoa không?',
        answerEn: 'Sophia includes specialized dental terminology filters and allows doctors to review script outlines in seconds before final rendering.',
        answerVi: 'Hệ thống tích hợp thư viện thuật ngữ y khoa chính xác, bác sĩ có thể duyệt kịch bản nhanh trên giao diện điện thoại.',
      },
    ],
    keywordsEn: ['dental clinic video marketing', 'implant patient acquisition', 'dental shorts', 'orthodontic leads'],
    keywordsVi: ['marketing phòng khám nha khoa', 'video tư vấn niềng răng', 'quảng cáo trồng răng implant', 'thu hút khách nha khoa'],
  },
  {
    slug: 'medical',
    nameEn: 'Medical & Aesthetic Clinics',
    nameVi: 'Thẩm Mỹ Viện & Da Liễu',
    category: 'Healthcare',
    iconName: 'Activity',
    heroHeadlineEn: 'Fill Your Aesthetic Treatment Suites With Verified Patient Bookings',
    heroHeadlineVi: 'Lấp Đầy Lịch Tư Vấn Thẩm Mỹ & Trị Liệu Da Liễu Cao Cấp',
    heroSubheadlineEn: 'Produce compliant, educational treatment videos explaining dermatological lasers, anti-aging therapies, and wellness protocols.',
    heroSubheadlineVi: 'Sản xuất video giải thích công nghệ nâng cơ, laser trẻ hóa và điều trị da chuẩn y khoa, tạo dựng uy tín tuyệt đối.',
    painPoints: [
      {
        titleEn: 'Strict Ad Policy Bans On Aesthetic Ads',
        titleVi: 'Chính Sách Khắt Khe Của Facebook/TikTok Về Thẩm Mỹ',
        descEn: 'Before/after photos get ad accounts banned instantly on major advertising networks.',
        descVi: 'Hình ảnh trước/sau điều trị thường xuyên bị khóa tài khoản quảng cáo vì vi phạm chính sách hiển thị cơ thể.',
      },
      {
        titleEn: 'Patient Trust Deficit in Aesthetics',
        titleVi: 'Khách Hàng Hoài Nghi Về Hiệu Quả & Độ An Toàn',
        descEn: 'Without clear educational content, patients assume aesthetic procedures are invasive and risky.',
        descVi: 'Thị trường tràn lan cơ sở kém chất lượng khiến khách hàng e dè, cần video giải thích cơ chế khoa học để tin tưởng.',
      },
      {
        titleEn: 'High Acquisition Cost Per Lead',
        titleVi: 'Chi Phí Ra 1 Số Điện Thoại Tư Vấn Quá Cao',
        descEn: 'Aesthetic clinics pay up to $40-$80 per qualified inquiry on conventional channels.',
        descVi: 'Mỗi lead tư vấn liệu trình trên các kênh truyền thống tốn từ 500.000đ - 1.500.000đ nhưng tỷ lệ đến khám chỉ 20%.',
      },
    ],
    samplePromptTitleEn: 'Collagen Stimulation Laser Explanation Video',
    samplePromptTitleVi: 'Cơ Chế Nâng Cơ Trẻ Hóa Da Bằng Sóng Siêu Âm Hội Tụ',
    samplePromptEn: 'Create a 40-second medical aesthetic video breaking down how micro-focused ultrasound triggers new collagen synthesis without needles or downtime. Professional clinical aesthetic.',
    samplePromptVi: 'Tạo video ngắn 40s giải thích cơ chế sóng siêu âm tác động vào tầng cân cơ SMAS giúp nâng cơ tự nhiên không xâm lấn. Tông giọng chuyên gia da liễu đáng tin cậy.',
    roiComparison: {
      traditionalAgencyCostMonthlyUsd: 3000,
      traditionalTurnaroundDays: 7,
      sophiaMonthlyUsd: 199,
      sophiaTurnaroundSeconds: 30,
      estimatedMonthlySavingsUsd: 2801,
      estimatedVideoOutputPerMonth: 60,
    },
    testimonial: {
      quoteEn: 'Our organic TikTok views jumped to 1.2M in 60 days without running any banned paid ad campaigns.',
      quoteVi: 'Lượng người xem tự nhiên trên kênh phòng khám đạt 1.2 triệu view chỉ sau 60 ngày mà không lo bị khóa tài khoản quảng cáo.',
      author: 'Dr. Tran Bich Thuy',
      roleEn: 'Clinic Director',
      roleVi: 'Giám Đốc Chuyên Môn',
      company: 'DermaLuxe Clinic & Spa',
      metrics: '1.2M organic views & +140 treatment bookings',
    },
    faqs: [
      {
        questionEn: 'Do videos comply with medical advertising regulations?',
        questionVi: 'Video có tuân thủ quy định về quảng cáo dịch vụ y tế thẩm mỹ không?',
        answerEn: 'Yes, scripts are engineered to educate patients without sensationalist claims, avoiding before/after shock imagery that violates ad guidelines.',
        answerVi: 'Kịch bản tập trung vào cơ chế khoa học và kiến thức chăm sóc da chuẩn y khoa, tránh các cam kết giật gân giúp vượt duyệt chính sách dễ dàng.',
      },
    ],
    keywordsEn: ['aesthetic clinic video marketing', 'dermatology short video', 'laser treatment reels', 'anti-aging leads'],
    keywordsVi: ['marketing thẩm mỹ viện', 'video chăm sóc da chuẩn y khoa', 'quảng cáo trẻ hóa da', 'tìm kiếm khách hàng spa'],
  },
];
