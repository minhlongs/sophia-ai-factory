import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from './Container';

describe('Container', () => {
  const renderComponent = (props?: { children?: React.ReactNode; className?: string }) =>
    render(<Container {...props}>{props?.children || 'Test Content'}</Container>);

  describe('Basic Rendering', () => {
    it('renders children', () => {
      renderComponent({ children: 'Hello World' });
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('applies default container classes', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toHaveClass('container', 'mx-auto', 'px-4');
    });
  });

  describe('Responsive Padding', () => {
    it('applies responsive padding classes', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
    });
  });

  describe('Custom ClassName', () => {
    it('applies custom className', () => {
      const { container } = renderComponent({ className: 'custom-container' });
      expect(container.firstChild).toHaveClass('custom-container');
    });

    it('merges custom className with default classes', () => {
      const { container } = renderComponent({ className: 'bg-red-500' });
      expect(container.firstChild).toHaveClass('container', 'mx-auto', 'bg-red-500');
    });
  });

  describe('Nested Children', () => {
    it('renders nested children correctly', () => {
      renderComponent({
        children: (
          <div data-testid="nested">
            <span>Nested Content</span>
          </div>
        ),
      });
      expect(screen.getByTestId('nested')).toBeInTheDocument();
      expect(screen.getByText('Nested Content')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      renderComponent({
        children: (
          <>
            <h1>Title</h1>
            <p>Paragraph</p>
          </>
        ),
      });
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
    });
  });
});
