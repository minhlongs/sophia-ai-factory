'use client';

/**
 * Sophia Interactive Engine Workbench (Rounds 1–19 Full Live UI + 2026 Core Kit).
 */

import { useState } from 'react';
import { WorkbenchTabScriptPolicy } from './workbench-tab-script-policy';
import { WorkbenchTabMediaSlide } from './workbench-tab-media-slide';
import { WorkbenchTabRevenueGrowth } from './workbench-tab-revenue-growth';
import { WorkbenchTabSecurityRbac } from './workbench-tab-security-rbac';
import { StudioCommandPalette } from './studio-command-palette';

type WorkbenchTabId = 'script' | 'media' | 'revenue' | 'security';

const TABS: readonly { id: WorkbenchTabId; vi: string; en: string }[] = [
  { id: 'script', vi: '1. Kịch Bản & Luật Sàn', en: '1. Script & Policy' },
  { id: 'media', vi: '2. Xưởng Media & Slide', en: '2. Media & Carousel' },
  { id: 'revenue', vi: '3. Tối Ưu Doanh Thu & A/B', en: '3. Revenue & Bandit' },
  { id: 'security', vi: '4. Bảo Mật & Phân Quyền VA', en: '4. Security & VA RBAC' },
];

export function EngineWorkbench({ locale }: { readonly locale: 'vi' | 'en' }) {
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>('script');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Sophia AI Factory • 2026 Interactive Workbench
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {locale === 'vi'
            ? 'Xưởng Động Cơ AI (19 Engines • Đợt 1–19)'
            : 'AI Engine Workbench (19 Live Engines • Rounds 1–19)'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {locale === 'vi'
            ? 'Chạy trực tiếp các thuật toán kiểm duyệt luật, chấm điểm Hook 3s, sinh Carousel SVG, Thompson Bandit A/B và phân quyền VA ngay trên trình duyệt.'
            : 'Run policy preflight, 3s hook scoring, SVG carousels, Thompson Bandit A/B, and fail-closed VA RBAC live in-browser.'}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab[locale]}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'script' ? <WorkbenchTabScriptPolicy locale={locale} /> : null}
        {activeTab === 'media' ? <WorkbenchTabMediaSlide locale={locale} /> : null}
        {activeTab === 'revenue' ? <WorkbenchTabRevenueGrowth locale={locale} /> : null}
        {activeTab === 'security' ? <WorkbenchTabSecurityRbac locale={locale} /> : null}
      </div>

      <StudioCommandPalette locale={locale} />
    </div>
  );
}
