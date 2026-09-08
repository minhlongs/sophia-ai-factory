import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('debug', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });
  
  afterEach(() => {
    fetchMock.mockRestore();
  });
  
  it('mockRejectedValueOnce works', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'aborterror';
    fetchMock.mockRejectedValueOnce(abortError);
    
    try {
      await fetch('https://example.com');
      console.log('ERROR: fetch did not throw!');
    } catch (e) {
      console.log('Caught:', e);
    }
    
    console.log('mock calls:', fetchMock.mock.calls.length);
    console.log('mock results:', fetchMock.mock.results);
  });
});
