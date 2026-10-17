'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';
import { Sparkles, Globe, Menu, X, ArrowRight } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

export interface MarketingNavProps {
  className?: string;
}

export function MarketingNav({ className }: MarketingNavProps) {
  const t = useTranslations('landing.nav');
  const tStitch = useTranslations('stitch.landing');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  const navLinks = [
    { href: '/features', label: t('features') },
    { href: '/pricing', label: t('pricing') },
    { href: '/guide', label: t('guide') },
    { href: '/affiliates', label: t('affiliates') },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        'bg-background/85 dark:bg-[#090A10]/85 studio-glass backdrop-blur-xl border-b border-border dark:border-white/[0.08]',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-foreground dark:text-white flex items-center gap-1.5">
              Sophia
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/25">
                AI Factory
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/60 dark:bg-[#11131F]/90 border border-border dark:border-white/[0.08] rounded-full px-4 py-1.5 backdrop-blur-md">
          {navLinks.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-white hover:bg-background/80 dark:hover:bg-white/[0.06]'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions (Language + Auth) */}
        <div className="hidden md:flex items-center gap-4">
          {/* Language Switcher Pill */}
          <button
            type="button"
            onClick={switchLocale}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] hover:bg-muted dark:hover:bg-white/[0.08] border border-border dark:border-white/[0.08] transition-all"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="uppercase tracking-wider">{locale === 'en' ? 'VI' : 'EN'}</span>
          </button>

          {/* Login Button */}
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-white px-3 py-2 transition-colors"
          >
            {t('login')}
          </Link>

          {/* Get Started CTA */}
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 text-sm font-bold text-primary-foreground px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 border border-primary/25 shadow-sm transition-all active:scale-[0.98]"
          >
            <span>{tStitch('nav.getStarted')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={switchLocale}
            className="p-2 rounded-lg text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] text-xs font-mono font-bold uppercase"
          >
            {locale === 'en' ? 'VI' : 'EN'}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08]"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-card/95 dark:bg-[#090A10]/95 border-b border-border dark:border-white/[0.08] px-6 py-6 space-y-4 backdrop-blur-2xl">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-xl text-base font-medium text-foreground dark:text-slate-200 hover:text-primary dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.05]"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-4 border-t border-border dark:border-white/[0.08] flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl text-foreground dark:text-slate-200 bg-muted/60 dark:bg-white/[0.05] border border-border dark:border-white/[0.08] text-sm font-semibold"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm"
            >
              {tStitch('nav.getStarted')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
