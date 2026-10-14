'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import type { HelpPageProps } from './types';
import { SopsView } from './sops-view';
import { TroubleshootingView } from './troubleshooting-view';
import { FaqView } from './faq-view';

export function HelpPageView({ locale, data, pageTitle, pageSubtitle, type }: HelpPageProps) {
  const isVi = locale.startsWith('vi');

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {isVi ? 'Trung Tâm Trợ Giúp' : 'Help Center'}
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/30">
            <HelpCircle className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {type === 'sops' && <SopsView data={data} isVi={isVi} />}
      {type === 'troubleshooting' && <TroubleshootingView data={data} isVi={isVi} />}
      {type === 'faq' && <FaqView data={data} isVi={isVi} />}
    </div>
  );
}
