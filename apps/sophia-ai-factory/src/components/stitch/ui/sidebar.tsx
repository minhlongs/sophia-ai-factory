import React from 'react';
import { cn } from '@/seed/utils/cn';
import { LucideIcon } from 'lucide-react';
import { SidebarBrandHeader, SidebarNavItem } from './sidebar-elements';

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
        className,
      )}
    >
      <SidebarBrandHeader
        brandName={brandName}
        brandTagline={brandTagline}
        collapsed={collapsed}
      />

      <nav className="flex flex-col gap-1 flex-1">
        {items.map((item) => (
          <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && upgradeCard && <div className="mt-auto pt-2">{upgradeCard}</div>}

      {!collapsed && userSection && (
        <div className="pt-3 border-t border-border dark:border-white/[0.08]">
          {userSection}
        </div>
      )}

      {collapsed && userSection && <div className="mt-auto">{userSection}</div>}
    </aside>
  );
}

Sidebar.displayName = 'Sidebar';
