import Link from "next/link";
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
      { label: "support@agencyos.network", href: "mailto:support@agencyos.network" },
      { label: "@Sophia_Bbot (Telegram)", href: "https://t.me/Sophia_Bbot" },
      { label: "sophia.agencyos.network", href: "https://sophia.agencyos.network" },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t"
      style={{
        background: "linear-gradient(to bottom, #0a0f1a, var(--background))",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Container>
        <div className="py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(0,240,255,0.1)" }}
                >
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ color: "var(--neon-cyan)" }}
                    aria-hidden="true"
                  >
                    smart_toy
                  </span>
                </div>
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                  Sophia AI Factory
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-5">
                Video Factory + AI Automation — Một nền tảng để tạo nội dung, tìm lead và tự động hóa quy trình kinh doanh.
              </p>
              {/* Trust badges */}
              <div className="flex gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-muted-foreground border"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  99.9% Uptime
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-muted-foreground border"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--neon-cyan)" }} />
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
                        style={{ ["--hover-color" as string]: "var(--neon-cyan)" }}
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
          <div
            className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <p className="text-muted-foreground/60 text-xs">
              &copy; {currentYear} Sophia AI Factory. All rights reserved.
            </p>
            <p className="text-muted-foreground/60 text-xs">
              Powered by{" "}
              <span style={{ color: "var(--neon-cyan)" }}>Mekong CLI</span>
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
