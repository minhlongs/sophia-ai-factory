import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardShell } from '../dashboard-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/vi/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../components/dashboard-aeo', () => ({
  DashboardAgentHudBar: () => <div data-testid="mock-agent-hud" />,
}));

vi.mock('../../components/cmd-k/cmd-k-palette', () => ({
  CmdKPalette: ({
    open,
    onOpenChange,
  }: {
    isAdmin: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="mock-cmdk-palette" data-open={String(Boolean(open))}>
      <button
        type="button"
        data-testid="mock-cmdk-shortcut-open"
        onClick={() => onOpenChange?.(true)}
      >
        Shortcut Open
      </button>
      <button
        type="button"
        data-testid="mock-cmdk-close"
        onClick={() => onOpenChange?.(false)}
      >
        Close CmdK
      </button>
    </div>
  ),
}));

describe('DashboardShell — CmdK Palette Integration & Focus Restoration', () => {
  it('opens CmdK from TopBar trigger and restores focus to opener on close', () => {
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

    try {
      render(
        <DashboardShell enableCmdK isVi>
          <div>Content</div>
        </DashboardShell>,
      );

      const trigger = screen.getByTestId('dashboard-cmdk-trigger');
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);
      expect(screen.getByTestId('mock-cmdk-palette').getAttribute('data-open')).toBe('true');

      const closeBtn = screen.getByTestId('mock-cmdk-close');
      closeBtn.focus();
      fireEvent.click(closeBtn);

      expect(screen.getByTestId('mock-cmdk-palette').getAttribute('data-open')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      rafSpy.mockRestore();
    }
  });

  it('captures activeElement when opened via keyboard shortcut callback and handles mobile drawer', () => {
    render(
      <DashboardShell enableCmdK>
        <div>Content</div>
      </DashboardShell>,
    );

    const shortcutBtn = screen.getByTestId('mock-cmdk-shortcut-open');
    shortcutBtn.focus();
    fireEvent.click(shortcutBtn);
    expect(screen.getByTestId('mock-cmdk-palette').getAttribute('data-open')).toBe('true');

    fireEvent.click(screen.getByTestId('mock-cmdk-close'));
    expect(screen.getByTestId('mock-cmdk-palette').getAttribute('data-open')).toBe('false');

    const mobileTrigger = screen.getByTestId('mobile-drawer-trigger');
    fireEvent.click(mobileTrigger);
    expect(screen.getByTestId('mobile-drawer')).toBeDefined();
    fireEvent.click(screen.getByTestId('mobile-drawer-backdrop'));
    expect(screen.queryByTestId('mobile-drawer')).toBeNull();
  });
});
