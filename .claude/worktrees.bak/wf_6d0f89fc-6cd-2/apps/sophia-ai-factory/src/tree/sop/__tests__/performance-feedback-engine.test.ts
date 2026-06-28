import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createFeedbackCycle,
  evaluatePerformance,
  suggestOptimization,
  applyOptimization,
  runPerformanceFeedbackAndOptimization
} from '../performance-feedback-engine'

// Mock D1 client
function makeD1Mock(overrides?: {
  runResult?: unknown
  firstResult?: unknown
  allResult?: unknown
}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue(overrides?.runResult ?? { success: true }),
    first: vi.fn().mockResolvedValue(overrides?.firstResult ?? null),
    all: vi.fn().mockResolvedValue(overrides?.allResult ?? { results: [] }),
  }
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  }
  return { db, stmt }
}

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/seed/utils/to-error', () => ({
  getErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
}))

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn().mockResolvedValue('mock-api-key'),
}))

// Global fetch mock
const globalFetch = global.fetch;

async function getD1Mock() {
  const { getD1 } = await import('@/seed/db/client')
  return getD1 as ReturnType<typeof vi.fn>
}

describe('performance-feedback-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = globalFetch;
  })

  describe('createFeedbackCycle', () => {
    it('should insert a pending feedback cycle into D1', async () => {
      const { db, stmt } = makeD1Mock()
      const mock = await getD1Mock()
      mock.mockReturnValue(db)

      const id = await createFeedbackCycle({
        executionId: 'exec-1',
        sopId: 'sop-1',
        userId: 'user-1',
        publishedAt: 1000000,
      })

      expect(id).toBeDefined()
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO performance_feedback_cycles'))
      expect(stmt.bind).toHaveBeenCalledWith(id, 'exec-1', 'sop-1', 'user-1', 1000000, 1000000 + 604800, expect.any(Number))
      expect(stmt.run).toHaveBeenCalledOnce()
    })
  })

  describe('evaluatePerformance', () => {
    it('should update status and metrics/evaluation JSON', async () => {
      const { db, stmt } = makeD1Mock()
      const mock = await getD1Mock()
      mock.mockReturnValue(db)

      const metrics = {
        actual_views: 120,
        expected_views: 100,
        actual_engagement: 15,
        expected_engagement: 10,
        actual_revenue: 0,
        expected_revenue: 0,
      }

      const result = await evaluatePerformance('cycle-1', metrics)

      expect(result.overallScore).toBeCloseTo(0.66) // (1.2 * 0.3 + 1.5 * 0.2)
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SET status = \'completed\''))
      expect(stmt.bind).toHaveBeenCalledWith(JSON.stringify(metrics), expect.any(String), 'cycle-1')
      expect(stmt.run).toHaveBeenCalledOnce()
    })
  })

  describe('suggestAndApplyOptimization', () => {
    it('should suggest optimization and apply it successfully', async () => {
      const { db, stmt } = makeD1Mock()
      const mock = await getD1Mock()
      mock.mockReturnValue(db)

      const optId = await suggestOptimization({
        cycleId: 'cycle-1',
        sopId: 'sop-1',
        stepIndex: 1,
        originalPrompt: 'old prompt',
        suggestedPrompt: 'new prompt',
        improvementScore: 0.2,
      })

      expect(optId).toBeDefined()
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO prompt_optimization_log'))
      expect(stmt.run).toHaveBeenCalledOnce()

      await applyOptimization(optId)
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE prompt_optimization_log SET applied = 1'))
    })
  })

  describe('runPerformanceFeedbackAndOptimization', () => {
    it('should process pending cycles, evaluate performance and generate LLM suggestions', async () => {
      const mockPendingCycle = {
        id: 'cycle-100',
        executionId: 'exec-100',
        sopId: 'sop-100',
        userId: 'user-100',
        publishedAt: 1000000,
        evaluateAt: 1000000 + 604800,
        status: 'pending',
      }

      const mockStats = {
        total_views: 150,
        total_likes: 20,
        total_comments: 5,
        total_shares: 5,
      }

      const mockTemplate = {
        steps_json: JSON.stringify([
          { name_en: 'Step 1', tool: 'ai-script', config: { prompt: 'Write a script' } },
        ]),
      }

      // Mock D1 response chain
      const stmtFirst = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn()
          .mockResolvedValueOnce(mockStats)     // first query: stats
          .mockResolvedValueOnce(mockTemplate),  // second query: template
      }

      const stmtAll = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [mockPendingCycle] }), // getPendingEvaluations
      }

      const stmtRun = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }), // insert/update queries
      }

      const db = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT * FROM performance_feedback_cycles')) {
            return stmtAll;
          }
          if (sql.includes('SELECT SUM(views)') || sql.includes('SELECT steps_json')) {
            return stmtFirst;
          }
          return stmtRun;
        }),
      }

      const mockD1 = await getD1Mock()
      mockD1.mockReturnValue(db)

      // Mock fetch for OpenRouter API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  optimizations: [
                    { step_index: 0, suggested_prompt: 'Optimized script prompt' }
                  ]
                })
              }
            }
          ]
        })
      });
      global.fetch = mockFetch;

      const processed = await runPerformanceFeedbackAndOptimization()
      expect(processed).toBe(1)
      expect(mockFetch).toHaveBeenCalledOnce()
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE performance_feedback_cycles'))
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO prompt_optimization_log'))
    })
  })
})
