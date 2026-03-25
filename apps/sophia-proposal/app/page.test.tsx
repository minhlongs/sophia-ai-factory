import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AI Agents That/i);
  });

  it('renders the hero subtitle', () => {
    render(<Home />);
    expect(screen.getByText(/Deploy autonomous AI missions via API/i)).toBeInTheDocument();
  });

  it('renders call-to-action buttons', () => {
    render(<Home />);
    expect(screen.getByText(/Start Free — 200 MCU/i)).toBeInTheDocument();
    expect(screen.getAllByText(/API Docs/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders features section', () => {
    render(<Home />);
    expect(screen.getByText('Powered by AI')).toBeInTheDocument();
    expect(screen.getByText('AI Mission Engine')).toBeInTheDocument();
    expect(screen.getByText('MCU Credits')).toBeInTheDocument();
    expect(screen.getByText('Developer-First API')).toBeInTheDocument();
  });

  it('renders pricing section', () => {
    render(<Home />);
    expect(screen.getByText('Transparent')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });
});
