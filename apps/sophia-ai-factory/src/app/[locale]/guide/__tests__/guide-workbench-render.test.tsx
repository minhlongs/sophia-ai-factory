/**
 * Render tests for the guide workbench island.
 * These exist because the workbench reads its state from a URL hash and formats
 * ICU counter strings at render time — two paths no static gate can check. The
 * message catalog below is the real `vi` payload, so a broken key or a missing
 * ICU value fails here instead of white-screening production.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import viMessages from '../../../../../messages/vi.json';
import { GuideWorkbench } from '../guide-workbench';

const messages = { guide: viMessages.guide };
const canvasLabel = viMessages.guide.workbench.canvasLabel;

function setHash(hash: string): void {
  window.history.replaceState(null, '', hash);
}

function renderWorkbench() {
  return render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <GuideWorkbench locale="vi" initialTarget={{ mode: 'stage', step: 1 }} />
    </NextIntlClientProvider>,
  );
}

describe('guide workbench render', () => {
  beforeEach(() => {
    setHash('/vi/guide');
  });

  it('renders the first station from the landing target', () => {
    renderWorkbench();
    expect(screen.getByRole('heading', { level: 3 })).toBeDefined();
    // The ICU counter is filled by the component, so this proves values arrive.
    expect(screen.getByText('TRẠM 01 / 05')).toBeDefined();
  });

  it('renders a pillar when the hash names one', () => {
    setHash('/vi/guide#telegram');
    renderWorkbench();
    expect(screen.getByText('TRỤ CỘT 07 / 08')).toBeDefined();
  });

  // The hash is user-controlled, so an inherited prototype member must never
  // reach the catalogue as an index.
  it.each(['#constructor', '#__proto__'])('survives the prototype hash %s', (hash) => {
    setHash(`/vi/guide${hash}`);
    expect(() => renderWorkbench()).not.toThrow();
    // Falls back to the landing target rather than crashing the island.
    expect(screen.getByText('TRẠM 01 / 05')).toBeDefined();
  });

  it('associates the tablist with the inspector panel', () => {
    renderWorkbench();
    const tab = screen.getByRole('tab', { selected: true });
    const panel = screen.getByRole('tabpanel');
    expect(tab.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'));
  });

  it('marks the active tab disabled so the control is never silently dead', () => {
    renderWorkbench();
    const active = screen.getByRole('tab', { selected: true });
    const inactive = screen.getByRole('tab', { selected: false });
    expect(active.getAttribute('aria-disabled')).toBe('true');
    expect(inactive.getAttribute('aria-disabled')).toBeNull();
  });

  it('names every quick-select dot instead of leaving a bare dot', () => {
    renderWorkbench();
    // The dots carry no text, so their accessible name is the only handle users have.
    const dots = screen
      .getAllByRole('button')
      .filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('TRẠM'));
    expect(dots.length).toBe(5);
    expect(new Set(dots.map((d) => d.getAttribute('aria-label'))).size).toBe(5);
  });

  // The canvas captions exactly one simulation phase at a time, derived from the
  // `guide.workbench.phase*` keys. The UI state's casing differs from the
  // catalog's, so a mismatch shows up as a blank caption rather than a type error.
  it('captions the current simulation phase', () => {
    renderWorkbench();
    // Station 1 sits idle before CHẠY THỬ is pressed, so the caption reads IDLE.
    expect(screen.getByText(viMessages.guide.workbench.phaseIdle)).toBeDefined();
    expect(screen.queryByText(viMessages.guide.workbench.phaseEngine)).toBeNull();
  });

  it('exposes the canvas under a named group a screen reader can enter', () => {
    renderWorkbench();
    expect(screen.getByRole('group', { name: canvasLabel })).toBeDefined();
  });
});
