"use client";

import { useState, useEffect } from "react";
import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/seed/components/ui/button";
import { cn } from '@/seed/utils/cn';
import { LanguageSwitcher } from "@/forest/components/language-switcher";
import { TrendingUp } from "lucide-react";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("landing");
  const tAff = useTranslations("affiliate");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function syncSessionState() {
      try {
        const res = await fetch("/api/auth/session", {
          credentials: "include",
          signal: controller.signal,
        });
        setIsLoggedIn(res.ok);
      } catch (err) {
        if (!controller.signal.aborted) {
          setIsLoggedIn(false);
        }
      }
    }

    void syncSessionState();
    return () => controller.abort();
  }, [pathname]);

  const cleanPath = (pathname ?? "").replace(/^\/(en|vi)/, "") || "/";
  const isHomePage = cleanPath === "/";
  const isDashboard = cleanPath.startsWith("/dashboard");

  // Hide public navbar on dashboard pages (dashboard has its own sidebar nav)
  if (isDashboard) return null;

  // Smart referral link: logged-in users go to dashboard affiliate, guests to discovery page
  const referEarnHref = isLoggedIn ? "/dashboard/affiliate" : "/affiliate-discovery";

  const navLinks = [
    { label: t("nav.raas"), href: isHomePage ? "/#raas" : "/guide/commands" },
    { label: t("nav.features"), href: isHomePage ? "/#features" : "/pricing" },
    { label: t("nav.pricing"), href: "/pricing" },
    { label: t("nav.guide"), href: "/guide" },
    { label: tAff("refer_earn_nav"), href: referEarnHref, highlight: true },
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
          ? "top-3 left-4 right-4 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] border"
          : "top-0 left-0 right-0 bg-transparent"
      )}
      style={
        scrolled
          ? {
              background: "rgba(9, 9, 11, 0.4)",
              borderColor: "rgba(255, 255, 255, 0.06)",
            }
          : undefined
      }
    >
      <div className="mx-auto px-5 h-14 flex items-center justify-between max-w-7xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group hover:scale-105 active:scale-95 transition-transform duration-200">
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
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              onClick={(e) => handleScrollClick(e, link.href)}
              className={cn(
                "px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium hover:scale-105 active:scale-95 hover:translate-x-0.5 inline-flex items-center",
                link.highlight
                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 flex items-center gap-1.5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {link.highlight && <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
              {link.label}
            </Link>
          ))}
        </div>

 {/* Desktop CTA */}
 <div className="hidden lg:flex items-center gap-3">
   <LanguageSwitcher />
   {isLoggedIn ? (
     <Link href="/dashboard">
       <Button variant="primary" size="sm" className="rounded-full px-5 hover:scale-105 active:scale-95 transition-all duration-200">
         {t("nav.dashboard")}
       </Button>
     </Link>
   ) : (
     <>
       <Link href="/login">
         <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-200">
           {t("nav.login")}
         </Button>
       </Link>
       <Link href="/dashboard">
         <Button variant="primary" size="sm" className="rounded-full px-5 hover:scale-105 active:scale-95 transition-all duration-200">
           {t("nav.dashboard")}
         </Button>
       </Link>
     </>
   )}
 </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 rounded-xl transition-colors text-muted-foreground hover:text-foreground hover:bg-white/5"
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
          className="lg:hidden border-t px-5 py-5 flex flex-col gap-3 rounded-b-2xl"
          style={{
            background: "rgba(2,8,23,0.97)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors text-base font-medium py-2"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center justify-between pt-2 pb-1">
            <LanguageSwitcher />
          </div>
 <div className="flex gap-3">
   {isLoggedIn ? (
     <Link href="/dashboard" className="flex-1" onClick={() => setMenuOpen(false)}>
       <Button variant="primary" size="sm" className="w-full rounded-full">
         {t("nav.dashboard")}
       </Button>
     </Link>
   ) : (
     <>
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
     </>
   )}
 </div>
        </div>
      )}
    </nav>
  );
}
