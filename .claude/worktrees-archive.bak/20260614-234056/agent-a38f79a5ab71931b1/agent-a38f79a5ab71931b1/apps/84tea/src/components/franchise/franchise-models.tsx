"use client";

import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MODELS = [
  {
    id: "kiosk",
    title: "Kiosk",
    area: "10 - 15m²",
    location: "Trung tâm thương mại, Tòa nhà văn phòng",
    features: [
      "Chi phí đầu tư thấp",
      "Vận hành đơn giản (2-3 nhân sự)",
      "Tập trung bán mang đi (Takeaway)",
      "Menu tinh gọn, bán chạy nhất"
    ],
    idealFor: "Nhà đầu tư mới, Vốn nhỏ",
    color: "bg-tertiary text-on-tertiary"
  },
  {
    id: "express",
    title: "Express",
    area: "25 - 40m²",
    location: "Mặt phố, Khu dân cư đông đúc",
    features: [
      "Cân bằng giữa Takeaway và Ngồi tại chỗ",
      "Menu đồ uống đa dạng",
      "Không gian trẻ trung, năng động",
      "Chi phí vận hành tối ưu"
    ],
    idealFor: "Mặt bằng phố, Kinh doanh chuyên nghiệp",
    highlight: true,
    color: "bg-primary text-on-primary"
  },
  {
    id: "lounge",
    title: "Lounge",
    area: "50 - 80m²",
    location: "Khu vực cao cấp, Điểm du lịch",
    features: [
      "Trải nghiệm trà đạo trọn vẹn",
      "Phục vụ đồ uống và bánh ngọt cao cấp",
      "Không gian Indochine Luxury sang trọng",
      "Tổ chức workshop trà đạo"
    ],
    idealFor: "Đầu tư chiến lược, Định vị cao cấp",
    color: "bg-secondary text-on-secondary"
  }
];

export function FranchiseModels() {
  return (
    <section id="models" className="py-24 bg-surface-container-low">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Typography variant="label-large" className="text-secondary tracking-widest uppercase mb-4">
            Mô hình kinh doanh
          </Typography>
          <Typography variant="headline-large" className="text-on-surface font-display mb-6">
            Đa dạng lựa chọn đầu tư
          </Typography>
          <Typography variant="body-large" className="text-on-surface-variant">
            3 mô hình được tối ưu hóa cho từng phân khúc thị trường và khả năng tài chính.
          </Typography>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {MODELS.map((model) => (
            <div key={model.id} className={`relative flex flex-col h-full ${model.highlight ? 'lg:-mt-8 lg:mb-8' : ''}`}>
               {model.highlight && (
                 <div className="absolute -top-10 left-0 right-0 flex justify-center z-10">
                   <span className="bg-secondary text-on-secondary py-2 px-6 rounded-t-xl font-bold text-sm uppercase tracking-wider shadow-sm">
                     Phổ biến nhất
                   </span>
                 </div>
               )}
              <Card
                className={`h-full flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-2 ${model.highlight ? 'shadow-xl border-secondary border-2' : 'shadow-md'}`}
              >
                <div className={`p-8 ${model.color}`}>
                  <Typography variant="headline-medium" className="font-display mb-2">
                    {model.title}
                  </Typography>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-lg">square_foot</span>
                    <Typography variant="body-medium">{model.area}</Typography>
                  </div>
                </div>

                <CardContent className="p-8 flex-1 flex flex-col bg-surface">
                  <div className="mb-6 pb-6 border-b border-outline-variant">
                    <Typography variant="label-large" className="text-on-surface-variant mb-2 block">
                      Vị trí tối ưu
                    </Typography>
                    <Typography variant="body-large" className="text-on-surface font-medium">
                      {model.location}
                    </Typography>
                  </div>

                  <div className="mb-8 flex-1">
                    <Typography variant="label-large" className="text-on-surface-variant mb-4 block">
                      Đặc điểm nổi bật
                    </Typography>
                    <ul className="space-y-3">
                      {model.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="material-symbols-rounded text-primary text-xl shrink-0">check_circle</span>
                          <Typography variant="body-medium" className="text-on-surface">
                            {feature}
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-surface-container p-4 rounded-xl mb-6">
                    <Typography variant="label-small" className="text-on-surface-variant uppercase tracking-wide block mb-1">
                      Phù hợp với
                    </Typography>
                    <Typography variant="body-medium" className="text-primary font-bold">
                      {model.idealFor}
                    </Typography>
                  </div>

                  <Button variant={model.highlight ? "filled" : "outlined"} className="w-full" onClick={() => document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth' })}>
                    Nhận báo giá chi tiết
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
