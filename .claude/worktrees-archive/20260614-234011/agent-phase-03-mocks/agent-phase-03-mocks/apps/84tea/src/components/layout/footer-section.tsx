import Link from "next/link";
import { Typography } from "@/components/ui/typography";
import { Logo } from "@/components/ui/logo";

const footerLinks = {
  products: [
    { href: "/products", label: "Tất cả sản phẩm" },
    { href: "/products/tra-shan-6", label: "84 Limited Collection" },
    { href: "/products/tra-luc-80", label: "Trà xanh" },
  ],
  company: [
    { href: "/about", label: "Về chúng tôi" },
    { href: "/franchise", label: "Nhượng quyền" },
    { href: "/contact", label: "Liên hệ" },
  ],
  legal: [
    { href: "/terms", label: "Điều khoản" },
    { href: "/privacy", label: "Chính sách bảo mật" },
    { href: "/shipping", label: "Giao hàng" },
  ],
};

export function FooterSection() {
  return (
    <footer className="bg-inverse-surface text-inverse-on-surface py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Logo variant="light" />
            </div>
            <Typography variant="body-medium" className="text-inverse-on-surface mb-4">
              Premium Vietnamese tea brand featuring the 84 Limited collection -
              fermented tea from ancient Shan Tuyết trees.
            </Typography>
            <Typography
              variant="title-medium"
              className="text-secondary-container font-display"
            >
              Trà Năng Lượng Việt
            </Typography>
          </div>

          {/* Products */}
          <div>
            <Typography variant="title-medium" className="text-primary-container font-semibold mb-4">
              Sản phẩm
            </Typography>
            <ul className="space-y-2">
              {footerLinks.products.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-inverse-on-surface hover:text-primary-container transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <Typography variant="title-medium" className="text-primary-container font-semibold mb-4">
              Công ty
            </Typography>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-inverse-on-surface hover:text-primary-container transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <Typography variant="title-medium" className="text-primary-container font-semibold mb-4">
              Liên hệ
            </Typography>
            <ul className="space-y-2 text-inverse-on-surface text-sm mb-6">
              <li>📧 hello@84tea.com</li>
              <li>📱 +84 988 030204</li>
              <li>📍 Hà Nội, Vietnam</li>
            </ul>
            <Typography variant="title-small" className="text-primary-container font-semibold mb-2">
              Pháp lý
            </Typography>
            <ul className="space-y-1">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-inverse-on-surface hover:text-primary-container transition-colors text-xs"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-outline-variant mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-inverse-on-surface text-sm">
            © 2026 84tea. Powered by 3704 Co., LTD.
          </p>
          <p className="text-inverse-on-surface text-sm">
            Made with ❤️ in Vietnam
          </p>
        </div>
      </div>
    </footer>
  );
}
