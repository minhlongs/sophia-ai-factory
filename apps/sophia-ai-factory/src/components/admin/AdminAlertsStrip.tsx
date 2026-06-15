'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

interface Alert {
  severity: 'bad' | 'warn';
  label: string;
  href: string;
}

interface AdminAlertsStripProps {
  alerts: Alert[];
}

export default function AdminAlertsStrip({ alerts }: AdminAlertsStripProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        All clear. No active alerts across crons, email, webhooks, or storage.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
      <h2 className="text-sm font-medium text-amber-200 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        Active alerts ({alerts.length})
      </h2>
      <ul className="flex flex-wrap gap-2">
        {alerts.map((a) => (
          <li key={`${a.label}-${a.href}`}>
            <Link
              href={a.href}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                a.severity === 'bad'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              }`}
            >
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
