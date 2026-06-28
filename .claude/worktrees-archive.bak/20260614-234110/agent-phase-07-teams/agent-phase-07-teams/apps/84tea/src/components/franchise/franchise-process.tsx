"use client";

import { Typography } from "@/components/ui/typography";

const STEPS = [
  {
    step: "01",
    title: "Đăng ký tư vấn",
    description: "Điền thông tin vào form đăng ký. Chuyên viên của chúng tôi sẽ liên hệ lại trong vòng 24h."
  },
  {
    step: "02",
    title: "Khảo sát & Ký HĐ",
    description: "Khảo sát mặt bằng, tư vấn mô hình phù hợp và ký kết hợp đồng nhượng quyền."
  },
  {
    step: "03",
    title: "Thiết kế & Thi công",
    description: "Lên bản vẽ thiết kế 3D và thi công cửa hàng theo tiêu chuẩn Indochine Luxury."
  },
  {
    step: "04",
    title: "Đào tạo & Setup",
    description: "Đào tạo nhân sự, setup máy móc, nguyên vật liệu và quy trình vận hành."
  },
  {
    step: "05",
    title: "Khai trương",
    description: "Hỗ trợ tổ chức khai trương, chạy quảng cáo và chính thức đi vào hoạt động."
  }
];

export function FranchiseProcess() {
  return (
    <section className="py-24 bg-tertiary text-on-tertiary overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Typography variant="label-large" className="text-secondary-container tracking-widest uppercase mb-4">
            Quy trình hợp tác
          </Typography>
          <Typography variant="headline-large" className="font-display mb-6">
            Lộ trình 5 bước đến thành công
          </Typography>
          <Typography variant="body-large" className="text-on-tertiary">
            Quy trình tinh gọn, minh bạch giúp bạn sở hữu cửa hàng 84tea chỉ sau 15-30 ngày.
          </Typography>
        </div>

        <div className="relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-on-tertiary/20 -translate-y-1/2 z-0" />

          <div className="grid lg:grid-cols-5 gap-8 relative z-10">
            {STEPS.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-display text-2xl font-bold mb-6 shadow-lg shadow-secondary/20 group-hover:scale-110 transition-transform duration-300 relative z-10">
                  {step.step}
                </div>
                <Typography variant="title-large" className="mb-3 font-display text-secondary-container">
                  {step.title}
                </Typography>
                <Typography variant="body-medium" className="text-on-tertiary">
                  {step.description}
                </Typography>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
