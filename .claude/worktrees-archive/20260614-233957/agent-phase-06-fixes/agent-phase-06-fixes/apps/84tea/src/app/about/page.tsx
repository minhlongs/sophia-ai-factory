import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const values = [
  {
    icon: "🌿",
    title: "Nguồn Gốc Thiên Nhiên",
    description:
      "Tất cả sản phẩm đều từ cây trà cổ thụ Shan Tuyết 100+ năm tuổi, trồng tại vùng cao 1,500m tại Việt Nam.",
  },
  {
    icon: "🔬",
    title: "Lên Men Truyền Thống",
    description:
      "Quy trình lên men độc quyền bảo tồn probiotics tự nhiên và tối đa hóa lợi ích sức khỏe.",
  },
  {
    icon: "⚡",
    title: "Năng Lượng Bền Vững",
    description:
      "Cung cấp năng lượng ổn định suốt ngày dài mà không gây hồi hộp như cà phê.",
  },
  {
    icon: "🎯",
    title: "Định Vị Premium",
    description:
      "Mỗi sản phẩm là tác phẩm nghệ thuật, được đóng gói cao cấp xứng đáng với giá trị bên trong.",
  },
];

const timeline = [
  {
    year: "2020",
    title: "Khám Phá",
    description: "Tìm ra vùng trà cổ thụ Shan Tuyết tại vùng cao Tây Bắc",
  },
  {
    year: "2022",
    title: "Nghiên Cứu",
    description: "Phát triển quy trình lên men độc quyền với các chuyên gia",
  },
  {
    year: "2024",
    title: "Ra Mắt",
    description: "3704 Co., LTD chính thức thành lập, thương hiệu 84tea ra đời",
  },
  {
    year: "2026",
    title: "Mở Rộng",
    description: "Nhượng quyền phòng trà và mở rộng thị trường quốc tế",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <Typography
              variant="label-large"
              className="text-primary uppercase tracking-[0.3em] mb-4 block"
            >
              Về Chúng Tôi
            </Typography>
            <Typography
              variant="display-medium"
              className="text-on-surface mb-6 font-bold"
            >
              Câu Chuyện <span className="text-primary">84tea</span>
            </Typography>
            <Typography
              variant="body-large"
              className="text-on-surface-variant text-lg max-w-2xl mx-auto"
            >
              Mang tinh hoa trà Việt Nam đến với thế giới, kết hợp truyền thống
              trăm năm với công nghệ lên men hiện đại.
            </Typography>
          </div>
        </section>

        {/* Vision Section */}
        <section className="py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <Typography
                  variant="label-large"
                  className="text-secondary uppercase tracking-[0.3em] mb-4 block"
                >
                  Tầm Nhìn
                </Typography>
                <Typography
                  variant="headline-medium"
                  className="text-primary mb-6 font-bold"
                >
                  Trà Năng Lượng Việt
                </Typography>
                <Typography
                  variant="body-large"
                  className="text-on-surface-variant text-lg mb-6"
                >
                  84tea không chỉ là thương hiệu trà - đó là sứ mệnh mang văn
                  hóa trà Việt Nam ra thế giới. Chúng tôi tin rằng trà cổ thụ
                  Shan Tuyết của Việt Nam xứng đáng được công nhận như những
                  loại trà danh tiếng nhất châu Á.
                </Typography>
                <Typography
                  variant="body-large"
                  className="text-on-surface-variant text-lg"
                >
                  Với quy trình lên men độc quyền, chúng tôi tạo ra những sản
                  phẩm trà không chỉ ngon mà còn mang lại lợi ích sức khỏe vượt
                  trội - đúng như tinh thần &quot;Trà Năng Lượng Việt&quot;.
                </Typography>
              </div>
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-primary to-primary-container rounded-3xl flex items-center justify-center shadow-lg">
                  <span className="text-9xl">🍵</span>
                </div>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary-container rounded-2xl flex items-center justify-center shadow-lg border-4 border-surface">
                  <span className="text-5xl">🌿</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-24 bg-surface-container">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <Typography
                variant="label-large"
                className="text-secondary uppercase tracking-[0.3em] mb-4 block"
              >
                Giá Trị Cốt Lõi
              </Typography>
              <Typography
                variant="headline-medium"
                className="text-primary font-bold"
              >
                Điều Chúng Tôi Tin Tưởng
              </Typography>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, idx) => (
                <Card
                  key={idx}
                  className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-none shadow-md"
                >
                  <CardContent className="pt-8">
                    <span className="text-5xl mb-4 block">{value.icon}</span>
                    <Typography
                      variant="title-medium"
                      className="text-on-surface font-bold mb-2"
                    >
                      {value.title}
                    </Typography>
                    <Typography
                      variant="body-medium"
                      className="text-on-surface-variant"
                    >
                      {value.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-24 bg-primary text-on-primary">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <Typography
                variant="label-large"
                className="text-secondary-container uppercase tracking-[0.3em] mb-4 block"
              >
                Hành Trình
              </Typography>
              <Typography
                variant="headline-medium"
                className="text-on-primary font-bold"
              >
                Từ Ý Tưởng Đến Thương Hiệu
              </Typography>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {timeline.map((item, idx) => (
                <div key={idx} className="text-center group">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center transition-transform group-hover:scale-110">
                    <Typography variant="title-large" className="font-bold">
                      {item.year}
                    </Typography>
                  </div>
                  <Typography
                    variant="title-medium"
                    className="text-on-primary font-bold mb-2"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body-medium"
                    className="text-primary-container"
                  >
                    {item.description}
                  </Typography>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Company Info */}
        <section className="py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16">
              <div>
                <Typography
                  variant="label-large"
                  className="text-secondary uppercase tracking-[0.3em] mb-4 block"
                >
                  Thông Tin Công Ty
                </Typography>
                <Typography
                  variant="headline-medium"
                  className="text-primary mb-6 font-bold"
                >
                  3704 Co., LTD
                </Typography>
                <div className="space-y-4">
                  {[
                    { label: "GPKD", value: "011 070 44 89" },
                    { label: "Thành lập", value: "04/05/2024" },
                    { label: "Người sáng lập", value: "Lương Tuấn Anh" },
                    {
                      label: "Địa chỉ",
                      value: "134 Nguyễn Hoàng Tôn, Phú Thượng, Hà Nội",
                    },
                  ].map((item) => (
                    <Typography
                      key={item.label}
                      variant="body-large"
                      className="text-on-surface-variant flex gap-2"
                    >
                      <span className="font-bold text-on-surface">
                        {item.label}:
                      </span>
                      {item.value}
                    </Typography>
                  ))}
                </div>
              </div>
              <div>
                <Typography
                  variant="label-large"
                  className="text-secondary uppercase tracking-[0.3em] mb-4 block"
                >
                  Đối Tác OEM
                </Typography>
                <Typography
                  variant="headline-medium"
                  className="text-primary mb-6 font-bold"
                >
                  tralenmen.vn
                </Typography>
                <Typography
                  variant="body-large"
                  className="text-on-surface-variant mb-4"
                >
                  Đối tác sản xuất chính thức của dòng sản phẩm 84 Limited.
                  Chuyên gia hàng đầu về trà lên men cổ thụ Shan Tuyết tại Việt
                  Nam.
                </Typography>
                <a
                  href="https://tralenmen.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-secondary transition-colors font-bold"
                >
                  Tìm hiểu thêm →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-secondary-container border-y border-secondary">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <Typography
              variant="headline-medium"
              className="text-on-surface mb-6 font-bold"
            >
              Sẵn Sàng Trải Nghiệm?
            </Typography>
            <Typography
              variant="body-large"
              className="text-on-surface-variant text-lg mb-8 max-w-2xl mx-auto"
            >
              Khám phá bộ sưu tập trà cao cấp của chúng tôi hoặc tìm hiểu cơ hội
              nhượng quyền phòng trà 84tea.
            </Typography>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <Button variant="filled" size="lg" className="w-full sm:w-auto">
                  Xem sản phẩm →
                </Button>
              </Link>
              <Link href="/franchise">
                <Button
                  variant="outlined"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Nhượng quyền
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <FooterSection />
    </div>
  );
}
