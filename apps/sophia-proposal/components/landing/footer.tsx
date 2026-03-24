import Link from "next/link";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "API Docs", href: "/docs/api" },
      { label: "SDK", href: "/docs/sdk" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Status", href: "/status" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-surface-container-highest to-surface-container border-t border-outline/10">
      <div className="container mx-auto px-4 py-14">
        {/* Logo + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg" aria-hidden="true">
                  smart_toy
                </span>
              </div>
              <span className="font-bold text-on-surface text-base tracking-tight">
                Sophia AI Factory
              </span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mb-5">
              AI-powered Robot-as-a-Service platform for digital agencies. Deploy autonomous missions via API.
            </p>
            {/* Social-style trust badges */}
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-on-surface-variant border border-outline-variant/20">
                <span className="material-symbols-outlined text-xs text-green-500">verified</span>
                SOC 2
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-on-surface-variant border border-outline-variant/20">
                <span className="material-symbols-outlined text-xs text-blue-500">cloud</span>
                CF Workers
              </span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-on-surface font-semibold text-xs mb-4 tracking-wider uppercase">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-on-surface-variant hover:text-primary transition-colors text-sm cursor-pointer"
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
        <div className="border-t border-outline/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-on-surface-variant/60 text-xs">
            &copy; 2026 Sophia AI Factory. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-on-surface-variant/60">
            <Link href="/terms" className="hover:text-on-surface-variant transition-colors cursor-pointer">Terms</Link>
            <Link href="/privacy" className="hover:text-on-surface-variant transition-colors cursor-pointer">Privacy</Link>
            <Link href="/contact" className="hover:text-on-surface-variant transition-colors cursor-pointer">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
