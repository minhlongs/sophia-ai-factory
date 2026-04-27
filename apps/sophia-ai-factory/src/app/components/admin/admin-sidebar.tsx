"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Flag,
  ExternalLink,
  Settings,
  Users,
  LogOut,
  Key,
  BarChart3,
  Activity,
  Wallet
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Monitoring", href: "/admin/monitoring", icon: Activity },
  { name: "Analytics", href: "/admin/analytics/usage", icon: BarChart3 },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Licenses", href: "/admin/licenses", icon: Key },
  { name: "Payouts", href: "/admin/payouts", icon: Wallet },
  { name: "Feature Flags", href: "/admin/features", icon: Flag },
  { name: "Affiliates", href: "/admin/affiliates", icon: ExternalLink },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
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
                      ? "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30"
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
          onClick={() => {
            // Clear auth and reload
            window.location.href = "/";
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
