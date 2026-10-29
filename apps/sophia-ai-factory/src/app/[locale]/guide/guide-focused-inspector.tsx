/**
 * guide-focused-inspector.tsx
 * Right column of the guide workbench. Renders EXACTLY ONE selected station or
 * pillar in a 1-3-1 shape: one value sentence, three bullets, one proof box.
 * Chrome strings arrive as a plain serializable record; prose comes from seed.
 * Catalogue normalization lives in ./guide-inspector-items.
 */

import {
  buildInspectorItem,
  crossLinks,
  formatCounter,
  RAIL,
  type GuideInspectorLabels,
  type GuideMode,
} from './guide-inspector-items';
import type { GuideActiveTarget } from '@/seed/guide';
import type { GuideLocale } from './guide-schematic-nodes';

export type { GuideInspectorLabels, GuideMode } from './guide-inspector-items';

export interface GuideFocusedInspectorProps {
  readonly mode: GuideMode;
  readonly activeTarget: GuideActiveTarget;
  readonly locale: GuideLocale;
  readonly onSelect: (target: GuideActiveTarget) => void;
  readonly onStep: (delta: -1 | 1) => void;
  readonly labels: GuideInspectorLabels;
  /** Id of the panel, so the tabs can point at it. */
  readonly panelId?: string;
  /** Id of the tab that controls this panel. */
  readonly labelledById?: string;
}

const CAPTION = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
const NAV_BTN =
  'rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-accent disabled:opacity-40';
const CHIP_BTN =
  'rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-foreground hover:border-accent';
const COUNTER_CLS =
  'rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary';
const ROW = 'rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-foreground/90';
const PROOF = 'rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3';
const DOT_ON = 'h-2.5 w-2.5 rounded-full bg-primary';
const DOT_OFF = 'h-2.5 w-2.5 border border-border bg-muted';

function two(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Accessible name for a cross-link chip, so it is never a bare number. */
function crossLinkLabel(
  link: GuideActiveTarget,
  locale: GuideLocale,
  labels: GuideInspectorLabels,
): string {
  const index = link.mode === 'pillar' ? link.number : link.step;
  const name = buildInspectorItem(link.mode, index, locale, labels).title;
  return `${labels.crossLinkLabel}: ${name}`;
}

export function GuideFocusedInspector({
  mode,
  activeTarget,
  locale,
  onSelect,
  onStep,
  labels,
  panelId,
  labelledById,
}: GuideFocusedInspectorProps) {
  const index = mode === 'stage' ? (activeTarget.mode === 'stage' ? activeTarget.step : 1) : (activeTarget.mode === 'pillar' ? activeTarget.number : 1);
  const item = buildInspectorItem(mode, index, locale, labels);
  const links = crossLinks(mode, item.index);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={CAPTION}>{item.badge}</p>
          <h3 className="text-base font-bold text-foreground sm:text-lg">{item.title}</h3>
        </div>
        <span aria-live="polite" className={COUNTER_CLS}>
          {formatCounter(item.counterTemplate, item.index, item.total)}
        </span>
      </header>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={labelledById}
        className="mt-4 space-y-4"
      >
        <p className="text-sm leading-relaxed text-foreground/90">{item.value}</p>
        <ul className="space-y-2">
          {item.bullets.map((bullet) => (
            <li key={bullet[1]} className={ROW}>
              <span className={`${CAPTION} mr-2`}>{bullet[0]}</span>
              {bullet[1]}
            </li>
          ))}
        </ul>
        <div className={PROOF}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
            {item.proofCaption}
          </p>
          <div className="mt-2 space-y-1 font-mono text-[11px] text-emerald-300">
            {item.proofLines.map((line) => (
              <p key={line} className="break-all">{line}</p>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={CAPTION}>{labels.crossLinkLabel}</span>
            {links.map((link) => (
              <button
                key={link.mode === 'pillar' ? link.number : link.step}
                type="button"
                aria-label={crossLinkLabel(link, locale, labels)}
                onClick={() => onSelect(link)}
                className={CHIP_BTN}
              >
                {link.mode === 'pillar' ? `P${link.number}` : two(link.step)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-5 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onStep(-1)} disabled={item.index <= 1} className={NAV_BTN}>
          {labels.previous}
        </button>
        <div className="flex items-center gap-1.5" aria-label={labels.quickSelect}>
          {RAIL[mode].map((dot) => {
            const key = dot.mode === 'stage' ? dot.step : dot.number;
            return (
              <button
                key={key}
                type="button"
                aria-current={item.index === key ? 'true' : undefined}
                aria-label={formatCounter(item.counterTemplate, key, item.total)}
                onClick={() => onSelect(dot)}
                className={item.index === key ? DOT_ON : DOT_OFF}
              />
            );
          })}
        </div>
        <button type="button" onClick={() => onStep(1)} disabled={item.index >= item.total} className={NAV_BTN}>
          {labels.next}
        </button>
      </footer>
    </section>
  );
}
