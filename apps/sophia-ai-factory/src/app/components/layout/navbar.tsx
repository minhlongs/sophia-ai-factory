"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('landing');

  // Strip locale prefix to check current page
  const cleanPath = pathname.replace(/^\/(en|vi)/, '') || '/';
  const isHomePage = cleanPath === '/';

  const navLinks = [
    { label: t('nav.features'), href: isHomePage ? "/#features" : "/pricing" },
    { label: t('nav.pricing'), href: "/pricing" },
    { label: t('nav.guide'), href: "/guide" },
    { label: t('nav.affiliates'), href: "/affiliate-discovery" },
    { label: t('nav.faq'), href: isHomePage ? "/#faq" : "/guide/faq" },
  ];

  // Handle smooth scroll with offset for fixed navbar (only on homepage)
  const handleScrollClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("/#") && isHomePage) {
      e.preventDefault();
      const id = href.slice(2);
      const element = document.getElementById(id);
      if (element) {
        const offset = 80;
        const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };

  return (
    <nav aria-label="Main navigation" className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
              {t('nav.brand')}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleScrollClick(e, link.href)}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-[var(--neon-cyan)]",
                  pathname === link.href || (link.href.startsWith("/#") && pathname === "/" && typeof window !== "undefined" && !window.location.hash)
                    ? "text-[var(--neon-cyan)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login">
              <Button variant="secondary" size="sm">
                {t('nav.login')}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                {t('nav.dashboard')}
              </Button>
            </Link>
            <LanguageSwitcher />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={`md:hidden border-t border-border bg-background/95 backdrop-blur-lg overflow-hidden transition-all duration-200 ease-out ${
          isMobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => {
                handleScrollClick(e, link.href);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "block px-4 py-3 rounded-lg transition-colors hover:text-[var(--neon-cyan)] hover:bg-muted text-base font-medium",
                pathname === link.href ? "text-[var(--neon-cyan)] bg-muted" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block"
            >
              <Button variant="secondary" className="w-full h-12 text-base">
                {t('nav.login')}
              </Button>
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block"
            >
              <Button variant="primary" className="w-full h-12 text-base">
                {t('nav.dashboard')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
