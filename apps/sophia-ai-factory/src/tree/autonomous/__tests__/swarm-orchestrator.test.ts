import { describe, it, expect } from 'vitest';
import {
  canExecuteCapability,
  executeSwarmTask,
  discoverAffiliateOffers,
  classifyAffiliateTier,
  calculateHookScore,
  generateViralVideoScript,
  generateMultiPlatformSyndication,
  buildUtmUrl,
  isApacPeakTime,
  calculateNextApacPeakSlot,
  calculateCycleTelemetry,
  CAPABILITY_BUDGETS,
  APAC_MARKET_CONFIGS,
  type SwarmExecutionContext,
  type AffiliateOffer,
  type ApacMarket,
} from '../swarm-orchestrator';

import type {
  AutonomousScheduleTaskRow,
  CircuitBreakerStatus,
} from '@/seed/types/autonomous-engine';

import type { AgentGovernanceYaml } from '@/seed/types/agent-governance';

describe('Autonomous Swarm Orchestrator & Governance Engine', () => {
  const baseTask: AutonomousScheduleTaskRow = {
    id: 'task-test-scout',
    tenant_id: 'tenant-test',
    skill_name: 'affiliate-scout',
    capability_name: 'affiliate-scout',
    schedule_type: 'interval',
    schedule_expression: null,
    cron_expression: null,
    interval_seconds: 14400,
    event_trigger: null,
    timezone: 'UTC',
    tier_requirement: 'BASIC',
    priority: 3,
    max_retries: 3,
    enabled: 1,
    last_run_at: null,
    next_run_at: 0,
    run_count: 0,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: 0,
    updated_at: 0,
  };

  const sampleAgyConfig: AgentGovernanceYaml = {
    schemaVersion: '1.0',
    agent: {
      id: 'agent-chua-chum',
      name: 'CHÚA CHÙM Swarm Operator',
      role: 'Swarm Orchestration Operator',
      maxAutonomyLevel: 'L3',
    },
    permissions: {
      allow: ['affiliate:*', 'video:*', 'social:*'],
      deny: ['payment:withdraw', 'system:delete'],
    },
    compute: {
      maxComputeUnitsMcu: 100,
      maxTokensPerRun: 15000,
    },
    escalation: {
      onQuotaExceeded: 'request_approval',
      onDisallowedAction: 'escalate_human',
    },
  };

  // ── 1. Budget & Execution Gatekeeping ───────────────────────────────────────

  describe('1. Budget & Execution Gatekeeping', () => {
    it('blocks execution when MCU is insufficient', () => {
      const check = canExecuteCapability('content-producer', {
        tenantId: 'tenant-test',
        availableMcu: 10, // requires 50
        maxTokensPerCycle: 10000,
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Insufficient MCU');
    });

    it('blocks execution when cycle token budget is exceeded', () => {
      const check = canExecuteCapability('content-producer', {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 2000, // requires 8000
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Cycle token limit exceeded');
    });

    it('allows execution when MCU and token bounds are sufficient', () => {
      const check = canExecuteCapability('affiliate-scout', {
        tenantId: 'tenant-test',
        availableMcu: 50,
        maxTokensPerCycle: 5000,
      });
      expect(check.allowed).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it('rejects unknown capabilities with clear error message', () => {
      const check = canExecuteCapability('non-existent-bot' as any, {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 10000,
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Unknown capability');
    });

    it('strictly blocks execution on negative MCU balances', () => {
      const check = canExecuteCapability('auto-publisher', {
        tenantId: 'tenant-test',
        availableMcu: -50,
        maxTokensPerCycle: 10000,
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Insufficient MCU');
    });
  });

  // ── 2. Affiliate Scout Skill Execution & Filter Logic ───────────────────────

  describe('2. Affiliate Scout Skill', () => {
    it('executes affiliate scout task consuming 10 MCU and 2000 tokens', () => {
      const result = executeSwarmTask(baseTask, {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 50000,
      });
      expect(result.success).toBe(true);
      expect(result.capability).toBe('affiliate-scout');
      expect(result.mcuConsumed).toBe(10);
      expect(result.tokensUsed).toBe(2000);
      expect(result.actionsTaken.length).toBeGreaterThanOrEqual(2);
      expect(result.details).toBeDefined();
    });

    it('filters out low-yield offers below EPC $5 or Commission $50', () => {
      const candidates: AffiliateOffer[] = [
        {
          id: 'test-1',
          programName: 'High Yield SaaS',
          network: 'Impact',
          category: 'SaaS',
          epc: 6.5,
          commissionRate: 60,
          commissionType: 'flat',
          landingPageUrl: 'https://example.com/saas',
          tier: 'BASIC',
          highEpcAlert: false,
        },
        {
          id: 'test-2',
          programName: 'Low EPC Banner',
          network: 'CJ Affiliate',
          category: 'E-commerce',
          epc: 1.2,
          commissionRate: 10,
          commissionType: 'flat',
          landingPageUrl: 'https://example.com/low',
          tier: 'BASIC',
          highEpcAlert: false,
        },
      ];

      const res = discoverAffiliateOffers({ candidateOffers: candidates });
      expect(res.totalScanned).toBe(2);
      expect(res.qualifiedOffers.length).toBe(1);
      expect(res.qualifiedOffers[0].id).toBe('test-1');
    });

    it('auto-assigns tiers and triggers high-EPC alerts for programs > $20 EPC', () => {
      expect(classifyAffiliateTier(25.0, 50)).toBe('ENTERPRISE');
      expect(classifyAffiliateTier(5.0, 250)).toBe('ENTERPRISE');
      expect(classifyAffiliateTier(12.0, 50)).toBe('PREMIUM');
      expect(classifyAffiliateTier(5.0, 110)).toBe('PREMIUM');
      expect(classifyAffiliateTier(6.0, 60)).toBe('BASIC');

      const res = discoverAffiliateOffers();
      const highAlerts = res.highEpcAlerts;
      expect(highAlerts.length).toBeGreaterThan(0);
      expect(highAlerts.every((a) => a.epc >= 20.0)).toBe(true);
      expect(highAlerts.every((a) => a.tier === 'ENTERPRISE')).toBe(true);
    });
  });

  // ── 3. Content Producer Skill Execution & Quality Gates ─────────────────────

  describe('3. Content Producer Skill', () => {
    const contentTask: AutonomousScheduleTaskRow = {
      ...baseTask,
      id: 'task-content-prod',
      skill_name: 'content-producer',
      capability_name: 'content-producer',
      schedule_type: 'cron',
      cron_expression: '0 6 * * *',
    };

    it('executes content producer consuming 50 MCU and 8000 tokens', () => {
      const result = executeSwarmTask(contentTask, {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 50000,
      });
      expect(result.success).toBe(true);
      expect(result.capability).toBe('content-producer');
      expect(result.mcuConsumed).toBe(50);
      expect(result.tokensUsed).toBe(8000);
      expect(result.actionsTaken.some((a) => a.includes('ElevenLabs'))).toBe(true);
    });

    it('calculates hook scores accurately based on viral patterns', () => {
      const weakHook = 'Xin chào các bạn';
      const viralHook = 'Bí mật 3 bước AI tự động tạo doanh thu $5,000 thụ động mỗi tháng';
      expect(calculateHookScore(weakHook)).toBeLessThan(60);
      expect(calculateHookScore(viralHook)).toBeGreaterThanOrEqual(70);
      expect(calculateHookScore('')).toBe(0);
    });

    it('generates viral video script satisfying all quality gates', () => {
      const output = generateViralVideoScript({ topic: 'Automated AI Marketing' });
      expect(output.qualityGatesPassed).toBe(true);
      expect(output.qualityMetrics.hookScore).toBeGreaterThanOrEqual(70);
      expect(output.qualityMetrics.wordCount).toBeGreaterThanOrEqual(100);
      expect(output.qualityMetrics.wordCount).toBeLessThanOrEqual(250);
      expect(output.qualityMetrics.estimatedDurationSeconds).toBeGreaterThanOrEqual(50);
      expect(output.qualityMetrics.estimatedDurationSeconds).toBeLessThanOrEqual(110);
      expect(output.videoDraft.scriptVi).toBeTruthy();
      expect(output.videoDraft.scriptEn).toBeTruthy();
      expect(output.videoDraft.voiceoverConfig.provider).toBe('ElevenLabs');
      expect(output.videoDraft.stagingUrl).toContain('r2://');
    });
  });

  // ── 4. Auto-Publisher Skill Execution & Syndication ─────────────────────────

  describe('4. Auto-Publisher Skill', () => {
    const publisherTask: AutonomousScheduleTaskRow = {
      ...baseTask,
      id: 'task-auto-pub',
      skill_name: 'auto-publisher',
      capability_name: 'auto-publisher',
      schedule_type: 'event_driven',
      event_trigger: 'video_ready',
    };

    it('executes auto-publisher consuming 20 MCU and 3000 tokens', () => {
      const result = executeSwarmTask(publisherTask, {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 50000,
      });
      expect(result.success).toBe(true);
      expect(result.capability).toBe('auto-publisher');
      expect(result.mcuConsumed).toBe(20);
      expect(result.tokensUsed).toBe(3000);
      expect(result.actionsTaken.some((a) => a.includes('syndication'))).toBe(true);
    });

    it('builds UTM URLs with consistent tracking params', () => {
      const utm = buildUtmUrl('https://example.com/offer', 'youtube', 'chua_chum_launch');
      expect(utm).toContain('utm_source=youtube');
      expect(utm).toContain('utm_medium=social_syndication');
      expect(utm).toContain('utm_campaign=chua_chum_launch');
    });

    it('generates multi-platform syndication payloads with mandatory affiliate disclosure', () => {
      const syndication = generateMultiPlatformSyndication({
        targetPlatforms: ['youtube', 'tiktok', 'instagram'],
        targetMarkets: ['VN', 'JP'],
      });
      expect(syndication.publishedPayloads.length).toBe(6);
      expect(syndication.syndicationSummary.hasAffiliateDisclosure).toBe(true);

      const yt = syndication.publishedPayloads.find((p) => p.platform === 'youtube');
      expect(yt).toBeDefined();
      expect(yt?.aspectRatio).toBe('16:9');
      expect(yt?.caption).toContain('Tuyên bố tiếp thị');

      const tt = syndication.publishedPayloads.find((p) => p.platform === 'tiktok');
      expect(tt?.aspectRatio).toBe('9:16');
    });
  });

  // ── 5. AGY Governance Policy Gatekeeping ────────────────────────────────────

  describe('5. AGY Governance Policy Integration', () => {
    it('approves execution when action is allowed and within autonomy bounds', () => {
      const check = canExecuteCapability('affiliate-scout', {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 20000,
        agyConfig: sampleAgyConfig,
        requestedAutonomy: 'L1',
      });
      expect(check.allowed).toBe(true);
      expect(check.verdict?.reason).toBe('POLICY_APPROVED');
    });

    it('strictly denies execution when action matches explicit deny rule (deny precedence)', () => {
      const deniedConfig: AgentGovernanceYaml = {
        ...sampleAgyConfig,
        permissions: {
          allow: ['*'], // wildcard allow
          deny: ['affiliate:scrape'], // explicit deny
        },
      };

      const check = canExecuteCapability('affiliate-scout', {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 20000,
        agyConfig: deniedConfig,
      });

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('ACTION_EXPLICITLY_DENIED');
      expect(check.verdict?.escalationTriggered).toBe(true);
    });

    it('denies execution when requested autonomy exceeds agent ceiling', () => {
      const lowAutonomyConfig: AgentGovernanceYaml = {
        ...sampleAgyConfig,
        agent: {
          ...sampleAgyConfig.agent,
          maxAutonomyLevel: 'L1', // Auto-publisher requires L3
        },
      };

      const check = canExecuteCapability('auto-publisher', {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 20000,
        agyConfig: lowAutonomyConfig,
        requestedAutonomy: 'L3',
      });

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('AUTONOMY_LEVEL_EXCEEDED');
      expect(check.verdict?.escalationTriggered).toBe(true);
    });

    it('denies execution when requested compute exceeds agent MCU limit', () => {
      const lowComputeConfig: AgentGovernanceYaml = {
        ...sampleAgyConfig,
        compute: {
          ...sampleAgyConfig.compute,
          maxComputeUnitsMcu: 25, // Content producer requires 50 MCU
        },
      };

      const check = canExecuteCapability('content-producer', {
        tenantId: 'tenant-test',
        availableMcu: 100,
        maxTokensPerCycle: 20000,
        agyConfig: lowComputeConfig,
      });

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('COMPUTE_LIMIT_EXCEEDED');
      expect(check.verdict?.escalationTriggered).toBe(true);
    });
  });

  // ── 6. APAC Peak Time Scheduling Optimizer ──────────────────────────────────

  describe('6. APAC Peak Time Scheduling Optimizer', () => {
    it('verifies all 7 APAC market configurations are properly mapped', () => {
      const markets: ApacMarket[] = ['VN', 'TH', 'ID', 'SG', 'MY', 'JP', 'KR'];
      for (const m of markets) {
        const cfg = APAC_MARKET_CONFIGS[m];
        expect(cfg).toBeDefined();
        expect(cfg.utcOffsetHours).toBeGreaterThanOrEqual(7);
        expect(cfg.utcOffsetHours).toBeLessThanOrEqual(9);
        expect(cfg.peakWindows.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('identifies peak hours in Vietnam (UTC+7: 12:00 local is lunch peak)', () => {
      // 12:00 VN local = 05:00 UTC
      const vnLunchPeakUtc = new Date(Date.UTC(2026, 9, 6, 5, 0, 0));
      expect(isApacPeakTime(vnLunchPeakUtc, 'VN')).toBe(true);

      // 03:00 VN local = 20:00 UTC previous day (off-peak)
      const vnOffPeakUtc = new Date(Date.UTC(2026, 9, 5, 20, 0, 0));
      expect(isApacPeakTime(vnOffPeakUtc, 'VN')).toBe(false);
    });

    it('identifies peak hours in Tokyo (UTC+9: 19:00 local is evening peak)', () => {
      // 19:00 JP local = 10:00 UTC
      const jpEveningPeakUtc = new Date(Date.UTC(2026, 9, 6, 10, 0, 0));
      expect(isApacPeakTime(jpEveningPeakUtc, 'JP')).toBe(true);
    });

    it('calculates next peak slot advancing to the upcoming window when currently off-peak', () => {
      // 09:00 VN local (02:00 UTC) -> Next peak window is lunch peak (11:30 VN local = 04:30 UTC)
      const morningOffPeakUtc = new Date(Date.UTC(2026, 9, 6, 2, 0, 0));
      const nextSlot = calculateNextApacPeakSlot(morningOffPeakUtc, 'VN');

      expect(nextSlot.getUTCHours()).toBe(4);
      expect(nextSlot.getUTCMinutes()).toBe(30);
    });

    it('returns immediate date when already in peak engagement window', () => {
      // 12:30 VN local = 05:30 UTC (inside 11:30-13:30 peak)
      const lunchPeakUtc = new Date(Date.UTC(2026, 9, 6, 5, 30, 0));
      const nextSlot = calculateNextApacPeakSlot(lunchPeakUtc, 'VN');
      expect(nextSlot.getTime()).toBe(lunchPeakUtc.getTime());
    });

    it('rolls over to next day peak window when today evening peak has concluded', () => {
      // 23:30 VN local = 16:30 UTC (after 22:00 peak)
      const lateNightUtc = new Date(Date.UTC(2026, 9, 6, 16, 30, 0));
      const nextSlot = calculateNextApacPeakSlot(lateNightUtc, 'VN');

      // Tomorrow lunch peak at 11:30 VN local = 04:30 UTC on Oct 7
      expect(nextSlot.getUTCDate()).toBe(7);
      expect(nextSlot.getUTCHours()).toBe(4);
      expect(nextSlot.getUTCMinutes()).toBe(30);
    });
  });

  // ── 7. Cycle Telemetry & Metrics Calculator ─────────────────────────────────

  describe('7. Cycle Telemetry & Metrics Calculator', () => {
    it('accurately aggregates metrics for a successful 3-task cycle', () => {
      const startTime = Date.now() - 5000;
      const completedTime = Date.now();

      const telemetry = calculateCycleTelemetry({
        cycleId: 'cycle-test-1',
        tenantId: 'tenant-test',
        startedAt: startTime,
        completedAt: completedTime,
        stateBefore: 'IDLE',
        stateAfter: 'RUNNING',
        taskResults: [
          {
            success: true,
            capability: 'affiliate-scout',
            mcuConsumed: 10,
            tokensUsed: 2000,
            actionsTaken: ['Scanned offers'],
          },
          {
            success: true,
            capability: 'content-producer',
            mcuConsumed: 50,
            tokensUsed: 8000,
            actionsTaken: ['Rendered video'],
          },
          {
            success: true,
            capability: 'auto-publisher',
            mcuConsumed: 20,
            tokensUsed: 3000,
            actionsTaken: ['Published to TikTok'],
          },
        ],
      });

      expect(telemetry.tasksAttempted).toBe(3);
      expect(telemetry.tasksSucceeded).toBe(3);
      expect(telemetry.tasksFailed).toBe(0);
      expect(telemetry.mcuConsumed).toBe(80);
      expect(telemetry.tokensConsumed).toBe(13000);
      expect(telemetry.consciousnessScore).toBe(100);
      expect(telemetry.durationMs).toBe(completedTime - startTime);
      expect(telemetry.errorSummary).toBeNull();
      expect(telemetry.costEstimateUsd).toBeGreaterThan(0);
    });

    it('penalizes consciousness score on task failures and trips', () => {
      const trippedCircuit: CircuitBreakerStatus = {
        serviceOrSkill: 'openrouter',
        state: 'OPEN',
        consecutiveFailures: 5,
        failureThreshold: 5,
        cooldownPeriodMs: 60000,
        lastFailureAt: Date.now(),
        lastStateChangeAt: Date.now(),
      };

      const telemetry = calculateCycleTelemetry({
        cycleId: 'cycle-test-2',
        startedAt: Date.now() - 2000,
        stateBefore: 'RUNNING',
        stateAfter: 'CIRCUIT_BROKEN',
        taskResults: [
          {
            success: false,
            capability: 'content-producer',
            mcuConsumed: 0,
            tokensUsed: 0,
            actionsTaken: [],
            error: 'OpenRouter rate limit exceeded',
          },
        ],
        circuitStatus: trippedCircuit,
      });

      expect(telemetry.tasksFailed).toBe(1);
      expect(telemetry.tasksSucceeded).toBe(0);
      // Base: 0 (0% success), -15 (1 failure), -25 (circuit OPEN) -> clamped to 0
      expect(telemetry.consciousnessScore).toBe(0);
      expect(telemetry.errorSummary).toContain('OpenRouter rate limit exceeded');
    });

    it('handles zero task attempt edge cases with default 100 consciousness', () => {
      const telemetry = calculateCycleTelemetry({
        cycleId: 'cycle-empty',
        startedAt: Date.now() - 50,
        stateBefore: 'IDLE',
        stateAfter: 'IDLE',
        taskResults: [],
      });

      expect(telemetry.tasksAttempted).toBe(0);
      expect(telemetry.consciousnessScore).toBe(100);
      expect(telemetry.mcuConsumed).toBe(0);
      expect(telemetry.tokensConsumed).toBe(0);
    });
  });
});
