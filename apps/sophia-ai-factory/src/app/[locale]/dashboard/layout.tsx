import React from "react";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Video,
  LogOut,
  BarChart2,
  HelpCircle,
  Code
} from "lucide-react";
import { HealthIndicator } from "@/components/dashboard/health-indicator";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('dashboard');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
              {t('header.brand')}
            </span>
          </Link>
        </div>

        <nav aria-label="Dashboard sidebar" className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.overview')}</span>
          </Link>
          <Link
            href="/dashboard/create"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.new_project')}</span>
          </Link>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.campaigns')}</span>
          </Link>
          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <BarChart2 className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.analytics')}</span>
          </Link>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Video className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.my_videos')}</span>
          </Link>
          <Link
            href="/dashboard/support"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.support')}</span>
          </Link>
          <Link
            href="/dashboard/api-docs"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Code className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.api_docs')}</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.settings')}</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <HealthIndicator />
          <button className="flex items-center gap-3 px-4 py-3 text-destructive rounded-lg hover:bg-destructive/10 transition-colors w-full">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.sign_out')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header (visible only on small screens) */}
        <header className="h-16 bg-card border-b border-border md:hidden flex items-center justify-between px-4">
          <span className="font-bold text-lg text-foreground">{t('header.title')}</span>
          <ThemeToggle />
        </header>

        <main id="main-content" className="flex-1 p-6 md:p-8 overflow-y-auto pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
