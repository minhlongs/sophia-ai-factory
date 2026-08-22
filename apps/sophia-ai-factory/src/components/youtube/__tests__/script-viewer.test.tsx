/**
 * Tests for ScriptViewer component.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScriptViewer, type ScriptData } from '../script-viewer';

const fullScript: ScriptData = {
  id: 'script-1',
  title: 'Top 10 AI Tools in 2026',
  hook: 'Did you know AI can edit your videos?',
  introduction: 'Welcome back to the channel.',
  mainContent: 'Here are the top 10 tools...',
  conclusion: 'That wraps up our list.',
  callToAction: 'Subscribe for more!',
  duration: '8:30',
  tone: 'energetic',
  pacing: 'fast',
};

describe('ScriptViewer', () => {
  it('renders the script title', () => {
    render(<ScriptViewer script={fullScript} />);
    expect(screen.getByText('Top 10 AI Tools in 2026')).toBeTruthy();
  });

  it('renders duration, tone, and pacing metadata', () => {
    render(<ScriptViewer script={fullScript} />);
    expect(screen.getByText('Duration: 8:30')).toBeTruthy();
    expect(screen.getByText('Tone: energetic')).toBeTruthy();
    expect(screen.getByText('Pacing: fast')).toBeTruthy();
  });

  it('renders all derived section blocks', () => {
    render(<ScriptViewer script={fullScript} />);
    expect(screen.getByText('Hook')).toBeTruthy();
    expect(screen.getByText('Introduction')).toBeTruthy();
    expect(screen.getByText('Main Content')).toBeTruthy();
    expect(screen.getByText('Conclusion')).toBeTruthy();
    expect(screen.getByText('Call to Action')).toBeTruthy();
  });

  it('renders section content', () => {
    render(<ScriptViewer script={fullScript} />);
    expect(screen.getByText('Did you know AI can edit your videos?')).toBeTruthy();
    expect(screen.getByText('Subscribe for more!')).toBeTruthy();
  });

  it('omits sections that are null', () => {
    const partial: ScriptData = {
      id: 'script-2',
      title: 'Partial Script',
      hook: 'Only a hook here.',
    };
    render(<ScriptViewer script={partial} />);
    expect(screen.getByText('Hook')).toBeTruthy();
    expect(screen.queryByText('Introduction')).toBeNull();
    expect(screen.queryByText('Main Content')).toBeNull();
    expect(screen.queryByText('Conclusion')).toBeNull();
    expect(screen.queryByText('Call to Action')).toBeNull();
  });

  it('omits metadata when not provided', () => {
    const minimal: ScriptData = { id: 'script-3', title: 'Minimal' };
    render(<ScriptViewer script={minimal} />);
    expect(screen.queryByText(/Duration:/)).toBeNull();
    expect(screen.queryByText(/Tone:/)).toBeNull();
    expect(screen.queryByText(/Pacing:/)).toBeNull();
  });

  it('uses explicit sections prop when provided', () => {
    const custom: ScriptData = {
      id: 'script-4',
      title: 'Custom Sections',
      hook: 'This hook should be ignored',
      sections: [
        { label: 'Cold Open', content: 'Start with a bang.' },
        { label: 'Outro', content: 'Thanks for watching.' },
      ],
    };
    render(<ScriptViewer script={custom} />);
    expect(screen.getByText('Cold Open')).toBeTruthy();
    expect(screen.getByText('Outro')).toBeTruthy();
    expect(screen.queryByText('Hook')).toBeNull();
    expect(screen.queryByText('This hook should be ignored')).toBeNull();
  });

  it('renders empty sections array without blocks', () => {
    const empty: ScriptData = {
      id: 'script-5',
      title: 'Empty Sections',
      sections: [],
    };
    const { container } = render(<ScriptViewer script={empty} />);
    expect(container.querySelectorAll('h4').length).toBe(0);
  });
});