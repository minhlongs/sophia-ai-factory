import { describe, it, expect } from 'vitest';
import { calculateZScore, ActionEvent } from '../ghost-matrix-engine';

describe('ghost-matrix-engine', () => {
  it('should return zeros for empty history', () => {
    const result = calculateZScore([], 5);
    expect(result.zScore).toBe(0);
    expect(result.isAnomalous).toBe(false);
  });

  it('should calculate valid z-score and detect anomaly', () => {
    // 5 buckets, 1 hour each
    // 10 actions per hour consistently
    const history: ActionEvent[] = [];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
            history.push({ timestamp: i * 3600000 + j * 1000, actionType: 'post' });
        }
    }
    // Let's add some slight variance so stdDev is not exactly 0
    history.pop();
    history.push({ timestamp: 0, actionType: 'post' });

    // Mean should be around 10, let's say a spike of 50 occurs
    const result = calculateZScore(history, 50, 3600000, 3.0);

    expect(result.meanVelocity).toBe(10);
    expect(result.zScore).toBeGreaterThan(3.0);
    expect(result.isAnomalous).toBe(true);
  });

  it('should identify normal behavior', () => {
    const history: ActionEvent[] = [];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
            history.push({ timestamp: i * 3600000 + j * 1000, actionType: 'post' });
        }
    }
    history.pop(); // remove one from the end (bucket 4)
    history.push({ timestamp: 0, actionType: 'post' }); // add one to bucket 0

    const result = calculateZScore(history, 11, 3600000, 3.0);
    // console.log(result);

    expect(result.isAnomalous).toEqual(false);
  });

  it('should handle zero variance spike properly (Infinity)', () => {
    const history: ActionEvent[] = [];
    // Exactly 10 per hour for 5 hours => variance = 0
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
            history.push({ timestamp: i * 3600000 + j * 1000, actionType: 'post' });
        }
    }

    const result = calculateZScore(history, 15, 3600000, 3.0);
    expect(result.zScore).toBe(Infinity);
    expect(result.isAnomalous).toBe(true);
  });
});
