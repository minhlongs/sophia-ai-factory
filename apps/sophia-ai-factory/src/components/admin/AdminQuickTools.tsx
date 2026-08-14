'use client';

import React from 'react';
import Link from 'next/link';

interface QuickLink {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  label: string;
}

interface AdminQuickToolsProps {
  links: QuickLink[];
}

export default function AdminQuickTools({ links }: AdminQuickToolsProps) {
  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Quick tools
      </h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-foreground/40 transition"
          >
            <link.icon className="w-4 h-4 text-primary-400" aria-hidden="true" />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
