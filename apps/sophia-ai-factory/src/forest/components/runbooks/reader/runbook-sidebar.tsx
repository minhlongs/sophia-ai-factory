import React from 'react';
import Link from 'next/link';
import { Search, Clock, Tag } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import type { RunbookMetadata } from '@/seed/handover/handover-types';
import type { SupportedLocale } from './types';

interface RunbookSidebarProps {
  filteredRunbooks: RunbookMetadata[];
  activeSlug: string;
  activeLocale: SupportedLocale;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  emptySearchText: string;
  readTimeLabel: string;
}

export function RunbookSidebar({
  filteredRunbooks,
  activeSlug,
  activeLocale,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  emptySearchText,
  readTimeLabel,
}: RunbookSidebarProps) {
  return (
    <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-8">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-background border border-border focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <Card className="p-3 border-border/60 bg-card overflow-hidden">
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {filteredRunbooks.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {emptySearchText}
            </div>
          ) : (
            filteredRunbooks.map((r) => {
              const isActive = r.slug === activeSlug;
              const title = activeLocale === 'vi' ? r.titleVi : r.titleEn;

              return (
                <Link
                  key={r.id}
                  href={`/dashboard/docs/runbooks/${r.slug}`}
                  className={cn(
                    'block p-3 rounded-lg border transition-all text-left',
                    isActive
                      ? 'bg-primary/10 border-primary/40 text-foreground font-semibold shadow-xs'
                      : 'bg-background hover:bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                      #{r.number}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {r.readTimeMinutes} {readTimeLabel}
                    </span>
                  </div>
                  <div className="text-xs font-semibold line-clamp-1">
                    {title}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-primary/70" />
                    <span className="truncate">{r.category}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
