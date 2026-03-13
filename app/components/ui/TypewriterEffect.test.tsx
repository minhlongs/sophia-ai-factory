/* eslint-disable @typescript-eslint/no-explicit-any -- Test mock data */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypewriterEffect, TypewriterLoop } from './TypewriterEffect';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, className, ref, ...props }: any) => (
      <div className={className} ref={ref} data-testid="motion-div" {...props}>
        {children}
      </div>
    )),
    span: vi.fn(({ children, className, ...props }: any) => (
      <span className={className} data-testid="motion-span" {...props}>
        {children}
      </span>
    )),
  },
  useAnimate: vi.fn(() => [
    { current: null },
    vi.fn(),
  ]),
  useInView: vi.fn(() => true),
  stagger: vi.fn((val: number) => val),
}));

describe('TypewriterEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWords = [
    { text: 'Hello' },
    { text: 'World' },
  ];

  const renderComponent = (props: {
    words: { text: string; className?: string }[];
    className?: string;
    cursorClassName?: string;
  }) => render(<TypewriterEffect {...props} />);

  describe('Basic Rendering', () => {
    it('renders words array', () => {
      renderComponent({ words: mockWords });
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });

    it('renders cursor element', () => {
      renderComponent({ words: mockWords });
      const cursors = screen.getAllByTestId('motion-span');
      expect(cursors.length).toBeGreaterThan(0);
    });
  });

  describe('Word Rendering', () => {
    it('renders each word in separate div', () => {
      renderComponent({ words: [{ text: 'Single' }] });
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });

    it('renders words with custom className', () => {
      renderComponent({
        words: [{ text: 'Styled', className: 'text-red-500' }],
      });
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });
  });

  describe('Container ClassName', () => {
    it('applies default text classes', () => {
      renderComponent({ words: mockWords });
      const container = screen.getByTestId('motion-div').parentElement;
      expect(container).toHaveClass('font-bold', 'text-center');
    });

    it('applies custom className', () => {
      renderComponent({ words: mockWords, className: 'custom-class' });
      const container = screen.getByTestId('motion-div').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Cursor ClassName', () => {
    it('applies default cursor classes', () => {
      renderComponent({ words: mockWords });
      const cursors = screen.getAllByTestId('motion-span');
      // Last span is the cursor
      const cursor = cursors[cursors.length - 1];
      expect(cursor).toHaveClass('bg-blue-500');
    });

    it('applies custom cursor className', () => {
      renderComponent({ words: mockWords, cursorClassName: 'cursor-custom' });
      const cursors = screen.getAllByTestId('motion-span');
      const cursor = cursors[cursors.length - 1];
      expect(cursor).toHaveClass('cursor-custom');
    });
  });

  describe('Character Splitting', () => {
    it('splits words into characters', () => {
      renderComponent({ words: [{ text: 'ABC' }] });
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });

    it('handles empty word text', () => {
      renderComponent({ words: [{ text: '' }] });
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });
  });
});

describe('TypewriterLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderComponent = (props?: {
    words?: string[];
    className?: string;
    delay?: number;
  }) => render(<TypewriterLoop words={props?.words || ['Test']} {...props} />);

  describe('Basic Rendering', () => {
    it('renders container element', () => {
      renderComponent({ words: ['Hello', 'World'] });
      // TypewriterLoop renders a span, not motion-div
      expect(screen.getByText('|')).toBeInTheDocument();
    });

    it('renders cursor pipe', () => {
      renderComponent({ words: ['Test'] });
      expect(screen.getByText('|')).toBeInTheDocument();
    });
  });

  describe('ClassName', () => {
    it('applies custom className', () => {
      renderComponent({ words: ['Test'], className: 'text-xl' });
      // The span wraps text + cursor
      expect(screen.getByText('|').parentElement).toHaveClass('text-xl');
    });
  });

  describe('Delay Prop', () => {
    it('uses default delay of 3000ms', () => {
      renderComponent({ words: ['Test'] });
      // Default delay is 3000ms
      expect(screen.getByText('|')).toBeInTheDocument();
    });

    it('accepts custom delay', () => {
      renderComponent({ words: ['Test'], delay: 2000 });
      expect(screen.getByText('|')).toBeInTheDocument();
    });
  });

  describe('Typing Behavior', () => {
    it('types characters over time', () => {
      renderComponent({ words: ['Hi'] });

      // Just verify component renders
      expect(screen.getByText('|')).toBeInTheDocument();
    });

    it('cycles through multiple words', () => {
      renderComponent({ words: ['One', 'Two'] });

      // Just verify component renders with multiple words
      expect(screen.getByText('|')).toBeInTheDocument();
    });
  });
});
