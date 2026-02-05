import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('handles conditional classes', () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn('base', isTrue && 'active', isFalse && 'inactive')).toBe('base active');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });

  it('handles arrays and objects', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
    expect(cn({ foo: true, bar: false })).toBe('foo');
  });
});
