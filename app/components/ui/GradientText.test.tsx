import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GradientText } from './GradientText';

describe('GradientText', () => {
  const renderComponent = (props?: {
    children?: React.ReactNode;
    className?: string;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  }) => render(<GradientText {...props}>{props?.children || 'Test Text'}</GradientText>);

  describe('Basic Rendering', () => {
    it('renders children text', () => {
      renderComponent({ children: 'Hello Gradient' });
      expect(screen.getByText('Hello Gradient')).toBeInTheDocument();
    });

    it('applies gradient-text class', () => {
      renderComponent();
      expect(screen.getByText('Test Text')).toHaveClass('gradient-text');
    });
  });

  describe('As Prop - Dynamic Component', () => {
    it('renders as span by default', () => {
      renderComponent();
      expect(screen.getByText('Test Text').tagName).toBe('SPAN');
    });

    it('renders as h1 when as="h1"', () => {
      renderComponent({ as: 'h1' });
      expect(screen.getByText('Test Text').tagName).toBe('H1');
    });

    it('renders as h2 when as="h2"', () => {
      renderComponent({ as: 'h2' });
      expect(screen.getByText('Test Text').tagName).toBe('H2');
    });

    it('renders as h3 when as="h3"', () => {
      renderComponent({ as: 'h3' });
      expect(screen.getByText('Test Text').tagName).toBe('H3');
    });

    it('renders as h4 when as="h4"', () => {
      renderComponent({ as: 'h4' });
      expect(screen.getByText('Test Text').tagName).toBe('H4');
    });

    it('renders as p when as="p"', () => {
      renderComponent({ as: 'p' });
      expect(screen.getByText('Test Text').tagName).toBe('P');
    });
  });

  describe('ClassName', () => {
    it('applies custom className', () => {
      renderComponent({ className: 'text-xl' });
      expect(screen.getByText('Test Text')).toHaveClass('text-xl');
    });

    it('merges custom className with gradient-text', () => {
      renderComponent({ className: 'font-bold text-2xl' });
      const element = screen.getByText('Test Text');
      expect(element).toHaveClass('gradient-text', 'font-bold', 'text-2xl');
    });
  });

  describe('Children Types', () => {
    it('renders string children', () => {
      renderComponent({ children: 'Simple String' });
      expect(screen.getByText('Simple String')).toBeInTheDocument();
    });

    it('renders React element children', () => {
      renderComponent({ children: <span data-testid="child">Child Element</span> });
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      renderComponent({
        children: (
          <>
            <span>First</span> <span>Second</span>
          </>
        ),
      });
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });
});
