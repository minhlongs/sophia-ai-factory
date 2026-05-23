/**
 * Performance Feedback Loop — shared types.
 * Layer: seed (primitives — no domain logic here)
 */

export type FeedbackStatus = 'pending' | 'evaluating' | 'completed' | 'skipped'

export interface EvaluationResult {
  overallScore: number
  viewsVsExpected: number
  engagementVsExpected: number
  revenueVsExpected: number
  recommendations: string[]
}

export interface FeedbackCycle {
  id: string
  executionId: string
  sopId: string
  userId: string
  publishedAt: number
  evaluateAt: number
  status: FeedbackStatus
  metrics?: Record<string, number>
  evaluation?: EvaluationResult
  createdAt: number
}

export interface PromptOptimization {
  id: string
  cycleId: string
  sopId: string
  stepIndex: number
  originalPrompt: string
  suggestedPrompt: string
  improvementScore?: number
  applied: boolean
  appliedAt?: number
  createdAt: number
}
