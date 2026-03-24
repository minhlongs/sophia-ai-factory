import Link from "next/link";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "API Docs", href: "/docs/api" },
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
    heading: "Support",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-surface-container-highest border-t border-outline/20">
      <div className="container mx-auto px-4 py-12">
        {/* Logo + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="material-symbols-outlined text-primary text-xl"
                aria-hidden="true"
              >
                smart_toy
              </span>
              <span className="font-semibold text-on-surface text-base tracking-tight">
                Sophia AI Factory
              </span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs">
              AI-powered RaaS platform for digital agencies. Close more deals, faster.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-on-surface font-semibold text-sm mb-4 tracking-wide uppercase">
                {col.heading}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-on-surface-variant hover:text-on-surface transition-colors text-sm cursor-pointer"
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
        <div className="border-t border-outline/20 pt-6 text-center">
          <p className="text-on-surface-variant text-sm">
            &copy; 2026 Sophia AI Factory. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
