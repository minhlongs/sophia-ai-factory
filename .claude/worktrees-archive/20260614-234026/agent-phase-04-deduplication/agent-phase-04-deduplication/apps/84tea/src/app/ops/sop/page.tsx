import Link from "next/link";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const sopSections = [
  {
    id: "brewing",
    title: "Hướng Dẫn Pha Trà",
    icon: "🍵",
    description: "Kỹ thuật pha trà đúng chuẩn 84tea",
    content: [
      {
        name: "Shan Tuyết Cổ Thụ (84 LIMITED)",
        temp: "90°C",
        time: "3-5 phút",
        ratio: "6g / 150ml",
        steps: [
          "Làm nóng ấm và chén bằng nước sôi",
          "Cho trà vào ấm, đổ nước 90°C",
          "Đợi 30 giây, rót bỏ nước đầu (tráng trà)",
          "Pha lần 2: đợi 3-5 phút",
          "Rót đều ra các chén, không để cặn",
        ],
      },
      {
        name: "Lục Trà Cổ Thụ (CLASSIC)",
        temp: "80°C",
        time: "2-3 phút",
        ratio: "5g / 150ml",
        steps: [
          "Làm nóng ấm và chén",
          "Cho trà vào, đổ nước 80°C",
          "Đợi 2-3 phút (không quá lâu để tránh đắng)",
          "Rót ra chén, thưởng thức ngay",
        ],
      },
      {
        name: "Trà Cổ Thụ Lên Men (PREMIUM)",
        temp: "95°C",
        time: "5-7 phút",
        ratio: "8g / 200ml",
        steps: [
          "Làm nóng ấm bằng nước sôi",
          "Cho trà vào, đổ nước 95°C",
          "Tráng trà lần đầu (30 giây)",
          "Pha lần 2: đợi 5-7 phút",
          "Có thể pha 5-7 lần",
        ],
      },
    ],
  },
  {
    id: "service",
    title: "Dịch Vụ Khách Hàng",
    icon: "🤝",
    description: "Quy trình phục vụ và chăm sóc khách hàng",
    guidelines: [
      {
        title: "Chào đón",
        steps: [
          "Cười và chào khách trong 5 giây",
          "\"Xin chào, kính mời quý khách!\"",
          "Hướng dẫn khách vào bàn",
          "Đưa menu và giới thiệu sản phẩm nổi bật",
        ],
      },
      {
        title: "Tư vấn & Order",
        steps: [
          "Hỏi khách có cần tư vấn không",
          "Giới thiệu dựa trên sở thích (đậm/nhẹ, nóng/lạnh)",
          "Gợi ý upsell: combo, size lớn, mua về",
          "Xác nhận lại order trước khi chế biến",
        ],
      },
      {
        title: "Phục vụ",
        steps: [
          "Mang trà ra trong 5-7 phút",
          "Đặt ấm/chén đúng vị trí, hướng dẫn cách pha nếu cần",
          "Check lại sau 2 phút xem khách có cần gì thêm",
          "Châm thêm nước nóng khi cần",
        ],
      },
      {
        title: "Thanh toán & Tiễn khách",
        steps: [
          "Đưa hóa đơn khi khách yêu cầu",
          "Xử lý thanh toán nhanh gọn",
          "\"Cảm ơn quý khách, hẹn gặp lại!\"",
          "Dọn bàn ngay sau khi khách rời",
        ],
      },
    ],
  },
  {
    id: "inventory",
    title: "Quản Lý Kho",
    icon: "📦",
    description: "Theo dõi nguyên liệu và đặt hàng",
    items: [
      { name: "Shan Tuyết 6g", min: 50, unit: "gói" },
      { name: "Lục Trà 80g", min: 20, unit: "hộp" },
      { name: "Trà Lên Men 80g", min: 15, unit: "hộp" },
      { name: "Đường phèn", min: 5, unit: "kg" },
      { name: "Chanh tươi", min: 30, unit: "quả" },
      { name: "Cốc giấy 360ml", min: 200, unit: "cái" },
      { name: "Túi đựng", min: 100, unit: "cái" },
    ],
  },
];

export default function SOPPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <Typography variant="display-medium" className="font-display text-primary mb-4">
              SOP Vận Hành 84tea
            </Typography>
            <Typography variant="body-large" className="text-on-surface-variant max-w-2xl mx-auto">
              Standard Operating Procedures - Quy trình vận hành chuẩn cho tất cả
              điểm bán 84tea
            </Typography>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link href="/ops/checklist">
              <Button variant="filled" size="lg" className="rounded-full bg-primary text-on-primary">
                📋 Checklist hàng ngày
              </Button>
            </Link>
            <Link href="#brewing">
              <Button variant="outlined" size="lg" className="rounded-full border-secondary text-secondary hover:bg-secondary-container">
                🍵 Hướng dẫn pha trà
              </Button>
            </Link>
          </div>

          {/* Brewing Guide */}
          <section id="brewing" className="mb-12">
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-4xl">🍵</span>
                  <div>
                    <Typography variant="headline-medium" className="font-display text-on-surface">
                      Hướng Dẫn Pha Trà
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      Kỹ thuật pha trà đúng chuẩn 84tea
                    </Typography>
                  </div>
                </div>

                <div className="space-y-8">
                  {sopSections[0].content?.map((tea) => (
                    <div
                      key={tea.name}
                      className="bg-surface rounded-xl p-6 border border-outline-variant"
                    >
                      <Typography variant="title-large" className="font-display text-primary mb-4">
                        {tea.name}
                      </Typography>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-surface-container rounded-lg">
                          <Typography variant="label-small" className="uppercase text-secondary mb-1">
                            Nhiệt độ
                          </Typography>
                          <Typography variant="title-medium" className="font-bold text-primary">
                            {tea.temp}
                          </Typography>
                        </div>
                        <div className="text-center p-3 bg-surface-container rounded-lg">
                          <Typography variant="label-small" className="uppercase text-secondary mb-1">
                            Thời gian
                          </Typography>
                          <Typography variant="title-medium" className="font-bold text-primary">
                            {tea.time}
                          </Typography>
                        </div>
                        <div className="text-center p-3 bg-surface-container rounded-lg">
                          <Typography variant="label-small" className="uppercase text-secondary mb-1">
                            Tỷ lệ
                          </Typography>
                          <Typography variant="title-medium" className="font-bold text-primary">
                            {tea.ratio}
                          </Typography>
                        </div>
                      </div>

                      <ol className="space-y-2">
                        {tea.steps.map((step, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-on-surface-variant"
                          >
                            <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-sm flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <Typography variant="body-medium">{step}</Typography>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Customer Service */}
          <section id="service" className="mb-12">
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-4xl">🤝</span>
                  <div>
                    <Typography variant="headline-medium" className="font-display text-on-surface">
                      Dịch Vụ Khách Hàng
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      Quy trình phục vụ và chăm sóc khách hàng
                    </Typography>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {sopSections[1].guidelines?.map((guide) => (
                    <div
                      key={guide.title}
                      className="bg-surface rounded-xl p-6 border border-outline-variant"
                    >
                      <Typography variant="title-medium" className="font-semibold text-primary mb-4">
                        {guide.title}
                      </Typography>
                      <ul className="space-y-2">
                        {guide.steps.map((step, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-on-surface-variant"
                          >
                            <span className="text-primary">•</span>
                            <Typography variant="body-medium">{step}</Typography>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Inventory */}
          <section id="inventory" className="mb-12">
            <Card className="bg-surface-container-low border-none shadow-sm">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-4xl">📦</span>
                  <div>
                    <Typography variant="headline-medium" className="font-display text-on-surface">
                      Quản Lý Kho
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      Mức tồn kho tối thiểu
                    </Typography>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="text-left py-3 px-4">
                          <Typography variant="title-small" className="text-on-surface">Sản phẩm</Typography>
                        </th>
                        <th className="text-center py-3 px-4">
                          <Typography variant="title-small" className="text-on-surface">Tồn tối thiểu</Typography>
                        </th>
                        <th className="text-center py-3 px-4">
                          <Typography variant="title-small" className="text-on-surface">Đơn vị</Typography>
                        </th>
                        <th className="text-center py-3 px-4">
                          <Typography variant="title-small" className="text-on-surface">Trạng thái</Typography>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sopSections[2].items?.map((item) => (
                        <tr key={item.name} className="border-b border-outline-variant hover:bg-surface-container">
                          <td className="py-3 px-4">
                            <Typography variant="body-medium" className="text-on-surface">{item.name}</Typography>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Typography variant="body-medium" className="font-mono text-primary">{item.min}</Typography>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Typography variant="body-medium" className="text-on-surface-variant/80">{item.unit}</Typography>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm inline-block">
                              ✓ Đủ
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Emergency */}
          <section id="emergency" className="mb-12">
            <Card className="bg-error-container border-2 border-error shadow-none">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-4xl">🚨</span>
                  <div>
                    <Typography variant="headline-medium" className="font-display text-on-error-container">
                      Xử Lý Khẩn Cấp
                    </Typography>
                    <Typography variant="body-medium" className="text-on-error-container/80">
                      Các tình huống khẩn cấp và cách xử lý
                    </Typography>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-surface rounded-xl p-6">
                    <Typography variant="title-medium" className="font-semibold text-error mb-3">
                      🔥 Hỏa hoạn
                    </Typography>
                    <ol className="space-y-2 text-sm text-on-surface-variant">
                      <li>1. Bật chuông báo động, hô to &quot;Cháy!&quot;</li>
                      <li>2. Hướng dẫn khách thoát hiểm</li>
                      <li>3. Gọi 114 (Cứu hỏa)</li>
                      <li>4. Sử dụng bình chữa cháy nếu đám nhỏ</li>
                      <li>5. Không sử dụng thang máy</li>
                    </ol>
                  </div>
                  <div className="bg-surface rounded-xl p-6">
                    <Typography variant="title-medium" className="font-semibold text-error mb-3">
                      🏥 Y tế khẩn cấp
                    </Typography>
                    <ol className="space-y-2 text-sm text-on-surface-variant">
                      <li>1. Giữ bình tĩnh, đánh giá tình trạng</li>
                      <li>2. Gọi 115 (Cấp cứu)</li>
                      <li>3. Sơ cứu cơ bản nếu được đào tạo</li>
                      <li>4. Liên hệ quản lý ngay</li>
                      <li>5. Lập biên bản sự việc</li>
                    </ol>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-surface rounded-xl border border-error">
                  <Typography variant="title-small" className="font-semibold text-error mb-2">
                    Số điện thoại khẩn cấp:
                  </Typography>
                  <div className="flex flex-wrap gap-4 text-sm text-on-surface">
                    <span>🔥 Cứu hỏa: <strong>114</strong></span>
                    <span>🚑 Cấp cứu: <strong>115</strong></span>
                    <span>👮 Công an: <strong>113</strong></span>
                    <span>📞 Quản lý: <strong>0988 030 204</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
