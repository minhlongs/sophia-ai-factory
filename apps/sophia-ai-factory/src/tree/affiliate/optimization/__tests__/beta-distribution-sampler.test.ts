import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleBeta, sampleGamma } from '../beta-distribution-sampler';

describe('Gamma and Beta distribution samplers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the squeeze acceptance path and applies the Gamma scale', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.1);

    expect(sampleGamma(2, 3)).toBeCloseTo(5, 10);
  });

  it('retries non-positive transformed values and skips zero Box-Muller draws', () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.2);

    expect(sampleGamma(1)).toBeGreaterThan(0);
    expect(random).toHaveBeenCalledTimes(7);
  });

  it('accepts candidates through the full log-ratio test', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(Math.exp(-2))
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.6);

    expect(sampleGamma(1)).toBeGreaterThan(0);
  });

  it('boosts shapes below one and applies the requested scale', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.25);

    expect(sampleGamma(0.5, 2)).toBeCloseTo(7 / 48, 10);
  });

  it('returns a bounded Beta sample and rejects non-positive shape parameters', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const value = sampleBeta(2, 5);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
    expect(() => sampleBeta(0, 5)).toThrow('Beta distribution parameters alpha and beta must be positive');
    expect(() => sampleBeta(5, -1)).toThrow('Beta distribution parameters alpha and beta must be positive');
  });

  it('returns the neutral value if both Gamma draws underflow to zero', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5).mockReturnValueOnce(0.25).mockReturnValueOnce(0.1).mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5).mockReturnValueOnce(0.25).mockReturnValueOnce(0.1).mockReturnValueOnce(0);

    expect(sampleBeta(0.5, 0.5)).toBe(0.5);
  });
});
