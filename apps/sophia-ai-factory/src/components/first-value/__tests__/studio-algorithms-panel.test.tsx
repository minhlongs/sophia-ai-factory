import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioAlgorithmsPanel } from '../affiliate-studio/studio-algorithms-panel';

describe('StudioAlgorithmsPanel', () => {
  it('runs live 4-matrix policy preflight and updates disclosure on jurisdiction switch', () => {
    render(
      <StudioAlgorithmsPanel
        scriptText="Join this forex broker for guaranteed profit on crypto!"
        vertical="crypto"
        defaultJurisdiction="VN"
      />,
    );

    expect(screen.getByTestId('studio-algorithms-panel')).toBeTruthy();
    expect(screen.getByText(/Đã tự động làm mềm/)).toBeTruthy();
    expect(screen.getByText(/#QuảngCáo/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: 'UK' } });
    expect(screen.getByText(/FCA/)).toBeTruthy();
    expect(screen.getByText(/STRICT_CRYPTO_JURISDICTION_UK/)).toBeTruthy();
  });
});
