import Link from "next/link";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

const trainingModules = [
  {
    id: 1,
    title: "Văn Hóa & Thương Hiệu",
    titleEn: "Brand & Culture",
    duration: "45 phút",
    lessons: 5,
    description: "Tìm hiểu về lịch sử, giá trị và sứ mệnh của 84tea",
    icon: "🎯",
    topics: [
      "Lịch sử thương hiệu 84tea",
      "Sứ mệnh và tầm nhìn",
      "Giá trị cốt lõi",
      "Câu chuyện trà Shan Tuyết",
      "Tiêu chuẩn phục vụ",
    ],
    status: "required",
  },
  {
    id: 2,
    title: "Kiến Thức Sản Phẩm",
    titleEn: "Product Knowledge",
    duration: "60 phút",
    lessons: 8,
    description: "Hiểu sâu về các loại trà và lợi ích sức khỏe",
    icon: "🍵",
    topics: [
      "Phân loại trà cổ thụ",
      "Quy trình lên men",
      "Lợi ích sức khỏe",
      "Nguồn gốc và vùng trồng",
      "Bảo quản trà đúng cách",
      "Phân biệt hàng thật/giả",
      "Trả lời câu hỏi khách hàng",
      "Upselling techniques",
    ],
    status: "required",
  },
  {
    id: 3,
    title: "Nghệ Thuật Pha Trà",
    titleEn: "Brewing Skills",
    duration: "90 phút",
    lessons: 6,
    description: "Thực hành kỹ thuật pha trà chuyên nghiệp",
    icon: "🫖",
    topics: [
      "Công cụ và dụng cụ pha trà",
      "Nhiệt độ và thời gian chuẩn",
      "Kỹ thuật tráng trà",
      "Pha trà Kung Fu",
      "Pha trà cold brew",
      "Xử lý sự cố khi pha",
    ],
    status: "required",
  },
  {
    id: 4,
    title: "Dịch Vụ Khách Hàng",
    titleEn: "Customer Service",
    duration: "45 phút",
    lessons: 5,
    description: "Kỹ năng giao tiếp và xử lý tình huống",
    icon: "🤝",
    topics: [
      "Chào đón và tiễn khách",
      "Lắng nghe và tư vấn",
      "Xử lý khiếu nại",
      "Tạo ấn tượng tốt",
      "Xây dựng khách hàng thân thiết",
    ],
    status: "required",
  },
  {
    id: 5,
    title: "Vận Hành & POS",
    titleEn: "Operations & POS",
    duration: "60 phút",
    lessons: 7,
    description: "Sử dụng hệ thống và quy trình vận hành",
    icon: "💻",
    topics: [
      "Sử dụng máy POS",
      "Thanh toán và hóa đơn",
      "Quản lý kho hàng",
      "Checklist mở/đóng cửa",
      "Báo cáo doanh số",
      "Xử lý đơn online",
      "Vệ sinh an toàn thực phẩm",
    ],
    status: "required",
  },
];

export default function TrainingPage() {
  const totalLessons = trainingModules.reduce((acc, m) => acc + m.lessons, 0);
  const totalDuration = trainingModules.reduce(
    (acc, m) => acc + parseInt(m.duration),
    0
  );

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold mb-4">
              🎓 CHƯƠNG TRÌNH ĐÀO TẠO
            </span>
            <Typography
              variant="display-medium"
              className="text-primary font-bold mb-4 font-display"
            >
              84tea Academy
            </Typography>
            <Typography
              variant="body-large"
              className="text-on-surface-variant max-w-2xl mx-auto"
            >
              Chương trình đào tạo toàn diện 2 tuần dành cho nhân viên mới và đối
              tác nhượng quyền
            </Typography>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-6 text-center">
                <Typography
                  variant="headline-medium"
                  className="font-bold text-primary mb-1"
                >
                  {trainingModules.length}
                </Typography>
                <Typography variant="body-small" className="text-on-surface-variant">
                  Modules
                </Typography>
              </CardContent>
            </Card>
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-6 text-center">
                <Typography
                  variant="headline-medium"
                  className="font-bold text-primary mb-1"
                >
                  {totalLessons}
                </Typography>
                <Typography variant="body-small" className="text-on-surface-variant">
                  Bài học
                </Typography>
              </CardContent>
            </Card>
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-6 text-center">
                <Typography
                  variant="headline-medium"
                  className="font-bold text-primary mb-1"
                >
                  {Math.round(totalDuration / 60)}h
                </Typography>
                <Typography variant="body-small" className="text-on-surface-variant">
                  Tổng thời gian
                </Typography>
              </CardContent>
            </Card>
          </div>

          {/* Modules */}
          <div className="space-y-6 mb-12">
            {trainingModules.map((module) => (
              <Link
                key={module.id}
                href={`/training/module-${module.id}`}
                className="block group"
              >
                <Card className="border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1 bg-surface-container-low group-hover:bg-surface-container">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 text-3xl">
                        {module.icon}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm text-secondary font-semibold">
                            Module {module.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-medium">
                            Bắt buộc
                          </span>
                        </div>
                        <Typography
                          variant="title-large"
                          className="font-display text-on-surface mb-1 group-hover:text-primary transition-colors"
                        >
                          {module.title}
                        </Typography>
                        <Typography
                          variant="body-medium"
                          className="text-on-surface-variant mb-3"
                        >
                          {module.description}
                        </Typography>

                        <div className="flex flex-wrap gap-2">
                          {module.topics.slice(0, 4).map((topic) => (
                            <span
                              key={topic}
                              className="px-3 py-1 bg-surface rounded-full text-xs text-on-surface-variant/80 border border-outline-variant/50"
                            >
                              {topic}
                            </span>
                          ))}
                          {module.topics.length > 4 && (
                            <span className="px-3 py-1 bg-surface rounded-full text-xs text-on-surface-variant/80 border border-outline-variant/50">
                              +{module.topics.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 text-right">
                        <div className="text-sm text-on-surface-variant">
                          <span className="font-semibold text-primary">
                            {module.lessons}
                          </span>{" "}
                          bài học
                        </div>
                        <div className="text-sm text-on-surface-variant">
                          ⏱️ {module.duration}
                        </div>
                        <div className="w-full bg-surface-variant rounded-full h-2 mt-2 md:w-32 overflow-hidden">
                          <div className="bg-primary h-2 rounded-full w-0" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Certification */}
          <div className="bg-primary rounded-2xl p-8 text-on-primary text-center shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/20 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl" />

            <div className="relative z-10">
              <span className="text-5xl mb-4 block">🏆</span>
              <Typography
                variant="headline-medium"
                className="font-display mb-2 text-on-primary"
              >
                Chứng Chỉ 84tea Certified
              </Typography>
              <Typography
                variant="body-large"
                className="text-on-primary/90 mb-6 max-w-lg mx-auto"
              >
                Hoàn thành tất cả 5 modules và đạt điểm quiz tối thiểu 80% để nhận
                chứng chỉ chính thức
              </Typography>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="px-6 py-3 rounded-full bg-white/10 backdrop-blur border border-white/20 text-on-primary font-medium">
                  ✅ Hoàn thành 5 modules
                </div>
                <div className="px-6 py-3 rounded-full bg-white/10 backdrop-blur border border-white/20 text-on-primary font-medium">
                  📝 Quiz ≥ 80%
                </div>
                <div className="px-6 py-3 rounded-full bg-white/10 backdrop-blur border border-white/20 text-on-primary font-medium">
                  🎬 Thực hành on-site
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
