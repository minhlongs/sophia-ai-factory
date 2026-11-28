import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EngineWorkbench } from '../engine-workbench';
import { WorkbenchTabScriptPolicy } from '../workbench-tab-script-policy';

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

describe('EngineWorkbench & WorkbenchTabScriptPolicy campaign draft behavior (Wave B.1)', () => {
  it('preserves controlled script, platform, and jurisdiction across all 5 steps and keeps empty script empty', () => {
    render(<EngineWorkbench locale="vi" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const selects = screen.getAllByRole('combobox') as unknown as HTMLSelectElement[];
    const marker = 'SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER';

    fireEvent.change(textarea, { target: { value: `Kịch bản bảo mật sàn crypto — ${marker}` } });
    fireEvent.change(selects[0], { target: { value: 'youtube_shorts' } });
    fireEvent.change(selects[1], { target: { value: 'US' } });

    // Navigate through all 5 guided steps
    fireEvent.click(screen.getByRole('button', { name: /Tạo Slide & Giọng Đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tối Ưu Doanh Thu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Khóa Link & Chặn Bot/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mở Rộng & Chia Hoa Hồng/i }));

    // Return to Step 1 — all 3 fields must remain intact
    fireEvent.click(screen.getByRole('button', { name: /Kiểm Tra Kịch Bản/i }));
    const restoredTextarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const restoredSelects = screen.getAllByRole('combobox') as unknown as HTMLSelectElement[];
    expect(restoredTextarea.value).toContain(marker);
    expect(restoredSelects[0].value).toBe('youtube_shorts');
    expect(restoredSelects[1].value).toBe('US');

    // Clearing script must keep it empty instead of reverting to default sample
    fireEvent.change(restoredTextarea, { target: { value: '' } });
    expect(restoredTextarea.value).toBe('');
  });

  it('supports standalone uncontrolled mode for script, platform, and jurisdiction edits', () => {
    render(<WorkbenchTabScriptPolicy locale="en" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const selects = screen.getAllByRole('combobox') as unknown as HTMLSelectElement[];

    fireEvent.change(textarea, { target: { value: 'Standalone operator script check.' } });
    fireEvent.change(selects[0], { target: { value: 'instagram_reels' } });
    fireEvent.change(selects[1], { target: { value: 'UK' } });

    expect(textarea.value).toBe('Standalone operator script check.');
    expect(selects[0].value).toBe('instagram_reels');
    expect(selects[1].value).toBe('UK');
  });
});
