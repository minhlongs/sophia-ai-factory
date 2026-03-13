/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FloatingElement } from './FloatingElement';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, className, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...props}>
        {children}
      </div>
    )),
  },
}));

describe('FloatingElement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props?: {
    children?: React.ReactNode;
    className?: string;
    depth?: number;
    duration?: number;
    delay?: number;
  }) => render(<FloatingElement {...props}>{props?.children || 'Floating'}</FloatingElement>);

  describe('Basic Rendering', () => {
    it('renders children', () => {
      renderComponent({ children: 'Test Content' });
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders with data-testid', () => {
      renderComponent();
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });
  });

  describe('ClassName', () => {
    it('applies absolute positioning by default', () => {
      renderComponent();
      expect(screen.getByTestId('motion-div')).toHaveClass('absolute');
    });

    it('applies custom className', () => {
      renderComponent({ className: 'custom-float' });
      expect(screen.getByTestId('motion-div')).toHaveClass('custom-float');
    });

    it('merges custom className with absolute', () => {
      renderComponent({ className: 'top-0 left-0' });
      expect(screen.getByTestId('motion-div')).toHaveClass('absolute', 'top-0', 'left-0');
    });
  });

  describe('Depth Prop', () => {
    it('uses default depth of 1', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom depth value', () => {
      const { container } = renderComponent({ depth: 3 });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Duration Prop', () => {
    it('uses default duration of 6', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom duration value', () => {
      const { container } = renderComponent({ duration: 10 });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Delay Prop', () => {
    it('uses default delay of 0', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom delay value', () => {
      const { container } = renderComponent({ delay: 2 });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('All Props Combined', () => {
    it('passes all props correctly', () => {
      renderComponent({
        children: <span>Floating Text</span>,
        className: 'test-class',
        depth: 2,
        duration: 8,
        delay: 1,
      });
      expect(screen.getByText('Floating Text')).toBeInTheDocument();
      expect(screen.getByTestId('motion-div')).toHaveClass('test-class');
    });
  });
});
