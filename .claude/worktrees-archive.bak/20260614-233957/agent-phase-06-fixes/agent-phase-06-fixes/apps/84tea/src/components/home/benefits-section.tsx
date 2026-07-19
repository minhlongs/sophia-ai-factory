"use client";

import { Typography } from "@/components/ui/typography";

const BENEFITS = [
  {
    icon: "eco",
    title: "100% Tự nhiên",
    description: "Không hóa chất, không chất bảo quản, sinh trưởng hoàn toàn tự nhiên nơi rừng già."
  },
  {
    icon: "history_edu",
    title: "Di sản văn hóa",
    description: "Mỗi búp trà mang trong mình câu chuyện văn hóa của đồng bào dân tộc thiểu số."
  },
  {
    icon: "verified",
    title: "Chuẩn OCOP 5 Sao",
    description: "Được công nhận là sản phẩm quốc gia, đáp ứng các tiêu chuẩn khắt khe nhất."
  },
  {
    icon: "handshake",
    title: "Thương mại công bằng",
    description: "Cam kết thu mua giá cao, đảm bảo sinh kế bền vững cho người dân bản địa."
  }
];

export function BenefitsSection() {
  return (
    <section className="py-24 bg-tertiary text-on-tertiary">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {BENEFITS.map((item, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-6 text-on-secondary-container">
                <span className="material-symbols-rounded text-3xl">{item.icon}</span>
              </div>
              <Typography variant="title-large" className="mb-3 font-display">
                {item.title}
              </Typography>
              <Typography variant="body-medium" className="text-on-tertiary leading-relaxed">
                {item.description}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
