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
    <nav aria-label={lang === 'vi' ? 'Màn hình xem trước' : 'Preview screens'} className="mt-5">
      <div role="tablist" aria-orientation="horizontal" className="flex flex-wrap gap-2 rounded-xl border border-[#1E2235] bg-[#11131F] p-2.5">
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
              className={`rounded-lg px-3 py-2 text-left font-mono text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${selected ? 'border border-primary bg-primary font-semibold text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.35)]' : 'border border-transparent bg-[#1A1C28] text-[#94A3B8] hover:border-[#1E2235] hover:text-[#F8FAFC]'}`}
            >
              <span className="mr-1.5 opacity-75">0{screen.index}.</span>
              <span>{screen.navLabel[lang]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
