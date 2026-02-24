"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { BookOpen, Map, Monitor, HelpCircle, MessageCircle, ArrowLeft, Menu, X, Link2, Terminal } from "lucide-react";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useTranslations('landing');

  // Strip locale prefix for matching
  const cleanPath = pathname.replace(/^\/(en|vi)/, "");

  const sidebarLinks = [
    { href: "/guide", label: t('guide.sidebar.getting_started'), icon: BookOpen },
    { href: "/guide/how-it-works", label: t('guide.sidebar.how_it_works'), icon: Map },
    { href: "/guide/screens", label: t('guide.sidebar.screen_guide'), icon: Monitor },
    { href: "/guide/integrations", label: t('guide.sidebar.integrations'), icon: Link2 },
    { href: "/guide/commands", label: t('guide.sidebar.commands'), icon: Terminal },
    { href: "/guide/faq", label: t('guide.sidebar.faq'), icon: HelpCircle },
    { href: "/guide/telegram", label: t('guide.sidebar.telegram'), icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-20 left-4 z-40 md:hidden p-2 rounded-lg bg-muted/80 backdrop-blur-sm border border-border/40 text-muted-foreground"
        aria-label={sidebarOpen ? "Close guide menu" : "Open guide menu"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed md:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border/40 bg-background/95 backdrop-blur-sm overflow-y-auto transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('guide.back_to_dashboard')}
            </Link>

            <div className="px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t('guide.title')}
              </h2>
            </div>

            {sidebarLinks.map((link) => {
              const isActive = cleanPath === link.href || (link.href === "/guide" && cleanPath === "/guide");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <link.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-8 md:ml-0">
          {children}
        </main>
      </div>
    </div>
  );
}
