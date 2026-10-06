/** @vitest-environment node */
/**
 * Integration Test Suite: Autonomous Land Server Actions
 *
 * Exercises all 7 Server Actions against an authentic in-memory D1 test fixture
 * initialized with migration 0437_autonomous_loop_and_heartbeat_scheduler.sql:
 * - getAutonomousLoopStatusAction
 * - startAutonomousLoopAction
 * - pauseAutonomousLoopAction
 * - resumeAutonomousLoopAction
 * - emergencyHaltAutonomousLoopAction
 * - resetCircuitBreakerAction
 * - triggerAutonomousCycleAction
 * - replayDeadLetterTaskAction
 *
 * Layer: land/autonomous/__tests__
 * Integrity: Direct integration against real SQLite D1 engine (zero facades/mocks).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  getAutonomousLoopStatusAction,
  startAutonomousLoopAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetCircuitBreakerAction,
  triggerAutonomousCycleAction,
  replayDeadLetterTaskAction,
} from '../loop-actions';

describe('Autonomous Land Server Actions (D1 Integration)', () => {
  let db: NodeSqliteD1Database;

  beforeEach(() => {
    // 1. Initialize authentic in-memory SQLite D1 database
    db = new NodeSqliteD1Database(':memory:');

    // 2. Load and execute authentic 0437 migration
    const migrationPath = path.resolve(
      __dirname,
      '../../../../migrations/0437_autonomous_loop_and_heartbeat_scheduler.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);

    // 3. Bind to global CF/D1 contexts
    (globalThis as Record<string, unknown>).__env__ = { DB: db };
    (globalThis as Record<string, unknown>).__D1_DB = db;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  it('1. retrieves initial autonomous cockpit status with default seeded tasks', async () => {
    const res = await getAutonomousLoopStatusAction('default', db);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();

    const data = res.data!;
    expect(data.loopState.state).toBe('IDLE');
    expect(data.loopState.consciousness_score).toBe(100);
    expect(data.tasks.length).toBeGreaterThanOrEqual(3);

    const skills = data.tasks.map((t) => t.skill_name);
    expect(skills).toContain('affiliate-scout');
    expect(skills).toContain('content-producer');
    expect(skills).toContain('auto-publisher');
  });

  it('2. starts autonomous loop transitioning IDLE -> RUNNING', async () => {
    const res = await startAutonomousLoopAction('default', db);
    expect(res.success).toBe(true);
    expect(res.data?.nextState).toBe('RUNNING');

    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.loopState.state).toBe('RUNNING');
    expect(statusRes.data?.loopState.version).toBe(2);
  });

  it('3. pauses autonomous loop from RUNNING to PAUSED', async () => {
    await startAutonomousLoopAction('default', db);

    const pauseRes = await pauseAutonomousLoopAction('Routine maintenance', 'default', db);
    expect(pauseRes.success).toBe(true);
    expect(pauseRes.data?.nextState).toBe('PAUSED');

    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.loopState.state).toBe('PAUSED');
  });

  it('4. resumes autonomous loop from PAUSED to IDLE', async () => {
    await pauseAutonomousLoopAction('Maintenance', 'default', db);

    const resumeRes = await resumeAutonomousLoopAction('default', db);
    expect(resumeRes.success).toBe(true);
    expect(resumeRes.data?.nextState).toBe('IDLE');

    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.loopState.state).toBe('IDLE');
  });

  it('5. triggers emergency halt from any state into PAUSED', async () => {
    const haltRes = await emergencyHaltAutonomousLoopAction('Emergency budget threshold', 'default', db);
    expect(haltRes.success).toBe(true);
    expect(haltRes.data?.nextState).toBe('PAUSED');

    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.loopState.state).toBe('PAUSED');
    expect(statusRes.data?.loopState.last_error).toBe('Emergency budget threshold');
  });

  it('6. resets circuit breaker from CIRCUIT_BROKEN to IDLE', async () => {
    // Manually trip circuit in database
    await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = 'CIRCUIT_BROKEN', consecutive_failures = 5, last_error = 'Too many failures'
         WHERE tenant_id = 'default'`
      )
      .run();

    const resetRes = await resetCircuitBreakerAction('default', db);
    expect(resetRes.success).toBe(true);
    expect(resetRes.data?.nextState).toBe('IDLE');

    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.loopState.state).toBe('IDLE');
    expect(statusRes.data?.loopState.consecutive_failures).toBe(0);
    expect(statusRes.data?.loopState.last_error).toBeNull();
  });

  it('7. triggers autonomous cycle and executes due swarm capabilities', async () => {
    // Set all tasks due now
    const nowSec = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `UPDATE autonomous_schedule_tasks
         SET next_run_at = ?1
         WHERE tenant_id = 'default'`
      )
      .bind(nowSec - 10)
      .run();

    const cycleRes = await triggerAutonomousCycleAction({
      force: true,
      tenantId: 'default',
      availableMcu: 1000,
      maxTokensPerCycle: 20000,
      dbOverride: db,
    });

    expect(cycleRes.success).toBe(true);
    const telemetry = cycleRes.data!;
    expect(telemetry.tasksAttempted).toBe(3);
    expect(telemetry.tasksSucceeded).toBe(3);
    expect(telemetry.tasksFailed).toBe(0);
    expect(telemetry.mcuConsumed).toBe(80); // 10 + 50 + 20
    expect(telemetry.tokensConsumed).toBe(13000); // 2000 + 8000 + 3000
    expect(telemetry.stateAfter).toBe('IDLE');

    // Verify recent runs inserted
    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.recentRuns.length).toBe(1);
    expect(statusRes.data?.recentRuns[0].tasks_succeeded).toBe(3);
    expect(statusRes.data?.recentRuns[0].mcu_consumed).toBe(80);
  });

  it('8. handles task failure, creates DLQ entry, and replays dead-letter task', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Insert a dummy unexecutable capability task
    await db
      .prepare(
        `INSERT INTO autonomous_schedule_tasks (
          id, tenant_id, skill_name, schedule_type, interval_seconds,
          priority, enabled, next_run_at, created_at, updated_at
        ) VALUES ('task_invalid_cap', 'default', 'non-existent-cap', 'interval', 3600, 1, 1, ?1, ?2, ?3)`
      )
      .bind(nowSec - 10, nowSec, nowSec)
      .run();

    const cycleRes = await triggerAutonomousCycleAction({
      force: true,
      tenantId: 'default',
      availableMcu: 1000,
      maxTokensPerCycle: 20000,
      dbOverride: db,
    });

    expect(cycleRes.success).toBe(true);
    expect(cycleRes.data?.tasksFailed).toBeGreaterThanOrEqual(1);

    // Verify DLQ entry exists
    const statusRes = await getAutonomousLoopStatusAction('default', db);
    expect(statusRes.data?.deadLetterTasks.length).toBeGreaterThanOrEqual(1);

    const dlqItem = statusRes.data!.deadLetterTasks[0];
    expect(dlqItem.status).toBe('dead');

    // Replay the DLQ task
    const replayRes = await replayDeadLetterTaskAction(dlqItem.id, 'default', db);
    expect(replayRes.success).toBe(true);
    expect(replayRes.data?.replayed).toBe(true);

    // Verify DLQ marked resolved
    const updatedDlq = await db
      .prepare(`SELECT * FROM autonomous_dead_letter_queue WHERE id = ?1`)
      .bind(dlqItem.id)
      .first<{ status: string }>();
    expect(updatedDlq?.status).toBe('resolved');
  });
});
