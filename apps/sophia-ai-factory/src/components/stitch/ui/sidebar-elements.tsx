import React from 'react';
import { Link } from '@/navigation';
import { cn } from '@/seed/utils/cn';
import { Badge } from './badge';
import type { SidebarItem } from './sidebar';

export function SidebarBrandHeader({
  brandName,
  brandTagline,
  collapsed,
}: {
  brandName: string;
  brandTagline: string;
  collapsed: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', collapsed ? 'px-2 py-3' : 'px-2 py-3 mb-2')}>
      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center flex-shrink-0 shadow-sm">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
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
  );
}

export function SidebarNavItem({
  item,
  collapsed,
}: {
  item: SidebarItem;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3.5 py-2.5 rounded-xl',
        'text-sm transition-all duration-200 border',
        'active:scale-95',
        item.active
          ? 'bg-primary/10 text-primary dark:text-white border-primary/30 font-semibold'
          : 'text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.05] border-transparent',
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
  );
}
