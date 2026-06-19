import React from 'react';
import Link from 'next/link';
import { cn } from '@/seed/utils/cn';
import { LucideIcon } from 'lucide-react';
import { Badge } from './badge';

export interface SidebarItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: LucideIcon;
  /** Link destination */
  href: string;
  /** Whether item is active */
  active?: boolean;
  /** Badge content (e.g., notification count) */
  badge?: string | number;
}

export interface SidebarProps {
  /** Navigation items */
  items: SidebarItem[];
  /** Brand name/logo */
  brandName?: string;
  /** Brand tagline */
  brandTagline?: string;
  /** User section at bottom */
  userSection?: React.ReactNode;
  /** Upgrade/promo card at bottom */
  upgradeCard?: React.ReactNode;
  /** Collapsed state */
  collapsed?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Stitch-compatible Sidebar component
 *
 * Material Design 3 navigation drawer with Sophia theme.
 */
export function Sidebar({
  items,
  brandName = 'Sophia AI',
  brandTagline = 'Revenue Automation',
  userSection,
  upgradeCard,
  collapsed = false,
  className = '',
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'h-screen fixed left-0 top-0 bg-surface-container-lowest border-r border-outline-variant',
        'flex flex-col p-md gap-sm z-50 overflow-y-auto',
        collapsed ? 'w-[80px]' : 'w-[280px]',
        className
      )}
    >
      {/* Brand Section */}
      <div className={cn('flex items-center gap-md', collapsed ? 'px-sm py-md' : 'px-sm py-md mb-md')}>
        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary flex-shrink-0">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold truncate">
              {brandName}
            </h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {brandTagline}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-xs flex-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-md px-md py-sm rounded-xl',
              'font-body-md text-body-md transition-all duration-200',
              'active:scale-95',
              item.active
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="material-symbols-outlined text-[20px] flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <Badge variant="soft" color="error" size="sm">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </Link>
        ))}
      </nav>

      {/* Upgrade Card */}
      {!collapsed && upgradeCard && (
        <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant">
          {upgradeCard}
        </div>
      )}

      {/* User Section */}
      {!collapsed && userSection && (
        <div className="mt-auto pt-md border-t border-outline-variant">
          {userSection}
        </div>
      )}

      {/* Collapsed user icon */}
      {collapsed && userSection && (
        <div className="mt-auto">
          {userSection}
        </div>
      )}
    </aside>
  );
}

Sidebar.displayName = 'Sidebar';
