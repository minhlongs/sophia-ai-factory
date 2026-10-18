'use client';

import React, { useRef } from 'react';
import type { ControlDeckScreenId, StitchScreenSpec } from '@/seed/types/stitch-control-deck';

export interface ControlDeckScreenNavProps {
  readonly screens: readonly StitchScreenSpec[];
  readonly activeId: ControlDeckScreenId;
  readonly lang: 'en' | 'vi';
  readonly onSelect: (id: ControlDeckScreenId) => void;
}

export function ControlDeckScreenNav({ screens, activeId, lang, onSelect }: ControlDeckScreenNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moveFocus = (index: number, key: string) => {
    const targetIndex = key === 'Home'
      ? 0
      : key === 'End'
        ? screens.length - 1
        : (index + (key === 'ArrowRight' ? 1 : -1) + screens.length) % screens.length;
    const target = screens[targetIndex];
    if (target) {
      onSelect(target.id);
      tabRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <nav aria-label={lang === 'vi' ? 'Màn hình xem trước' : 'Preview screens'} className="mt-5 min-w-0">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-2 rounded-xl border border-[#1E2638] bg-[#121722] p-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      >
        {screens.map((screen, index) => {
          const selected = screen.id === activeId;
          return (
            <button
              key={screen.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`stitch-tab-${screen.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="stitch-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(screen.id)}
              onKeyDown={(event) => {
                if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  moveFocus(index, event.key);
                }
              }}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-left font-mono text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${
                selected
                  ? 'border border-amber-400/70 bg-indigo-600 font-semibold text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_0_18px_rgba(99,102,241,0.45)]'
                  : 'border border-[#1E2638] bg-[#0B0E14]/90 text-[#94A3B8] hover:border-amber-400/40 hover:bg-[#1A2130] hover:text-[#F8FAFC]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-amber-400' : 'bg-[#475569]'}`}
              />
              <span className="opacity-80">0{screen.index}.</span>
              <span>{screen.navLabel[lang]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
