"use client";

import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { cn } from '@/seed/utils/cn';
import {
  LayoutDashboard,
  Flag,
  ExternalLink,
  Settings,
  Users,
  LogOut,
  Key,
  KeyRound,
  BarChart3,
  Wallet,
  Tag,
  TrendingUp,
  Calculator,
  Briefcase,
  Bot,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Autonomous Ops", href: "/admin/autonomous", icon: Bot },
  { name: "Enterprise Deals", href: "/admin/deals", icon: Briefcase },
  { name: "Growth Analytics", href: "/admin/growth-analytics", icon: TrendingUp },
  { name: "Unit Economics", href: "/admin/unit-economics", icon: Calculator },
  { name: "System Health", href: "/dashboard/system-health", icon: BarChart3 },
  { name: "Key Rotation", href: "/dashboard/admin/byok-rotation", icon: KeyRound },
  { name: "Monitoring", href: "/dashboard/admin/monitoring", icon: Flag },
  { name: "SOP Reviews", href: "/dashboard/admin/sop-reviews", icon: Key },
  { name: "Handover Console", href: "/admin/handover", icon: ExternalLink },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">
          Sophia Admin
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Internal Dashboard</p>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 p-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={() => {
            void import("@/seed/auth/better-auth-client")
              .then(({ authClient }) => authClient.signOut())
              .finally(() => {
                window.location.href = "/login";
              });
          }}
          className="flex items-center gap-3 px-4 py-3 w-full text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
