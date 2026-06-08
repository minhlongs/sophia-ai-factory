"use client";

import { Link } from "@/navigation";
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

  const isLinkActive = (href: string) => {
    const cleanPath = pathname ? pathname.replace(/^\/(en|vi)/, "") || "/" : "/";
    if (href === "/dashboard") {
      return cleanPath === "/dashboard";
    }
    return cleanPath.startsWith(href);
  };

  return (
    <nav aria-label="Dashboard navigation" className="bg-background/60 backdrop-blur-xl border border-border rounded-2xl mx-4 mb-4 shadow-xl fixed bottom-0 left-0 right-0 z-50 md:hidden p-1">
      <div className="flex items-center justify-around h-12 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = isLinkActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 gap-1 hover:scale-105 active:scale-95 transition-all duration-200 ${
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
