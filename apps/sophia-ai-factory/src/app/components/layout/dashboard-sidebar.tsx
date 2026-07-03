"use client";

import { useEffect } from "react";
import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { cn } from "@/seed/utils/cn";
import {
  LayoutDashboard,
  Send,
  PlayCircle,
  BarChart3,
  CreditCard,
  Link2,
  Settings,
  Users,
  FileKey,
  ClipboardList,
  Activity,
  LogOut,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Send },
  { label: "Videos", href: "/dashboard/videos", icon: PlayCircle },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

const managementNav: NavItem[] = [
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Affiliates", href: "/dashboard/affiliates", icon: Link2 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Users", href: "/dashboard/admin/users", icon: Users },
  { label: "Licenses", href: "/dashboard/admin/licenses", icon: FileKey },
  { label: "Audit Log", href: "/dashboard/admin/audit-log", icon: ClipboardList },
  { label: "System Health", href: "/dashboard/admin/system-health", icon: Activity },
];

function NavSection({ items, isAdmin, onNavClick }: { items: NavItem[]; isAdmin?: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const cleanPath = pathname ? pathname.replace(/^\/(en|vi)/, "") || "/" : "/";
    if (href === "/dashboard") return cleanPath === "/dashboard";
    return cleanPath.startsWith(href);
  };

  if (isAdmin === false) return null;

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                "text-sm font-medium",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                active
                  ? "text-white bg-indigo-500/10 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-r-full bg-indigo-500 shadow-[0_0_8px] shadow-indigo-500/40" />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface DashboardSidebarProps {
  isAdmin?: boolean;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({ isAdmin = false, user, mobileOpen = false, onMobileClose }: DashboardSidebarProps) {
  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-900",
          "transition-transform duration-300 ease-in-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Dashboard navigation"
      >
        {/* Logo + Mobile Close */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">Sophia</span>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
            onClick={onMobileClose}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav role="navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Section */}
          <div>
            <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Main
            </p>
            <NavSection items={mainNav} onNavClick={onMobileClose} />
          </div>

          {/* Management Section */}
          <div>
            <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Management
            </p>
            <NavSection items={managementNav} onNavClick={onMobileClose} />
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div>
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Admin
              </p>
              <NavSection items={adminNav} isAdmin={isAdmin} onNavClick={onMobileClose} />
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="flex items-center gap-3 border-t border-zinc-800 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
            {user?.name
              ? user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-white">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {user?.email ?? "user@sophia.app"}
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
