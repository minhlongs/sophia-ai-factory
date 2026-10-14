'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import type { HelpData } from './types';

interface SopsViewProps {
  data: HelpData;
  isVi: boolean;
}

export function SopsView({ data, isVi }: SopsViewProps) {
  return (
    <div className="space-y-8">
      {/* Table of Contents */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isVi ? 'Mục Lục' : 'Table of Contents'}
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {data.sections?.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/30"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {data.sections?.map((section) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
              {section.icon && <span className="text-lg">●</span>}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{section.intro}</p>

          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-card/50 p-4 hover:border-border/80 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="font-medium text-foreground text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  {step.link && (
                    <Link
                      href={step.link}
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {step.linkLabel} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {section.tip && (
            <div className="flex gap-3 rounded-lg bg-accent-500/5 border border-accent-500/20 p-3">
              <AlertCircle className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
              <p className="text-xs text-accent-300/80 leading-relaxed">
                <span className="font-semibold">Tip:</span> {section.tip}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
