'use client';

/**
 * Sophia Engine Command Center & ⌘K Command Palette (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room progressive-disclosure workspace combining:
 * - Simple Mode (default, 4 core executive tiles) vs Pro/R&D Inspector toggle
 * - Keyboard-first ⌘K / Ctrl+K capability search (`dip/cmdk` MIT pattern)
 * - Schema-driven KPI Strip + Slide-over Inspector Drawer
 */

import { useEffect, useMemo, useState } from 'react';
import {
  SOPHIA_STUDIO_CAPABILITIES,
  filterCapabilities,
  type CapabilityCategory,
  type StudioCapabilitySpec,
} from '@/seed/ui/studio-capability-registry';
import { StudioKpiStrip } from './studio-kpi-strip';
import { StudioInspectorDrawer } from './studio-inspector-drawer';

export interface StudioCommandPaletteProps {
  readonly locale: 'vi' | 'en';
  readonly capabilities?: readonly StudioCapabilitySpec[];
}

const CATEGORIES: readonly { id: CapabilityCategory | 'all'; vi: string; en: string }[] = [
  { id: 'all', vi: 'Tất cả', en: 'All' },
  { id: 'video', vi: 'Video', en: 'Video' },
  { id: 'affiliate', vi: 'Affiliate', en: 'Affiliate' },
  { id: 'compliance', vi: 'Luật & An toàn', en: 'Compliance' },
  { id: 'analytics', vi: 'Tối ưu EPC', en: 'Analytics' },
  { id: 'security', vi: 'Bảo mật', en: 'Security' },
];

export function StudioCommandPalette({
  locale,
  capabilities = SOPHIA_STUDIO_CAPABILITIES,
}: StudioCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CapabilityCategory | 'all'>('all');
  const [inspectorMode, setInspectorMode] = useState(false);
  const [selected, setSelected] = useState<StudioCapabilitySpec | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const input = document.getElementById('sophia-studio-cmdk-input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visible = useMemo(
    () => filterCapabilities(capabilities, { query, category, inspectorMode }),
    [capabilities, query, category, inspectorMode],
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {locale === 'vi' ? 'Trung Tâm Điều Khiển Động Cơ Sophia' : 'Sophia Engine Command Center'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {locale === 'vi'
              ? 'Chế độ Đơn giản mặc định cho CEO; bật R&D Inspector để xem toàn bộ lõi kỹ thuật.'
              : 'Simple Mode by default for founders; toggle R&D Inspector to inspect all backend engines.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInspectorMode((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            inspectorMode
              ? 'border-indigo-500 bg-indigo-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          <span>{inspectorMode ? 'R&D Inspector: ON' : locale === 'vi' ? 'Chế độ Đơn giản' : 'Simple Mode'}</span>
        </button>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            id="sophia-studio-cmdk-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              locale === 'vi'
                ? 'Tìm nhanh tính năng (⌘K)... ví dụ: Hook, EPC, Luật, VA'
                : 'Quick search engines (⌘K)... e.g. Hook, EPC, Policy, VA'
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                category === cat.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {cat[locale]}
            </button>
          ))}
        </div>
      </div>

      <StudioKpiStrip
        locale={locale}
        capabilities={visible}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {locale === 'vi'
            ? 'Không có động cơ phù hợp. Thử bật R&D Inspector hoặc xóa bộ lọc.'
            : 'No matching engines. Try enabling R&D Inspector or clearing filters.'}
        </p>
      ) : null}

      <StudioInspectorDrawer
        locale={locale}
        capability={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
