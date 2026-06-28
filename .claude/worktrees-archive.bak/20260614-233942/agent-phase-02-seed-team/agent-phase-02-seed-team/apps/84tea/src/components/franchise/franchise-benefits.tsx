"use client";

import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

const BENEFITS = [
  {
    icon: "storefront",
    title: "Mô hình linh hoạt",
    description: "Đa dạng quy mô từ Kiosk đến Lounge cao cấp, phù hợp với nhiều mức đầu tư và vị trí mặt bằng."
  },
  {
    icon: "monitoring",
    title: "Vận hành chuẩn hóa",
    description: "Quy trình vận hành, pha chế, phục vụ được chuẩn hóa 100%, dễ dàng đào tạo và quản lý."
  },
  {
    icon: "soup_kitchen",
    title: "Nguồn nguyên liệu độc quyền",
    description: "Sở hữu vùng nguyên liệu trà cổ thụ riêng biệt, đảm bảo chất lượng và giá thành ổn định nhất thị trường."
  },
  {
    icon: "campaign",
    title: "Marketing toàn diện",
    description: "Hỗ trợ truyền thông đa kênh, các chiến dịch branding và promotion định kỳ từ tổng công ty."
  },
  {
    icon: "school",
    title: "Đào tạo chuyên sâu",
    description: "Chương trình đào tạo từ cơ bản đến nâng cao cho chủ đầu tư và nhân viên về trà đạo và quản lý."
  },
  {
    icon: "engineering",
    title: "Hỗ trợ kỹ thuật 24/7",
    description: "Đội ngũ IT và kỹ thuật luôn sẵn sàng hỗ trợ hệ thống POS, app quản lý và bảo trì thiết bị."
  }
];

export function FranchiseBenefits() {
  return (
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Typography variant="label-large" className="text-secondary tracking-widest uppercase mb-4">
            Tại sao chọn 84tea?
          </Typography>
          <Typography variant="headline-large" className="text-on-surface font-display mb-6">
            Lợi thế cạnh tranh vượt trội
          </Typography>
          <Typography variant="body-large" className="text-on-surface-variant">
            Chúng tôi không chỉ nhượng quyền thương hiệu, chúng tôi chia sẻ bí quyết thành công
            và đồng hành cùng bạn trên con đường kinh doanh bền vững.
          </Typography>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BENEFITS.map((item, index) => (
            <Card key={index} variant="outlined" className="hover:border-primary transition-colors duration-300">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center mb-6 text-on-secondary-container">
                  <span className="material-symbols-rounded text-3xl">{item.icon}</span>
                </div>
                <Typography variant="title-large" className="mb-3 text-on-surface font-bold">
                  {item.title}
                </Typography>
                <Typography variant="body-medium" className="text-on-surface-variant leading-relaxed">
                  {item.description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
