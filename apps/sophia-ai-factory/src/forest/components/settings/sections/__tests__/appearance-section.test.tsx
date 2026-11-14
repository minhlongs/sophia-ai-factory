import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { UserProfileFormValues } from '@/land/schemas/settings';
import { AppearanceSection } from '../appearance-section';

const mockSetTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: mockSetTheme }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('AppearanceSection — live OS matchMedia sync for system theme', () => {
  let prefersLight = false;
  let changeListeners: Array<(event: MediaQueryListEvent) => void> = [];

  beforeEach(() => {
    mockSetTheme.mockReset();
    prefersLight = false;
    changeListeners = [];

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return prefersLight;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') changeListeners.push(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            changeListeners = changeListeners.filter((fn) => fn !== cb);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  function buildStubForm(currentTheme: 'light' | 'dark' | 'system') {
    const setValue = vi.fn();
    const watch = vi.fn().mockReturnValue(currentTheme);
    return {
      form: { watch, setValue } as unknown as UseFormReturn<UserProfileFormValues>,
      setValue,
    };
  }

  it('syncs initial OS preference and updates setTheme live when OS color scheme changes under system mode', () => {
    prefersLight = false;
    const { form } = buildStubForm('system');
    const { unmount } = render(<AppearanceSection form={form} />);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(changeListeners).toHaveLength(1);

    act(() => {
      prefersLight = true;
      changeListeners[0]({ matches: true } as MediaQueryListEvent);
    });
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');

    unmount();
    expect(changeListeners).toHaveLength(0);
  });

  it('applies explicit light/dark selections and resolves system immediately on radio click', () => {
    prefersLight = true;
    const { form, setValue } = buildStubForm('dark');
    render(<AppearanceSection form={form} />);

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]); // system

    expect(setValue).toHaveBeenCalledWith('settings.theme', 'system', { shouldDirty: true });
    expect(mockSetTheme).toHaveBeenLastCalledWith('light');
  });
});
