'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Link } from '@/navigation';
import { cn } from '@/seed/utils/cn';
import type { SidebarItem } from '../../ui/sidebar';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: SidebarItem[];
}

export function MobileNavDrawer({ isOpen, onClose, items }: MobileNavDrawerProps) {
  const t = useTranslations('stitch.navigation');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('openMobileNav')}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-[#08090D] border-r border-[#222536] flex flex-col h-full shadow-2xl transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
      >
        <div className="h-16 px-5 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-sm font-bold text-white">Sophia AI Factory</span>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={t('closeMobileNav')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

MobileNavDrawer.displayName = 'MobileNavDrawer';
