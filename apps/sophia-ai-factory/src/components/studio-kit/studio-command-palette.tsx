'use client';

/**
 * Sophia 34-Engine MD3 Expressive Command Center (User & Admin Unified View).
 *
 * Shows all 34 live engines by default (zero hidden features) grouped cleanly
 * with MD3 Expressive Filter Chips, live counts, ⌘K search, and Inspector Drawer.
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
  { id: 'affiliate', vi: 'Affiliate & Doanh thu', en: 'Affiliate & Revenue' },
  { id: 'compliance', vi: 'Luật & An toàn', en: 'Compliance' },
  { id: 'analytics', vi: 'Tăng trưởng & EPC', en: 'Growth & EPC' },
  { id: 'security', vi: 'Bảo mật & VA', en: 'Security & VA' },
];

export function StudioCommandPalette({
  locale,
  capabilities = SOPHIA_STUDIO_CAPABILITIES,
}: StudioCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CapabilityCategory | 'all'>('all');
  // Default to full 34-engine visibility so nothing is ever hidden from users or admins
  const [showAllEngines, setShowAllEngines] = useState(true);
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
    () => filterCapabilities(capabilities, { query, category, inspectorMode: showAllEngines }),
    [capabilities, query, category, showAllEngines],
  );

  const countFor = (catId: CapabilityCategory | 'all') =>
    catId === 'all'
      ? capabilities.length
      : capabilities.filter((c) => c.category === catId).length;

  return (
    <section className="md3-surface-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {locale === 'vi'
              ? `HỆ SINH THÁI MD3 • ${visible.length}/${capabilities.length} ĐỘNG CƠ ĐANG CHẠY`
              : `MD3 ENGINE CATALOG • ${visible.length}/${capabilities.length} LIVE ENGINES`}
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">
            {locale === 'vi' ? 'Toàn Bộ 34 Động Cơ AI Sống (Đợt 1–35)' : 'All 34 Live AI Engines (Rounds 1–35)'}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setShowAllEngines((prev) => !prev)}
          className={`md3-pill-button border px-4 py-2 text-xs font-semibold ${
            showAllEngines
              ? 'border-primary bg-[var(--md-sys-color-primary-container)] text-foreground'
              : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {showAllEngines
            ? locale === 'vi'
              ? `Đang hiện đủ ${capabilities.length}/${capabilities.length}`
              : `Showing All ${capabilities.length}/${capabilities.length}`
            : locale === 'vi'
              ? 'Chế độ Gọn (4 lõi)'
              : 'Compact Mode (4 core)'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <input
          id="sophia-studio-cmdk-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            locale === 'vi'
              ? 'Tìm nhanh trong 34 động cơ (⌘K)... ví dụ: Hook, EPC, B-Roll, LTV, VA, Tax'
              : 'Quick search all 34 engines (⌘K)... e.g. Hook, EPC, B-Roll, LTV, VA, Tax'
          }
          className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`md3-pill-button border px-3.5 py-1.5 text-xs font-semibold ${
                  active
                    ? 'border-primary bg-[var(--md-sys-color-primary-container)] text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat[locale]}{' '}
                <span className="md3-tabular-nums opacity-75">({countFor(cat.id)})</span>
              </button>
            );
          })}
        </div>
      </div>

      <StudioInspectorDrawer
        locale={locale}
        capability={selected}
        onClose={() => setSelected(null)}
      />

      <StudioKpiStrip
        locale={locale}
        capabilities={visible}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
    </section>
  );
}
