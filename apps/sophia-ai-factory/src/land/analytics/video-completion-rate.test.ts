/**
 * Video completion rate — the SLI half that had no measurement.
 *
 * The SLO doc declares a completion-rate target; `summariseBenchmarkRows` only
 * answers "how fast were the successes". These tests pin the rate computation
 * and the eligible/completed/failed accounting so a rising rate cannot hide a
 * rising failure count.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { summariseCompletionRows, computeVideoCompletionRate } from './video-completion-rate'

// node:sqlite is a Node built-in and cannot be bundled under the jsdom environment.
/** @vitest-environment node */

describe('summariseCompletionRows', () => {
  it('reports zero rate with low_confidence when nothing is eligible', () => {
    const summary = summariseCompletionRows({
      completed: 0, failed: 0, processing: 0, eligible: 0,
    })
    expect(summary.completion_rate).toBe(0)
    expect(summary.low_confidence).toBe(true)
    expect(summary.eligible_jobs).toBe(0)
  })

  it('computes rate over terminal jobs only', () => {
    const summary = summariseCompletionRows({
      completed: 90, failed: 10, processing: 25, eligible: 100,
    })
    // Eligible == terminal jobs: in-flight work is not yet a failure or a success.
    expect(summary.eligible_jobs).toBe(100)
    expect(summary.completed_jobs).toBe(90)
    expect(summary.failed_jobs).toBe(10)
    expect(summary.completion_rate).toBe(90)
  })

  it('reports in-flight jobs separately so they cannot inflate the rate', () => {
    const summary = summariseCompletionRows({
      completed: 9, failed: 1, processing: 50, eligible: 10,
    })
    expect(summary.in_flight_jobs).toBe(50)
    expect(summary.eligible_jobs).toBe(10)
    expect(summary.completion_rate).toBe(90)
  })

  it('flags low_confidence below the shared sample floor', () => {
    // MIN_SAMPLES is 10 and the floor is exclusive, matching the render benchmark.
    expect(summariseCompletionRows({ completed: 4, failed: 5, processing: 0, eligible: 9 }).low_confidence).toBe(true)
    expect(summariseCompletionRows({ completed: 4, failed: 6, processing: 0, eligible: 10 }).low_confidence).toBe(false)
    expect(summariseCompletionRows({ completed: 6, failed: 4, processing: 0, eligible: 10 }).sample_floor).toBe(10)
  })

  it('never reports a rate above 100 when failures exceed successes', () => {
    const summary = summariseCompletionRows({
      completed: 1, failed: 99, processing: 0, eligible: 100,
    })
    expect(summary.completion_rate).toBe(1)
    expect(summary.failed_jobs).toBe(99)
  })

  it('rounds the rate to one decimal place', () => {
    const summary = summariseCompletionRows({
      completed: 2, failed: 1, processing: 0, eligible: 3,
    })
    expect(summary.completion_rate).toBe(66.7)
  })
})

describe('computeVideoCompletionRate — durable video rows', () => {
  /**
   * In-memory SQLite reproduces the `videos` columns the query reads. The
   * aggregation itself is production SQL, so a mistake in the CASE branches
   * shows up here rather than only in the pure summariser.
   */
  function fixture() {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE videos (id TEXT PRIMARY KEY, status TEXT, created_at INTEGER, completed_at INTEGER);`);
    // Timestamps are relative to now: the query bounds on a look-back window.
    const now = Math.floor(Date.now() / 1000);
    for (const row of [
      ['v1', 'completed', now - 300, now - 60],
      ['v2', 'completed', now - 300, now - 120],
      ['v3', 'failed_permanent', now - 300, now - 200],
      ['v4', 'processing', now - 300, null],
      ['v5', 'failed', now - 300, null],
      // outside the look-back window; must not be counted
      ['old', 'completed', now - 86400 * 30, now - 86400 * 29],
    ] as const) {
      raw.prepare(`INSERT INTO videos VALUES (?, ?, ?, ?)`).run(...row);
    }
    return {
      prepare(sql: string) {
        const statement = raw.prepare(sql);
        return {
          bind(...args: unknown[]) {
            return {
              async all<T>() {
                const rows = statement.all(...(args as never[])) as T[];
                return { results: rows };
              },
            };
          },
        };
      },
    };
  }

  it('counts terminal jobs as eligible and excludes in-flight work', async () => {
    const summary = await computeVideoCompletionRate(fixture(), { windowSeconds: 3600 });
    expect(summary.completed_jobs).toBe(2);
    expect(summary.failed_jobs).toBe(1)
    expect(summary.eligible_jobs).toBe(3)
    expect(summary.in_flight_jobs).toBe(2)
    expect(summary.completion_rate).toBe(66.7)
  })

  it('ignores rows outside the look-back window', async () => {
    const now = Math.floor(Date.now() / 1000);
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE videos (id TEXT PRIMARY KEY, status TEXT, created_at INTEGER, completed_at INTEGER);`);
    raw.prepare(`INSERT INTO videos VALUES ('recent','completed',?,?)`).run(now - 60, now - 30);
    raw.prepare(`INSERT INTO videos VALUES ('stale','completed',?,?)`).run(now - 86400 * 30, now - 86400 * 29);
    const db = {
      prepare(sql: string) {
        const statement = raw.prepare(sql);
        return { bind(...args: unknown[]) { return { async all<T>() { return { results: statement.all(...(args as never[])) as T[] } } } } };
      },
    };

    const summary = await computeVideoCompletionRate(db, { windowSeconds: 3600 });
    expect(summary.eligible_jobs).toBe(1);
    expect(summary.completion_rate).toBe(100);
  })

  it('reports zero and low_confidence when the window has no jobs', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE videos (id TEXT PRIMARY KEY, status TEXT, created_at INTEGER, completed_at INTEGER);`);
    const db = {
      prepare(sql: string) {
        const statement = raw.prepare(sql);
        return { bind(...args: unknown[]) { return { async all<T>() { return { results: statement.all(...(args as never[])) as T[] } } } } };
      },
    };

    const summary = await computeVideoCompletionRate(db, { windowSeconds: 3600 });
    expect(summary.eligible_jobs).toBe(0);
    expect(summary.completion_rate).toBe(0);
    expect(summary.low_confidence).toBe(true);
  })
})
