"use client";

import { useState } from "react";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with form backend (e.g., Formspree, custom API)
    console.log("Form submitted:", formData);
    alert("Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong 24h.");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-16 bg-surface-container-low">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <Typography
              variant="label-large"
              className="text-primary uppercase tracking-[0.3em] mb-4 block"
            >
              Liên Hệ
            </Typography>
            <Typography
              variant="display-medium"
              className="text-on-surface mb-6 font-bold"
            >
              Kết Nối Với <span className="text-primary">84tea</span>
            </Typography>
            <Typography
              variant="body-large"
              className="text-on-surface-variant text-lg max-w-2xl mx-auto"
            >
              Có câu hỏi về sản phẩm, đặt hàng sỉ, hay cơ hội hợp tác? Chúng tôi
              luôn sẵn sàng hỗ trợ bạn.
            </Typography>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16">
              {/* Contact Info */}
              <div className="space-y-12">
                <div>
                  <Typography
                    variant="headline-medium"
                    className="text-primary mb-8 font-bold"
                  >
                    Thông Tin Liên Hệ
                  </Typography>

                  <div className="space-y-6">
                    {[
                      {
                        icon: "📍",
                        title: "Địa chỉ",
                        content:
                          "134 Nguyễn Hoàng Tôn, Phú Thượng, Tây Hồ, Hà Nội",
                      },
                      {
                        icon: "📱",
                        title: "Điện thoại",
                        content: "+84 988 030 204",
                        link: "tel:+84988030204",
                      },
                      {
                        icon: "📧",
                        title: "Email",
                        content: "hello@84tea.com",
                        link: "mailto:hello@84tea.com",
                      },
                      {
                        icon: "⏰",
                        title: "Giờ làm việc",
                        content: "Thứ 2 - Thứ 7: 8:00 - 18:00",
                      },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">{item.icon}</span>
                        </div>
                        <div>
                          <Typography
                            variant="title-medium"
                            className="text-on-surface font-bold mb-1"
                          >
                            {item.title}
                          </Typography>
                          {item.link ? (
                            <a
                              href={item.link}
                              className="text-on-surface-variant hover:text-primary transition-colors block"
                            >
                              <Typography variant="body-medium">
                                {item.content}
                              </Typography>
                            </a>
                          ) : (
                            <Typography
                              variant="body-medium"
                              className="text-on-surface-variant"
                            >
                              {item.content}
                            </Typography>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Links */}
                <div>
                  <Typography
                    variant="title-medium"
                    className="text-on-surface font-bold mb-4"
                  >
                    Theo dõi chúng tôi
                  </Typography>
                  <div className="flex gap-4">
                    {[
                      { icon: "📘", label: "Facebook", href: "#" },
                      { icon: "📸", label: "Instagram", href: "#" },
                      { icon: "🎵", label: "TikTok", href: "#" },
                      { icon: "📺", label: "YouTube", href: "#" },
                    ].map((social) => (
                      <a
                        key={social.label}
                        href={social.href}
                        className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors"
                        title={social.label}
                      >
                        <span className="text-xl">{social.icon}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="p-6 bg-surface-container rounded-2xl border border-outline-variant">
                  <Typography
                    variant="title-medium"
                    className="text-on-surface font-bold mb-4"
                  >
                    Liên kết nhanh
                  </Typography>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Nhượng quyền", href: "/franchise" },
                      { label: "Sản phẩm", href: "/products" },
                      { label: "Về chúng tôi", href: "/about" },
                      { label: "Giao hàng", href: "/shipping" },
                    ].map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-primary hover:text-secondary transition-colors font-medium flex items-center gap-1"
                      >
                        → {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div>
                <Card className="shadow-xl border-none bg-surface">
                  <CardHeader>
                    <CardTitle className="text-primary text-2xl">
                      Gửi Tin Nhắn
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Họ và tên *</Label>
                          <Input
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            placeholder="Nguyễn Văn A"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Số điện thoại</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone: e.target.value,
                              })
                            }
                            placeholder="0912 345 678"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="email@example.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject">Chủ đề</Label>
                        <Select
                          id="subject"
                          value={formData.subject}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              subject: e.target.value,
                            })
                          }
                        >
                          <option value="general">Câu hỏi chung</option>
                          <option value="order">Đặt hàng / Đơn hàng</option>
                          <option value="wholesale">Đặt hàng sỉ</option>
                          <option value="franchise">Nhượng quyền</option>
                          <option value="partnership">
                            Hợp tác kinh doanh
                          </option>
                          <option value="feedback">Góp ý / Phản hồi</option>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Tin nhắn *</Label>
                        <Textarea
                          id="message"
                          required
                          rows={5}
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              message: e.target.value,
                            })
                          }
                          placeholder="Nội dung tin nhắn của bạn..."
                          className="resize-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="filled"
                        size="lg"
                        className="w-full"
                      >
                        Gửi Tin Nhắn
                      </Button>

                      <Typography
                        variant="body-small"
                        className="text-center text-on-surface-variant block"
                      >
                        Chúng tôi sẽ phản hồi trong vòng 24h làm việc
                      </Typography>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section className="py-12 bg-surface-container">
          <div className="max-w-7xl mx-auto px-6">
            <div className="aspect-[21/9] bg-primary-container rounded-3xl flex items-center justify-center border border-outline-variant">
              <div className="text-center">
                <span className="text-6xl mb-4 block">📍</span>
                <Typography
                  variant="body-large"
                  className="text-on-surface-variant"
                >
                  134 Nguyễn Hoàng Tôn, Phú Thượng, Tây Hồ, Hà Nội
                </Typography>
                <a
                  href="https://maps.google.com/?q=134+Nguyen+Hoang+Ton,+Phu+Thuong,+Tay+Ho,+Ha+Noi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-primary hover:text-secondary transition-colors font-medium"
                >
                  Xem trên Google Maps →
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FooterSection />
    </div>
  );
}
