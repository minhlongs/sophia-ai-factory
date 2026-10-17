import React from 'react';
import { Link } from '@/navigation';
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
        'h-screen fixed left-0 top-0 bg-card dark:bg-[#090A10] text-foreground dark:text-white border-r border-border dark:border-white/[0.08]',
        'flex flex-col p-4 gap-2 z-50 overflow-y-auto',
        'hidden md:flex',
        collapsed ? 'w-[80px]' : 'w-[280px]',
        className
      )}
    >
      {/* Brand Section */}
      <div className={cn('flex items-center gap-3', collapsed ? 'px-2 py-3' : 'px-2 py-3 mb-2')}>
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <span className="text-base text-foreground dark:text-white font-bold truncate block">
              {brandName}
            </span>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              {brandTagline}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3.5 py-2.5 rounded-xl',
              'text-sm transition-all duration-200 border',
              'active:scale-95',
              item.active
                ? 'bg-primary/10 text-primary dark:text-white border-primary/30 font-semibold'
                : 'text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.05] border-transparent'
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
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
        <div className="mt-auto pt-2">
          {upgradeCard}
        </div>
      )}

      {/* User Section */}
      {!collapsed && userSection && (
        <div className="pt-3 border-t border-border dark:border-white/[0.08]">
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
