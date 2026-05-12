"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, X, BookOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const helpLinks = [
  { href: "/guide", label: "User Guide", icon: BookOpen },
  { href: "/guide/faq", label: "FAQ", icon: HelpCircle },
  { href: "/guide/telegram", label: "Telegram Bot", icon: MessageCircle },
];

export function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Help panel */}
      {isOpen && (
        <div id="help-panel" role="menu" aria-label="Help and guides" className="absolute bottom-14 right-0 w-56 rounded-xl border border-border/40 bg-background/95 backdrop-blur-lg shadow-2xl p-3 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Help & Guides
          </div>
          {helpLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/5 transition-colors"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
          isOpen
            ? "bg-muted text-foreground rotate-90"
            : "bg-[var(--neon-cyan)] text-black hover:scale-110 hover:shadow-[0_0_20px_var(--neon-cyan)]"
        )}
        aria-label={isOpen ? "Close help menu" : "Open help menu"}
        aria-expanded={isOpen}
        aria-controls="help-panel"
      >
        {isOpen ? <X className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
