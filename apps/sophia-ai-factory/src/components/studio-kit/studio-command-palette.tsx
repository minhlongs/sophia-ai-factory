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
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-text">
            {locale === 'vi'
              ? `DANH MỤC CÔNG CỤ • ${visible.length}/${capabilities.length} ĐANG HOẠT ĐỘNG`
              : `TOOL CATALOG • ${visible.length}/${capabilities.length} ACTIVE`}
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">
            {locale === 'vi'
              ? `Toàn Bộ ${capabilities.length} Công Cụ AI Đang Hoạt Động`
              : `All ${capabilities.length} Active AI Tools`}
          </h2>
        </div>

        <button
          type="button"
          aria-pressed={showAllEngines}
          onClick={() => setShowAllEngines((prev) => !prev)}
          className={`md3-pill-button min-h-[44px] border px-4 py-2 text-xs font-semibold ${
            showAllEngines
              ? 'border-primary bg-[var(--md-sys-color-primary-container)] text-foreground'
              : 'border-border bg-card text-muted-foreground'
          }`}
        >
          {showAllEngines
            ? locale === 'vi'
              ? 'Thu gọn (4 công cụ chính)'
              : 'Show Core Only (4)'
            : locale === 'vi'
              ? `Xem đủ ${capabilities.length} công cụ`
              : `Show All ${capabilities.length} Tools`}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="sophia-studio-cmdk-input" className="sr-only">
          {locale === 'vi'
            ? `Tìm nhanh trong ${capabilities.length} công cụ`
            : `Search all ${capabilities.length} tools`}
        </label>
        <input
          id="sophia-studio-cmdk-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            locale === 'vi'
              ? `Tìm nhanh trong ${capabilities.length} công cụ (⌘K)... ví dụ: Kịch bản, Hoa hồng, Giọng đọc, Phân quyền`
              : `Search ${capabilities.length} tools (⌘K)... e.g. Hook, Affiliate, Voiceover, Permissions`
          }
          className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />

        <div
          role="group"
          aria-label={locale === 'vi' ? 'Lọc theo nhóm công cụ' : 'Filter by tool category'}
          className="flex flex-wrap gap-2"
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(cat.id)}
                className={`md3-pill-button min-h-[38px] border px-3.5 py-1.5 text-xs font-semibold ${
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

      {visible.length === 0 ? (
        <div className="md3-surface-tonal flex flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">
            {locale === 'vi' ? 'Không tìm thấy công cụ phù hợp' : 'No matching tools found'}
          </p>
          <p className="text-xs text-muted-foreground">
            {locale === 'vi'
              ? 'Thử từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ công cụ.'
              : 'Try another keyword or reset filters to view all tools.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('all');
              setShowAllEngines(true);
            }}
            className="md3-pill-button mt-1 min-h-[40px] bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            {locale === 'vi' ? 'Xóa bộ lọc' : 'Reset filters'}
          </button>
        </div>
      ) : (
        <StudioKpiStrip
          locale={locale}
          capabilities={visible}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      )}
    </section>
  );
}
