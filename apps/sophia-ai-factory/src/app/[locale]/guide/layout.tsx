"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from '@/seed/utils/cn';
import {
  BookOpen, Map, Monitor, HelpCircle, MessageCircle,
  ArrowLeft, Menu, X, Link2, Terminal,
  Play, Layout, Wallet, Banknote, CreditCard, Users, Lightbulb,
} from "lucide-react";
import GuideSidebarSearch from "./guide-sidebar-search";

type GuideSection = {
  headingKey: string;
  links: { href: string; labelKey: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }> }[];
};

function getGuideSections(): GuideSection[] {
  return [
    {
      headingKey: "getting_started",
      links: [
        { href: "/guide", labelKey: "quick_start", icon: BookOpen },
        { href: "/guide/how-it-works", labelKey: "how_it_works", icon: Map },
        { href: "/guide/screens", labelKey: "screen_guide", icon: Monitor },
      ],
    },
    {
      headingKey: "create_content",
      links: [
        { href: "/guide/first-video", labelKey: "first_video", icon: Play },
        { href: "/guide/templates", labelKey: "templates", icon: Layout },
      ],
    },
    {
      headingKey: "payments",
      links: [
        { href: "/guide/payments/usdt", labelKey: "pay_usdt", icon: Wallet },
        { href: "/guide/payments/vnd", labelKey: "pay_vnd", icon: Banknote },
        { href: "/guide/payments/plans", labelKey: "plans_pricing", icon: CreditCard },
      ],
    },
    {
      headingKey: "affiliate",
      links: [
        { href: "/guide/affiliate", labelKey: "earn_commission", icon: Users },
      ],
    },
    {
      headingKey: "integrations_ref",
      links: [
        { href: "/guide/integrations", labelKey: "integrations", icon: Link2 },
        { href: "/guide/telegram", labelKey: "telegram", icon: MessageCircle },
        { href: "/guide/commands", labelKey: "commands", icon: Terminal },
      ],
    },
    {
      headingKey: "use_cases",
      links: [
        { href: "/guide/use-cases", labelKey: "use_case_library", icon: Lightbulb },
      ],
    },
    {
      headingKey: "help",
      links: [
        { href: "/guide/faq", labelKey: "faq", icon: HelpCircle },
      ],
    },
  ];
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useTranslations("landing");
  const sections = getGuideSections();

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
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-accent-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t("guide.back_to_dashboard")}
            </Link>

            {/* Search + nav links */}
            <GuideSidebarSearch
              sections={sections}
              onLinkClick={() => setSidebarOpen(false)}
            />
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
