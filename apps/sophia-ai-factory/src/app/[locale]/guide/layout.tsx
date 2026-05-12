"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  BookOpen, Map, Monitor, HelpCircle, MessageCircle,
  ArrowLeft, Menu, X, Link2, Terminal,
} from "lucide-react";

const GUIDE_SECTIONS = [
  {
    heading: "HƯỚNG DẪN",
    links: [
      { href: "/guide", label: "Bắt Đầu", icon: BookOpen },
      { href: "/guide/how-it-works", label: "Cách Hoạt Động", icon: Map },
      { href: "/guide/screens", label: "Hướng Dẫn Màn Hình", icon: Monitor },
    ],
  },
  {
    heading: "THAM KHẢO",
    links: [
      { href: "/guide/integrations", label: "Tích Hợp", icon: Link2 },
      { href: "/guide/commands", label: "Lệnh Bot", icon: Terminal },
      { href: "/guide/telegram", label: "Telegram Bot", icon: MessageCircle },
      { href: "/guide/faq", label: "Câu Hỏi Thường Gặp", icon: HelpCircle },
    ],
  },
];

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useTranslations("landing");

  // Strip locale prefix for matching
  const cleanPath = pathname.replace(/^\/(en|vi)/, "");

  const isActive = (href: string) =>
    href === "/guide" ? cleanPath === "/guide" : cleanPath === href;

  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-20 left-4 z-40 md:hidden p-2 rounded-lg bg-muted/80 backdrop-blur-sm border border-border/40 text-muted-foreground"
        aria-label={sidebarOpen ? "Đóng menu" : "Mở menu"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen
          ? <X className="w-5 h-5" aria-hidden="true" />
          : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed md:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-64 shrink-0",
          "border-r border-border/40 bg-background/95 backdrop-blur-sm overflow-y-auto",
          "transition-transform md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 space-y-5">
            {/* Back link */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t("guide.back_to_dashboard")}
            </Link>

            {/* Sections */}
            {GUIDE_SECTIONS.map((section) => (
              <div key={section.heading}>
                <div className="px-3 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    {section.heading}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {section.links.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                          active
                            ? "bg-violet-500/10 text-violet-300 border border-violet-500/30 shadow-[0_0_10px_0px_rgba(139,92,246,0.15)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                        )}
                      >
                        <link.icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-400" : "")} aria-hidden="true" />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <main id="main-content" className="flex-1 min-w-0 px-4 md:px-10 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
