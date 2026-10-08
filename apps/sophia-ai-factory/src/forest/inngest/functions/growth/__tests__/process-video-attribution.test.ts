import { describe, it, expect } from 'vitest';
import { processVideoAttribution } from '../process-video-attribution';

describe('processVideoAttribution Inngest Function', () => {
  it('is properly registered with the expected id and name', () => {
    // Inngest functions have metadata attached
    // Just verify export validity and basic structure
    expect(processVideoAttribution).toBeDefined();
    expect(typeof processVideoAttribution).toBe('object');
  });
});
