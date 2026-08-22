/**
 * Tests for ContentCalendarGrid component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentCalendarGrid, type CalendarEntry } from '../content-calendar-grid';

function entryInCurrentMonth(day: number, overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0);
  return {
    id: `entry-${day}`,
    title: `Video day ${day}`,
    scheduledAt: date.toISOString(),
    status: 'scheduled',
    ...overrides,
  };
}

describe('ContentCalendarGrid', () => {
  it('renders weekday headers', () => {
    render(<ContentCalendarGrid entries={[]} />);
    expect(screen.getByText('Sun')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy();
  });

  it('renders entries on their scheduled day', () => {
    render(<ContentCalendarGrid entries={[entryInCurrentMonth(15)]} />);
    expect(screen.getByText('Video day 15')).toBeTruthy();
  });

  it('renders multiple entries on the same day', () => {
    render(
      <ContentCalendarGrid
        entries={[
          entryInCurrentMonth(10, { id: 'a', title: 'First' }),
          entryInCurrentMonth(10, { id: 'b', title: 'Second' }),
        ]}
      />,
    );
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('shows overflow indicator when more than 2 entries on a day', () => {
    render(
      <ContentCalendarGrid
        entries={[
          entryInCurrentMonth(10, { id: 'a', title: 'First' }),
          entryInCurrentMonth(10, { id: 'b', title: 'Second' }),
          entryInCurrentMonth(10, { id: 'c', title: 'Third' }),
        ]}
      />,
    );
    expect(screen.getByText('+1 more')).toBeTruthy();
  });

  it('calls onEntryClick when an entry is clicked', () => {
    const onClick = vi.fn();
    const entry = entryInCurrentMonth(12);
    render(<ContentCalendarGrid entries={[entry]} onEntryClick={onClick} />);
    fireEvent.click(screen.getByText('Video day 12'));
    expect(onClick).toHaveBeenCalledWith(entry);
  });

  it('renders empty grid without entries', () => {
    const { container } = render(<ContentCalendarGrid entries={[]} />);
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('applies status-specific styling', () => {
    render(
      <ContentCalendarGrid
        entries={[entryInCurrentMonth(5, { status: 'published', title: 'Published one' })]}
      />,
    );
    const btn = screen.getByText('Published one');
    expect(btn.className).toContain('bg-indigo-50');
  });

  it('renders failed status styling', () => {
    render(
      <ContentCalendarGrid
        entries={[entryInCurrentMonth(7, { status: 'failed', title: 'Failed one' })]}
      />,
    );
    const btn = screen.getByText('Failed one');
    expect(btn.className).toContain('bg-rose-50');
  });

  it('renders entries across different days', () => {
    render(
      <ContentCalendarGrid
        entries={[
          entryInCurrentMonth(3, { id: 'x', title: 'Day three' }),
          entryInCurrentMonth(21, { id: 'y', title: 'Day twenty-one' }),
        ]}
      />,
    );
    expect(screen.getByText('Day three')).toBeTruthy();
    expect(screen.getByText('Day twenty-one')).toBeTruthy();
  });
});