"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("landing");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Check Better Auth session cookie (or legacy auth-token)
    setIsLoggedIn(
      document.cookie.includes('better-auth.session_token=')
      || document.cookie.includes('auth-token='),
    );
  }, [pathname]);

  const cleanPath = pathname.replace(/^\/(en|vi)/, "") || "/";
  const isHomePage = cleanPath === "/";
  const isDashboard = cleanPath.startsWith("/dashboard");

  // Hide public navbar on dashboard pages (dashboard has its own sidebar nav)
  if (isDashboard) return null;

  const navLinks = [
    { label: t("nav.raas"), href: isHomePage ? "/#raas" : "/guide/commands" },
    { label: t("nav.features"), href: isHomePage ? "/#features" : "/pricing" },
    { label: t("nav.pricing"), href: "/pricing" },
    { label: t("nav.guide"), href: "/guide" },
    { label: t("nav.affiliates"), href: "/affiliate-discovery" },
  ];

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
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed z-50 transition-all duration-500",
        scrolled
          ? "top-3 left-4 right-4 backdrop-blur-xl rounded-2xl shadow-lg border"
          : "top-0 left-0 right-0 bg-transparent"
      )}
      style={
        scrolled
          ? {
              background: "rgba(2,8,23,0.85)",
              borderColor: "rgba(255,255,255,0.08)",
            }
          : undefined
      }
    >
      <div className="mx-auto px-5 h-14 flex items-center justify-between max-w-7xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{ background: "rgba(0,240,255,0.1)" }}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: "var(--neon-cyan)" }}
              aria-hidden="true"
            >
              smart_toy
            </span>
          </div>
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
            {t("nav.brand")}
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => handleScrollClick(e, link.href)}
              className="px-4 py-1.5 rounded-full transition-all text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {!isLoggedIn && (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t("nav.login")}
              </Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button variant="primary" size="sm" className="rounded-full px-5">
              {t("nav.dashboard")}
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-xl transition-colors text-muted-foreground hover:text-foreground hover:bg-white/5"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-5 py-5 flex flex-col gap-3 rounded-b-2xl"
          style={{
            background: "rgba(2,8,23,0.97)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors text-base font-medium py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1" onClick={() => setMenuOpen(false)}>
              <Button variant="outline" size="sm" className="w-full rounded-full">
                {t("nav.login")}
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1" onClick={() => setMenuOpen(false)}>
              <Button variant="primary" size="sm" className="w-full rounded-full">
                {t("nav.dashboard")}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
