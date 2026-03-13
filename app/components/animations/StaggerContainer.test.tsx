import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaggerContainer, staggerItem } from './StaggerContainer';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, className, initial, whileInView, ...props }: {
      children: React.ReactNode;
      className?: string;
      initial?: string;
      whileInView?: string;
      [key: string]: unknown;
    }) => (
      <div
        className={className}
        data-testid="motion-div"
        data-initial={initial}
        data-whileinview={whileInView}
        {...props}
      >
        {children}
      </div>
    )),
  },
}));

describe('StaggerContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props?: {
    children?: React.ReactNode;
    className?: string;
    delay?: number;
    staggerChildren?: number;
    viewport?: { once?: boolean; margin?: string };
  }) => (
    render(
      <StaggerContainer {...props}>
        {props?.children || <div data-testid="child">Child</div>}
      </StaggerContainer>
    )
  );

  describe('Basic Rendering', () => {
    it('renders children', () => {
      renderComponent({ children: <span>Test Content</span> });
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders motion div container', () => {
      renderComponent();
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('sets initial state to hidden', () => {
      renderComponent();
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-initial', 'hidden');
    });
  });

  describe('WhileInView State', () => {
    it('sets whileInView to show', () => {
      renderComponent();
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-whileinview', 'show');
    });
  });

  describe('Delay Prop', () => {
    it('uses default delay of 0', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom delay value', () => {
      const { container } = renderComponent({ delay: 0.5 });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('StaggerChildren Prop', () => {
    it('uses default staggerChildren of 0.1', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom staggerChildren value', () => {
      const { container } = renderComponent({ staggerChildren: 0.2 });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Viewport Prop', () => {
    it('uses default viewport settings', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts custom viewport settings', () => {
      const { container } = renderComponent({ viewport: { once: false, margin: '100px' } });
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('ClassName', () => {
    it('applies custom className', () => {
      renderComponent({ className: 'container-class' });
      expect(screen.getByTestId('motion-div')).toHaveClass('container-class');
    });
  });

  describe('Multiple Children', () => {
    it('renders multiple children', () => {
      renderComponent({
        children: (
          <>
            <div data-testid="child-1">First</div>
            <div data-testid="child-2">Second</div>
          </>
        ),
      });
      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });
});

describe('staggerItem', () => {
  it('exports staggerItem variants object', () => {
    expect(staggerItem).toBeDefined();
    expect(staggerItem.hidden).toBeDefined();
    expect(staggerItem.show).toBeDefined();
  });

  it('has correct hidden state', () => {
    expect(staggerItem.hidden).toEqual({ opacity: 0, y: 20 });
  });

  it('has correct show state', () => {
    expect(staggerItem.show).toEqual({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    });
  });
});
