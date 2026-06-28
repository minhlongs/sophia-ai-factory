/**
 * Visual Router Tests
 * Verifies tier → path mapping correctness.
 */

import { describe, it, expect } from 'vitest';
import { routeVisualPath } from '../templates/visual-router';

describe('routeVisualPath', () => {
  it('routes free tier to template path', () => {
    expect(routeVisualPath('free')).toBe('template');
  });

  it('routes pro tier to template path', () => {
    expect(routeVisualPath('pro')).toBe('template');
  });

  it('routes enterprise tier to cinematic path', () => {
    expect(routeVisualPath('enterprise')).toBe('cinematic');
  });
});
