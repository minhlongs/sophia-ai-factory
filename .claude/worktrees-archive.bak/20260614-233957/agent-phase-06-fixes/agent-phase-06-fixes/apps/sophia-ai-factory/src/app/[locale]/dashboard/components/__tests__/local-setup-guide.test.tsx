import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LocalSetupGuide } from '../local-setup-guide';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: React.PropsWithChildren<{ href: string; className?: string; [k: string]: unknown }>) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('LocalSetupGuide Component', () => {
  it('renders instructions and command correctly in English', () => {
    render(<LocalSetupGuide apiKey="sk_live_abcdef12..." locale="en" />);

    expect(screen.getByText(/Zero-Config Setup Guide/)).toBeDefined();
    expect(screen.getByText(/curl -s https:\/\/platform.sophia.ai\/install-m1.sh \| bash/)).toBeDefined();
    expect(screen.getByText('sk_live_abcdef12...')).toBeDefined();
  });

  it('renders instructions and command correctly in Vietnamese', () => {
    render(<LocalSetupGuide apiKey="sk_live_abcdef12..." locale="vi" />);

    expect(screen.getByText(/Hướng dẫn thiết lập Zero-Config/)).toBeDefined();
    expect(screen.getByText(/curl -s https:\/\/platform.sophia.ai\/install-m1.sh \| bash/)).toBeDefined();
    expect(screen.getByText('sk_live_abcdef12...')).toBeDefined();
  });

  it('renders API key generation message and link when apiKey is null (English)', () => {
    render(<LocalSetupGuide apiKey={null} locale="en" />);

    expect(screen.getByText(/No active connection API key found/)).toBeDefined();
    const generateLink = screen.getByText('Generate API Key');
    expect(generateLink).toBeDefined();
    expect(generateLink.getAttribute('href')).toBe('/en/dashboard/api-keys');
  });

  it('renders API key generation message and link when apiKey is null (Vietnamese)', () => {
    render(<LocalSetupGuide apiKey={null} locale="vi" />);

    expect(screen.getByText(/Không tìm thấy API Key đang hoạt động/)).toBeDefined();
    const generateLink = screen.getByText('Tạo API Key mới');
    expect(generateLink).toBeDefined();
    expect(generateLink.getAttribute('href')).toBe('/vi/dashboard/api-keys');
  });
});
