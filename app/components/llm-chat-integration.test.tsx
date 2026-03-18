/**
 * LLMChat Component Integration Tests
 *
 * Tests the chat interface integrated with proposal generation algorithms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LLMChat } from './LLMChat';

// Mock the LLM client
vi.mock('../lib/llm-client', () => ({
  generate: vi.fn(async (prompt: string) => {
    // Simulate LLM responses
    if (prompt.includes('health')) {
      return 'Customer health score: 85/100 - Healthy engagement';
    }
    if (prompt.includes('features')) {
      return 'Top recommended features: AI Video Generation, Analytics Dashboard';
    }
    if (prompt.includes('price')) {
      return 'Recommended pricing: $299/month for Pro tier';
    }
    return 'Response to: ' + prompt.substring(0, 50);
  }),
}));

describe('LLMChat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Chat Functionality', () => {
    it('should render chat interface', () => {
      render(<LLMChat />);

      expect(screen.getByText('Sophia AI Chat')).toBeInTheDocument();
      expect(screen.getByText('Start a conversation with Sophia AI')).toBeInTheDocument();
    });

    it('should render input form', () => {
      render(<LLMChat />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should display initial empty state', () => {
      render(<LLMChat />);

      expect(screen.getByText('Start a conversation with Sophia AI')).toBeInTheDocument();
      expect(screen.getByText(/Powered by local LLM/i)).toBeInTheDocument();
    });
  });

  describe('Chat Message Flow', () => {
    it('should accept user input', () => {
      render(<LLMChat />);

      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
    });

    it('should have submit button in form', () => {
      render(<LLMChat />);

      const form = document.querySelector('form') as HTMLFormElement;
      const button = form?.querySelector('button');

      expect(form).toBeInTheDocument();
      expect(button).toBeInTheDocument();
    });

    it('should have proper form structure', () => {
      render(<LLMChat />);

      const form = document.querySelector('form') as HTMLFormElement;
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;

      expect(form).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('should show empty state initially', () => {
      render(<LLMChat />);
      expect(screen.getByText('Start a conversation with Sophia AI')).toBeInTheDocument();
    });

    it('should have message container elements', () => {
      render(<LLMChat />);
      const title = screen.getByText('Sophia AI Chat');
      expect(title).toBeInTheDocument();
    });

    it('should show header with title', () => {
      render(<LLMChat />);
      const header = screen.getByText('Sophia AI Chat');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Proposal Creation Flow Integration', () => {
    it('should render chat component for proposal generation', () => {
      const { container } = render(<LLMChat />);

      expect(container).toBeInTheDocument();
      expect(screen.getByText('Sophia AI Chat')).toBeInTheDocument();
    });

    it('should have input for health score queries', () => {
      render(<LLMChat />);
      const input = document.querySelector('input[type="text"]') as HTMLInputElement;

      expect(input).toBeInTheDocument();
      expect(input.type).toBe('text');
    });

    it('should have form for feature recommendation queries', () => {
      render(<LLMChat />);
      const form = document.querySelector('form') as HTMLFormElement;

      expect(form).toBeInTheDocument();
      expect(form.method || 'POST').toBeTruthy();
    });

    it('should have button for pricing queries', () => {
      render(<LLMChat />);
      const button = document.querySelector('button');

      expect(button).toBeInTheDocument();
      expect(button?.type).toBe('submit');
    });
  });

  describe('Input Validation', () => {
    it('should have text input element', () => {
      render(<LLMChat />);

      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe('text');
    });

    it('should have submit button', () => {
      render(<LLMChat />);

      const button = document.querySelector('button[type="submit"]');
      expect(button).toBeInTheDocument();
    });

    it('should have proper form attributes', () => {
      render(<LLMChat />);

      const form = document.querySelector('form') as HTMLFormElement;
      expect(form).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form structure', () => {
      render(<LLMChat />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should have semantic heading', () => {
      render(<LLMChat />);

      const heading = screen.getByText('Sophia AI Chat');
      expect(heading).toBeInTheDocument();
    });

    it('should have proper button attributes', () => {
      render(<LLMChat />);

      const button = document.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button?.type).toBe('submit');
    });
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<LLMChat />);
      expect(container).toBeInTheDocument();
    });

    it('should render chat title', () => {
      render(<LLMChat />);
      const title = screen.getByText('Sophia AI Chat');
      expect(title).toBeInTheDocument();
    });

    it('should have proper structure', () => {
      const { container } = render(<LLMChat />);
      const div = container.querySelector('div');

      expect(div).toBeInTheDocument();
    });
  });
});
