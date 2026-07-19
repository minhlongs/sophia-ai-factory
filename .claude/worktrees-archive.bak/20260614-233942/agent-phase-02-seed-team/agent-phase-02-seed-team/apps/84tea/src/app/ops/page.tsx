import Link from "next/link";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OpsPage() {
  const sections = [
    {
      title: "Checklist Hàng Ngày",
      description: "Công việc mở / đóng cửa hàng",
      href: "/ops/checklist",
      icon: "📋",
      color: "bg-secondary-container text-on-secondary-container",
    },
    {
      title: "SOP Vận Hành",
      description: "Quy trình chuẩn đầy đủ",
      href: "/ops/sop",
      icon: "📖",
      color: "bg-primary-container text-on-primary-container",
    },
    {
      title: "Xử Lý Sự Cố",
      description: "Hướng dẫn khắc phục lỗi thường gặp",
      href: "/ops/troubleshoot",
      icon: "🔧",
      color: "bg-error-container text-on-error-container",
    },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <Typography variant="display-medium" className="font-display text-primary mb-4">
              Trung Tâm Vận Hành
            </Typography>
            <Typography variant="body-large" className="text-on-surface-variant">
              Tài liệu hướng dẫn cho đội ngũ nhân viên và đối tác nhượng quyền
            </Typography>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {sections.map((section) => (
              <Link key={section.href} href={section.href} className="block group">
                <Card className="h-full bg-surface-container-low hover:bg-surface-container border-none shadow-sm hover:shadow-md transition-all duration-200">
                  <CardContent className="p-6">
                    <div
                      className={`w-16 h-16 ${section.color} rounded-xl flex items-center justify-center mb-4 text-3xl`}
                    >
                      {section.icon}
                    </div>
                    <Typography variant="title-large" className="font-display text-on-surface mb-2 group-hover:text-primary transition-colors">
                      {section.title}
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      {section.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Stats */}
          <Card className="bg-surface-container-low border-none shadow-sm mb-8">
            <CardContent className="p-8">
              <Typography variant="headline-small" className="font-display text-on-surface mb-6">
                Thông Tin Nhanh
              </Typography>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-surface rounded-xl border border-outline-variant">
                  <Typography variant="headline-medium" className="font-bold text-primary">
                    8:00
                  </Typography>
                  <Typography variant="body-small" className="text-on-surface-variant">
                    Giờ mở cửa
                  </Typography>
                </div>
                <div className="text-center p-4 bg-surface rounded-xl border border-outline-variant">
                  <Typography variant="headline-medium" className="font-bold text-primary">
                    22:00
                  </Typography>
                  <Typography variant="body-small" className="text-on-surface-variant">
                    Giờ đóng cửa
                  </Typography>
                </div>
                <div className="text-center p-4 bg-surface rounded-xl border border-outline-variant">
                  <Typography variant="headline-medium" className="font-bold text-primary">
                    5
                  </Typography>
                  <Typography variant="body-small" className="text-on-surface-variant">
                    Loại trà chính
                  </Typography>
                </div>
                <div className="text-center p-4 bg-surface rounded-xl border border-outline-variant">
                  <Typography variant="headline-medium" className="font-bold text-primary">
                    50+
                  </Typography>
                  <Typography variant="body-small" className="text-on-surface-variant">
                    Ly/ngày target
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <div className="bg-primary rounded-2xl p-8 text-on-primary text-center shadow-lg">
            <Typography variant="headline-small" className="font-display mb-4 text-white">
              Cần Hỗ Trợ?
            </Typography>
            <Typography variant="body-medium" className="text-white/80 mb-6">
              Liên hệ đội ngũ hỗ trợ 24/7 qua các kênh sau
            </Typography>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="tel:0988030204">
                <Button variant="filled" className="bg-white text-primary hover:bg-surface-variant border-none">
                  📞 0988 030 204
                </Button>
              </a>
              <a href="mailto:support@84tea.com">
                <Button variant="outlined" className="border-on-primary text-on-primary hover:bg-on-primary/10 hover:text-on-primary">
                  ✉️ support@84tea.com
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
