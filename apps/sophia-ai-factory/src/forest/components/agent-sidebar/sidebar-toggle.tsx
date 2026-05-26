/**
 * Sidebar Toggle — floating button when sidebar is collapsed
 *
 * Visible as a floating icon in bottom-right corner when sidebar is closed.
 *
 * @module components/agent-sidebar/sidebar-toggle
 */

'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SidebarToggleProps {
  onClick: () => void;
}

export function SidebarToggle({ onClick }: SidebarToggleProps) {
  const t = useTranslations('agentChat');

  return (
    <button
      onClick={onClick}
      aria-label={t('expand')}
      className="fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-110 active:scale-95 transition-all duration-200 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] md:bottom-8 md:right-8"
    >
      <Bot className="h-5 w-5" />
    </button>
  );
}
