"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  BarChart2,
  HelpCircle,
  Settings,
} from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/dashboard/support", label: "Support", icon: HelpCircle },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  const isLinkActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname?.startsWith(href);

  return (
    <nav aria-label="Dashboard navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = isLinkActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
