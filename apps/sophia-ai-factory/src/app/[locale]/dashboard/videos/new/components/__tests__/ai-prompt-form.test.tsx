/**
 * Unit tests for AiPromptForm component.
 *
 * Tests:
 * - Renders all form fields
 * - Submit button disabled when prompt < 10 chars
 * - Shows progress view on successful submission
 * - Shows error message on failure
 * - Passes correct values to generateVideoAction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/app/actions/video-generate-action', () => ({
  generateVideoAction: vi.fn(),
}));

vi.mock('../render-progress', () => ({
  RenderProgress: ({ missionId }: { missionId: string }) => (
    <div data-testid="render-progress">{missionId}</div>
  ),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { AiPromptForm } from '../ai-prompt-form';
import { generateVideoAction } from '@/app/actions/video-generate-action';

const mockGenerateVideoAction = vi.mocked(generateVideoAction);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AiPromptForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders prompt textarea, style select, language select, and submit button', () => {
    const { container } = render(<AiPromptForm />);

    expect(screen.getByRole('textbox')).toBeTruthy();
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(2);
    expect(screen.getByRole('button')).toBeTruthy();
    expect(container).toBeTruthy();
  });

  it('submit button is disabled when prompt is empty', () => {
    render(<AiPromptForm />);
    const submitBtn = screen.getByRole('button') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('submit button is disabled when prompt is shorter than 10 characters', () => {
    render(<AiPromptForm />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'short' } });
    const submitBtn = screen.getByRole('button') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('submit button is enabled when prompt has 10+ characters', () => {
    render(<AiPromptForm />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'A sufficiently long prompt text here' } });
    const submitBtn = screen.getByRole('button') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('shows RenderProgress with missionId after successful submission', async () => {
    mockGenerateVideoAction.mockResolvedValue({
      success: true,
      missionId: 'test-mission-id-1234',
    });

    render(<AiPromptForm />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'A beautiful nature video with birds and trees' } });

    const form = textarea.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      const progress = screen.getByTestId('render-progress');
      expect(progress).toBeTruthy();
      expect(progress.textContent).toContain('test-mission-id-1234');
    });
  });

  it('shows server error message on failure', async () => {
    mockGenerateVideoAction.mockResolvedValue({
      success: false,
      error: 'Video quota exceeded',
      code: 'QUOTA_EXCEEDED',
    });

    render(<AiPromptForm />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'A sufficiently long prompt for testing quota' } });

    const form = textarea.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Video quota exceeded')).toBeTruthy();
    });
  });

  it('passes correct form values to generateVideoAction', async () => {
    mockGenerateVideoAction.mockResolvedValue({
      success: true,
      missionId: 'mission-xyz',
    });

    render(<AiPromptForm />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A cinematic shot of mountains at sunrise' },
    });

    const [styleSelect] = screen.getAllByRole('combobox');
    fireEvent.change(styleSelect, { target: { value: 'cinematic' } });

    fireEvent.submit(screen.getByRole('textbox').closest('form')!);

    await waitFor(() => {
      expect(mockGenerateVideoAction).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A cinematic shot of mountains at sunrise',
          style: 'cinematic',
        }),
      );
    });
  });
});
