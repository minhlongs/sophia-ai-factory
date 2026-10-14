'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import type { HelpData } from './types';

interface FaqViewProps {
  data: HelpData;
  isVi: boolean;
}

export function FaqView({ data, isVi }: FaqViewProps) {
  return (
    <div className="space-y-8">
      {data.sections_faq?.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary-300">
            {section.heading}
          </h2>
          <div className="space-y-3">
            {section.items.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-border-800 bg-muted-900/50 hover:border-border-700 transition-colors"
              >
                <summary className="flex items-start gap-3 p-4 cursor-pointer list-none">
                  <HelpCircle className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-sm font-medium text-muted-foreground-200 group-open:text-white">
                    {item.q}
                  </span>
                </summary>
                <div className="px-4 pb-4 pl-11 space-y-2">
                  <p className="text-sm text-muted-foreground-400 leading-relaxed">{item.a}</p>
                  {item.link && (
                    <a
                      href={item.link.href}
                      className="inline-block mt-2 text-xs px-3 py-1.5 bg-muted-800 hover:bg-muted-700 text-primary-300 rounded-lg transition-colors"
                    >
                      {item.link.label} →
                    </a>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-border-800 bg-muted-900/30 p-4 text-center">
        <p className="text-sm text-muted-foreground-400">
          {isVi
            ? 'Không thấy câu trả lời? Vào Khắc phục sự cố hoặc email '
            : "Don't see your question? Visit Troubleshooting or email "}
          <Link href="/dashboard/help/troubleshooting" className="text-primary-400 hover:underline">
            {isVi ? 'Khắc phục sự cố' : 'Troubleshooting'}
          </Link>
          {isVi ? ' hoặc email ' : ' or email '}
          <a href="mailto:support@mekongmind.com" className="text-primary-400 hover:underline">
            support@mekongmind.com
          </a>
        </p>
      </div>
    </div>
  );
}
