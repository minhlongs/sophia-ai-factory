import { Link } from "@/navigation";
import { Container } from "@/seed/components/ui/container";

const columns = [
  {
    heading: "Sản Phẩm",
    links: [
      { label: "Tính Năng", href: "/#features" },
      { label: "Bảng Giá", href: "/pricing" },
      { label: "RaaS Commands", href: "/guide/commands" },
      { label: "Hướng Dẫn", href: "/guide" },
      { label: "Affiliate", href: "/affiliate-discovery" },
      { label: "Giới Thiệu & Kiếm 70%", href: "/affiliate" },
    ],
  },
  {
    heading: "Công Ty",
    links: [
      { label: "Điều Khoản", href: "/terms" },
      { label: "Bảo Mật", href: "/privacy" },
    ],
  },
  {
    heading: "Liên Hệ",
    links: [
      { label: "support@mekongmind.com", href: "mailto:support@mekongmind.com" },
      { label: "@Sophia_Bbot (Telegram)", href: "https://t.me/Sophia_Bbot" },
      { label: "sophia.agencyos.network", href: "https://sophia.agencyos.network" },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <Container>
        <div className="py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-accent/10">
                  <span className="material-symbols-outlined text-lg text-accent" aria-hidden="true">
                    smart_toy
                  </span>
                </div>
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                  Sophia AI Factory
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-5">
                Video Factory + AI Automation — Một nền tảng để tạo nội dung, tìm lead và tự động hóa quy trình kinh doanh.
              </p>
              {/* Trust badges */}
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-muted-foreground border bg-muted/5 border-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  99.9% Uptime
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-muted-foreground border bg-muted/5 border-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  CF Workers
                </span>
              </div>
            </div>

            {/* Link columns */}
            {columns.map((col) => (
              <div key={col.heading}>
                <h3 className="text-foreground font-semibold text-xs mb-4 tracking-wider uppercase">
                  {col.heading}
                </h3>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-xs">
              &copy; {currentYear} Sophia AI Factory. All rights reserved.
            </p>
            <p className="text-muted-foreground text-xs">
              Powered by{" "}
              <span className="text-accent">Mekong CLI</span>
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
