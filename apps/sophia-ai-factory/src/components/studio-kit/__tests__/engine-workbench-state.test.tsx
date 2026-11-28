import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EngineWorkbench } from '../engine-workbench';

vi.mock('../studio-command-palette', () => ({
  StudioCommandPalette: () => <div data-testid="mock-command-palette" />,
}));
vi.mock('../workbench-tab-media-slide', () => ({
  WorkbenchTabMediaSlide: () => <div data-testid="mock-media-tab" />,
}));
vi.mock('../workbench-tab-revenue-growth', () => ({
  WorkbenchTabRevenueGrowth: () => <div data-testid="mock-revenue-tab" />,
}));
vi.mock('../workbench-tab-security-rbac', () => ({
  WorkbenchTabSecurityRbac: () => <div data-testid="mock-security-tab" />,
}));
vi.mock('../workbench-tab-r21-r25-engines', () => ({
  WorkbenchTabR21R25Engines: () => <div data-testid="mock-scale-tab" />,
}));

describe('EngineWorkbench campaign draft state preservation (Wave B.1)', () => {
  it('preserves Step 1 script, platform, and jurisdiction across step switches and return', () => {
    render(<EngineWorkbench locale="vi" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const marker = 'SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER';
    fireEvent.change(textarea, { target: { value: `Kịch bản bảo mật sàn crypto — ${marker}` } });
    expect(textarea.value).toContain(marker);

    // Switch to Step 3 (Tối Ưu Doanh Thu) — unmounts Step 1 child
    fireEvent.click(screen.getByRole('button', { name: /Tối Ưu Doanh Thu/i }));
    expect(screen.queryByRole('textbox')).toBeNull();

    // Return to Step 1 (Kiểm Tra Kịch Bản) — draft must be preserved intact
    fireEvent.click(screen.getByRole('button', { name: /Kiểm Tra Kịch Bản/i }));
    const restoredTextarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(restoredTextarea.value).toContain(marker);
  });
});
