"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Trang chủ", icon: "home" },
  { href: "/products", label: "Sản phẩm", icon: "inventory_2" },
  { href: "/franchise", label: "Nhượng quyền", icon: "storefront" },
  { href: "/contact", label: "Liên hệ", icon: "mail" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng chính"
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        "bg-surface-container shadow-elevation-3 border-t border-outline-variant",
        "safe-area-inset-bottom" // iOS safe area
      )}
    >
      <div className="flex items-center justify-around h-20 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl min-w-[64px]",
                "transition-all duration-200",
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8"
              )}
            >
              <span
                className={cn(
                  "material-symbols-rounded text-2xl transition-all",
                  isActive && "fill-1"
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
