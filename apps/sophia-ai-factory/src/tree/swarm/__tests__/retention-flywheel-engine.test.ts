/** @vitest-environment node */

/**
 * Unit Test Suite: Retention Flywheel Engine & Real-Time Churn Prevention
 *
 * Validates:
 * 1. Pure 4-factor churn score formula and weighting
 * 2. 4-level health tiering (green, yellow, red, critical)
 * 3. Trend direction detection (improving, stable, declining, rapid_drop)
 * 4. D1 health telemetry recording and historical retrieval
 * 5. Automated multi-tier intervention dispatch
 * 6. 7-day anti-spam cooldown protection
 * 7. High-throughput retention sweep batch execution
 *
 * @module tree/swarm/__tests__/retention-flywheel-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  calculateChurnRisk,
  evaluateCustomerHealth,
  recordCustomerHealth,
  getCustomerHealthSummary,
  executeAutomatedInterventions,
  executeManualIntervention,
  isInterventionInCooldown,
  runRetentionSweepBatch,
} from '../retention-flywheel-engine';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Retention Flywheel Engine — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS customer_health_metrics (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        org_id TEXT,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        active_agents_count INTEGER NOT NULL DEFAULT 0,
        video_generation_count INTEGER NOT NULL DEFAULT 0,
        api_request_count INTEGER NOT NULL DEFAULT 0,
        api_error_count INTEGER NOT NULL DEFAULT 0,
        api_error_rate REAL NOT NULL DEFAULT 0.0,
        login_frequency_7d INTEGER NOT NULL DEFAULT 0,
        mcu_consumption_rate REAL NOT NULL DEFAULT 0.0,
        nps_score INTEGER,
        churn_risk_score REAL NOT NULL DEFAULT 0.0,
        health_tier TEXT NOT NULL DEFAULT 'green',
        trend_direction TEXT NOT NULL DEFAULT 'stable',
        risk_factors_json TEXT NOT NULL DEFAULT '[]',
        last_activity_at INTEGER,
        evaluated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS swarm_intervention_events (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        trigger_metric_id TEXT,
        swarm_node_id TEXT,
        intervention_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'triggered',
        payload_json TEXT NOT NULL DEFAULT '{}',
        outcome_impact TEXT,
        churn_risk_before REAL NOT NULL,
        churn_risk_after REAL,
        resolved_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('4-Factor Churn Risk Math & Tiering', () => {
    it('classifies highly active customer as green with 0.00 churn risk', () => {
      const result = calculateChurnRisk({
        customerId: 'cust_green',
        activeAgentsCount: 5, // 0.00
        videoGenerationCount: 25, // 0.00
        apiRequestCount: 1000,
        apiErrorCount: 2, // 0.2% -> 0.00
        loginFrequency7d: 7, // 0.00
        mcuConsumptionRate: 500,
      });

      expect(result.churnRiskScore).toBe(0.0);
      expect(result.healthTier).toBe('green');
      expect(result.riskFactors).toHaveLength(0);
      expect(result.trendDirection).toBe('stable');
    });

    it('classifies moderate activity customer as yellow (0.25 <= score < 0.50)', () => {
      const result = calculateChurnRisk({
        customerId: 'cust_yellow',
        activeAgentsCount: 2, // 0.10
        videoGenerationCount: 6, // 0.10
        apiRequestCount: 100,
        apiErrorCount: 0, // 0.00
        loginFrequency7d: 2, // 0.08
        mcuConsumptionRate: 100,
      });

      // 0.10 + 0.10 + 0.00 + 0.08 = 0.28
      expect(result.churnRiskScore).toBe(0.28);
      expect(result.healthTier).toBe('yellow');
      expect(result.riskFactors).toContain('low_active_agents_count');
      expect(result.riskFactors).toContain('moderate_video_generation_drop');
      expect(result.riskFactors).toContain('low_login_frequency_under_4x');
    });

    it('classifies disengaged customer as red (0.50 <= score < 0.75)', () => {
      const result = calculateChurnRisk({
        customerId: 'cust_red',
        activeAgentsCount: 1, // 0.10
        videoGenerationCount: 2, // 0.20
        apiRequestCount: 100,
        apiErrorCount: 3, // 3% -> 0.10
        loginFrequency7d: 0, // 0.20
        mcuConsumptionRate: 20,
      });

      // 0.10 + 0.20 + 0.10 + 0.20 = 0.60
      expect(result.churnRiskScore).toBe(0.60);
      expect(result.healthTier).toBe('red');
    });

    it('classifies completely inactive customer as critical (score >= 0.75)', () => {
      const result = calculateChurnRisk({
        customerId: 'cust_critical',
        activeAgentsCount: 0, // 0.25
        videoGenerationCount: 0, // 0.35
        apiRequestCount: 50,
        apiErrorCount: 10, // 20% -> 0.20
        loginFrequency7d: 0, // 0.20
        mcuConsumptionRate: 0,
      });

      // 0.25 + 0.35 + 0.20 + 0.20 = 1.00
      expect(result.churnRiskScore).toBe(1.0);
      expect(result.healthTier).toBe('critical');
      expect(result.riskFactors).toContain('zero_active_agents');
      expect(result.riskFactors).toContain('zero_video_generation');
      expect(result.riskFactors).toContain('critical_api_error_spike_above_5_pct');
      expect(result.riskFactors).toContain('zero_logins_in_7d');
    });

    it('evaluates trend directions correctly based on delta from previous score', () => {
      // Rapid drop: delta >= 0.25
      const drop = calculateChurnRisk({
        customerId: 'cust_trend',
        activeAgentsCount: 0,
        videoGenerationCount: 0,
        apiRequestCount: 0,
        apiErrorCount: 0,
        loginFrequency7d: 0,
        mcuConsumptionRate: 0,
        previousChurnRiskScore: 0.1, // jumps from 0.1 to 0.8 -> delta 0.7
      });
      expect(drop.trendDirection).toBe('rapid_drop');

      // Improving: delta <= -0.10
      const improving = calculateChurnRisk({
        customerId: 'cust_trend',
        activeAgentsCount: 5,
        videoGenerationCount: 20,
        apiRequestCount: 100,
        apiErrorCount: 0,
        loginFrequency7d: 7,
        mcuConsumptionRate: 100,
        previousChurnRiskScore: 0.6, // drops from 0.6 to 0.0 -> delta -0.6
      });
      expect(improving.trendDirection).toBe('improving');
    });
  });

  describe('D1 Database Persistence & Telemetry Ingestion', () => {
    it('persists evaluated health metric and retrieves latest summary', async () => {
      const metric = await recordCustomerHealth(db, {
        customerId: 'cust_org_01',
        orgId: 'org_enterprise_alpha',
        activeAgentsCount: 3,
        videoGenerationCount: 15,
        apiRequestCount: 500,
        apiErrorCount: 1,
        loginFrequency7d: 5,
        mcuConsumptionRate: 2000,
        npsScore: 9,
      });

      expect(metric.customerId).toBe('cust_org_01');
      expect(metric.healthTier).toBe('green');

      const summary = await getCustomerHealthSummary(db, 'cust_org_01');
      expect(summary).not.toBeNull();
      expect(summary?.customerId).toBe('cust_org_01');
      expect(summary?.npsScore).toBe(9);
    });

    it('infers trend direction automatically from previous health record in DB', async () => {
      // First evaluation: low risk (0.0)
      await recordCustomerHealth(db, {
        customerId: 'cust_tracking_01',
        activeAgentsCount: 4,
        videoGenerationCount: 20,
        apiRequestCount: 200,
        apiErrorCount: 0,
        loginFrequency7d: 5,
        mcuConsumptionRate: 1000,
      });

      // Second evaluation: customer dropped activity
      const metric2 = await recordCustomerHealth(db, {
        customerId: 'cust_tracking_01',
        activeAgentsCount: 1,
        videoGenerationCount: 2,
        apiRequestCount: 50,
        apiErrorCount: 0,
        loginFrequency7d: 1,
        mcuConsumptionRate: 100,
      });

      expect(metric2.trendDirection).toBe('rapid_drop');
    });
  });

  describe('Automated Interventions & Cooldown Protocol', () => {
    it('triggers cs_escalation and bonus_credits for critical tier customers', async () => {
      const criticalMetric = evaluateCustomerHealth({
        customerId: 'cust_crit_01',
        activeAgentsCount: 0,
        videoGenerationCount: 0,
        apiRequestCount: 0,
        apiErrorCount: 0,
        loginFrequency7d: 0,
        mcuConsumptionRate: 0,
      });

      const events = await executeAutomatedInterventions(db, criticalMetric, 'node_apac_flywheel_01');
      expect(events).toHaveLength(2);

      const types = events.map((e) => e.interventionType);
      expect(types).toContain('cs_escalation');
      expect(types).toContain('bonus_credits');
    });

    it('triggers bonus_credits and feature_reengagement for red tier customers', async () => {
      const redMetric = evaluateCustomerHealth({
        customerId: 'cust_red_01',
        activeAgentsCount: 1,
        videoGenerationCount: 2,
        apiRequestCount: 100,
        apiErrorCount: 2,
        loginFrequency7d: 0,
        mcuConsumptionRate: 50,
      });

      const events = await executeAutomatedInterventions(db, redMetric);
      expect(events).toHaveLength(2);

      const types = events.map((e) => e.interventionType);
      expect(types).toContain('bonus_credits');
      expect(types).toContain('feature_reengagement');
    });

    it('triggers onboarding_guide for yellow tier customers', async () => {
      const yellowMetric = evaluateCustomerHealth({
        customerId: 'cust_yellow_01',
        activeAgentsCount: 2,
        videoGenerationCount: 5,
        apiRequestCount: 100,
        apiErrorCount: 0,
        loginFrequency7d: 2,
        mcuConsumptionRate: 100,
      });

      const events = await executeAutomatedInterventions(db, yellowMetric);
      expect(events).toHaveLength(1);
      expect(events[0].interventionType).toBe('onboarding_guide');
    });

    it('respects 7-day cooldown to prevent repetitive spam interventions', async () => {
      const criticalMetric = evaluateCustomerHealth({
        customerId: 'cust_cooldown_01',
        activeAgentsCount: 0,
        videoGenerationCount: 0,
        apiRequestCount: 0,
        apiErrorCount: 0,
        loginFrequency7d: 0,
        mcuConsumptionRate: 0,
      });

      // First run: triggers 2 interventions
      const firstRun = await executeAutomatedInterventions(db, criticalMetric);
      expect(firstRun).toHaveLength(2);

      const inCooldown = await isInterventionInCooldown(db, 'cust_cooldown_01', 'bonus_credits');
      expect(inCooldown).toBe(true);

      // Immediate second run: should trigger 0 interventions due to cooldown
      const secondRun = await executeAutomatedInterventions(db, criticalMetric);
      expect(secondRun).toHaveLength(0);
    });

    it('executes manual interventions dispatched by admin', async () => {
      const event = await executeManualIntervention(db, {
        customerId: 'cust_vip_01',
        interventionType: 'bonus_credits',
        payload: { creditAmountMcu: 50_000, reason: 'VIP apology credits' },
      });

      expect(event.id).toBeDefined();
      expect(event.interventionType).toBe('bonus_credits');
      expect(event.payload.creditAmountMcu).toBe(50_000);
      expect(event.status).toBe('applied');
    });
  });

  describe('Batch Retention Sweep', () => {
    it('runs retention sweep over customers and triggers interventions on risky tiers', async () => {
      // Seed 2 customers: 1 green, 1 red
      await recordCustomerHealth(db, {
        customerId: 'cust_green_batch',
        activeAgentsCount: 5,
        videoGenerationCount: 30,
        apiRequestCount: 100,
        apiErrorCount: 0,
        loginFrequency7d: 7,
        mcuConsumptionRate: 1000,
      });

      await recordCustomerHealth(db, {
        customerId: 'cust_red_batch',
        activeAgentsCount: 1,
        videoGenerationCount: 1,
        apiRequestCount: 100,
        apiErrorCount: 1,
        loginFrequency7d: 1,
        mcuConsumptionRate: 50,
      });

      const sweepResult = await runRetentionSweepBatch(db, 10);
      expect(sweepResult.evaluatedCount).toBe(2);
      expect(sweepResult.interventionsTriggered).toBeGreaterThan(0);
    });
  });
});
