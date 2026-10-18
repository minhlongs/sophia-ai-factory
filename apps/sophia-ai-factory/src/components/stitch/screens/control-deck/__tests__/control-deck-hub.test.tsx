import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ControlDeckHub } from '../control-deck-hub';
import { ControlDeckSkeleton } from '../control-deck-skeleton';
import { STITCH_CONTROL_DECK_DATASET } from '@/tree/control-deck';

describe('ControlDeckHub (Stitch Director’s Control Deck)', () => {
  it('renders all 9 Stitch loop screen tabs with WAI-ARIA roles and default English copy', () => {
    render(
      <ControlDeckHub dataset={STITCH_CONTROL_DECK_DATASET} initialLang="en" />,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(9);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('aria-controls')).toBe('stitch-panel');
    expect(screen.getByRole('tabpanel')).toBeDefined();
    expect(screen.getByRole('note').textContent).toMatch(/figures are illustrative/i);

    expect(
      screen.getByRole('heading', {
        name: /Direction A — Director's Control Deck/i,
      }),
    ).toBeDefined();

    expect(screen.getByText(/CHAMPION ARM/i)).toBeDefined();
    expect(screen.getByText(/4-Advisor Parallel Strategic Synthesis/i)).toBeDefined();
    expect(screen.getByText(/Multi-Track NLE Timeline/i)).toBeDefined();
    expect(screen.queryByText(/IPN WEBHOOK 100% GREEN|VERIFIED|SETTLED/)).toBeNull();
  });

  it('toggles bilingual EN/VI mode and navigates between screens via click and keyboard', () => {
    render(
      <ControlDeckHub dataset={STITCH_CONTROL_DECK_DATASET} initialLang="en" />,
    );

    const langButton = screen.getByRole('button', {
      name: /Switch to Vietnamese/i,
    });
    fireEvent.click(langButton);

    expect(
      screen.getByRole('heading', {
        name: /Hướng A — Bàn Chỉ Huy Đạo Diễn/i,
      }),
    ).toBeDefined();
    expect(screen.getByText(/NHÁNH DẪN ĐẦU/i)).toBeDefined();

    const tabs = screen.getAllByRole('tab');
    const firstTab = tabs[0];
    if (firstTab) {
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    }
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.textContent).toMatch(/Tham vấn/i);
    expect(screen.getByRole('note').textContent).toMatch(/minh họa/i);
  });

  it('renders ControlDeckSkeleton with role="status", aria-busy="true", bilingual labels, and motion-reduce:animate-none', () => {
    const { unmount, container } = render(<ControlDeckSkeleton isVi={false} />);
    const statusRegion = screen.getByRole('status');
    expect(statusRegion.getAttribute('data-testid')).toBe('control-deck-skeleton');
    expect(statusRegion.getAttribute('aria-busy')).toBe('true');
    expect(statusRegion.getAttribute('aria-label')).toMatch(/Loading Stitch v4\.2/i);

    const pulsingBlocks = container.querySelectorAll('.animate-pulse');
    expect(pulsingBlocks.length).toBeGreaterThan(0);
    pulsingBlocks.forEach((node) => {
      expect(node.className).toContain('motion-reduce:animate-none');
    });
    unmount();

    render(<ControlDeckSkeleton isVi={true} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(
      /Đang tải Bàn Chỉ Huy Đạo Diễn/i,
    );
  });
});
