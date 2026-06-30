'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, BarChart2, Coins, Database, Inbox, KeyRound, ServerCog, Webhook } from 'lucide-react';

export interface PanelRow {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}

interface AdminStatsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  rows: PanelRow[];
}

export default function AdminStatsCard({ icon: Icon, title, href, rows }: AdminStatsCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-card p-5 hover:border-foreground/40 transition"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary-400" aria-hidden="true" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">drill in →</span>
      </header>
      <dl className="space-y-1.5">
        {rows.map(({ label, value, tone }) => (
          <div key={label} className="flex items-baseline justify-between text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
              className={`font-mono font-medium ${
                tone === 'bad'
                  ? 'text-red-300'
                  : tone === 'warn'
                  ? 'text-amber-300'
                  : 'text-foreground'
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
