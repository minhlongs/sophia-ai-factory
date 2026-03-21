import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sophia AI Factory');
  });

  it('renders the hero description', () => {
    render(<Home />);
    expect(screen.getByText(/AI-powered proposal generator for agencies/i)).toBeInTheDocument();
  });

  it('renders call-to-action buttons', () => {
    render(<Home />);
    // Hero section buttons
    const heroButtons = screen.getAllByRole('button');
    expect(heroButtons[0]).toHaveTextContent(/start free trial/i);
    expect(heroButtons[1]).toHaveTextContent(/watch demo/i);
  });

  it('renders features section', () => {
    render(<Home />);
    expect(screen.getByText('Why Sophia?')).toBeInTheDocument();
    expect(screen.getByText('Lightning Fast')).toBeInTheDocument();
    expect(screen.getByText('Secure by Default')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered')).toBeInTheDocument();
    expect(screen.getByText('Scalable Growth')).toBeInTheDocument();
  });

  it('renders pricing section', () => {
    render(<Home />);
    expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });
});
