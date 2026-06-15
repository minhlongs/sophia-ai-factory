/**
 * Mock data for ConfidenceMonitorClient.
 * Replace with API calls when backend endpoints are available.
 */

import type { ConfidenceScore, EscalationRequest } from '@/seed/types/confidence';

export const MOCK_SCORES: ConfidenceScore[] = [
  { id: 'cs-1', executionId: 'exec-001', stepIndex: 0, score: 0.91, factors: { outputLength: 0.95, errorRate: 0.98, latencyRatio: 0.88, toolReliability: 0.93 }, createdAt: Date.now() - 86400000 * 6 },
  { id: 'cs-2', executionId: 'exec-002', stepIndex: 1, score: 0.74, factors: { outputLength: 0.78, errorRate: 0.72, latencyRatio: 0.76, toolReliability: 0.70 }, createdAt: Date.now() - 86400000 * 5 },
  { id: 'cs-3', executionId: 'exec-003', stepIndex: 0, score: 0.85, factors: { outputLength: 0.87, errorRate: 0.90, latencyRatio: 0.82, toolReliability: 0.81 }, createdAt: Date.now() - 86400000 * 4 },
  { id: 'cs-4', executionId: 'exec-004', stepIndex: 2, score: 0.62, factors: { outputLength: 0.60, errorRate: 0.65, latencyRatio: 0.63, toolReliability: 0.60 }, createdAt: Date.now() - 86400000 * 3 },
  { id: 'cs-5', executionId: 'exec-005', stepIndex: 1, score: 0.88, factors: { outputLength: 0.90, errorRate: 0.92, latencyRatio: 0.85, toolReliability: 0.85 }, createdAt: Date.now() - 86400000 * 2 },
  { id: 'cs-6', executionId: 'exec-006', stepIndex: 3, score: 0.79, factors: { outputLength: 0.80, errorRate: 0.82, latencyRatio: 0.77, toolReliability: 0.77 }, createdAt: Date.now() - 86400000 },
  { id: 'cs-7', executionId: 'exec-007', stepIndex: 0, score: 0.93, factors: { outputLength: 0.96, errorRate: 0.97, latencyRatio: 0.90, toolReliability: 0.89 }, createdAt: Date.now() },
];

export const MOCK_ESCALATIONS: EscalationRequest[] = [
  { id: 'esc-1', executionId: 'exec-002', stepIndex: 1, reason: 'Output length below expected threshold', status: 'approved', resolvedBy: 'admin@sophia.ai', resolvedAt: Date.now() - 86400000 * 4, createdAt: Date.now() - 86400000 * 5 },
  { id: 'esc-2', executionId: 'exec-004', stepIndex: 2, reason: 'Tool reliability dropped below 0.65', status: 'pending', createdAt: Date.now() - 86400000 * 3 },
  { id: 'esc-3', executionId: 'exec-008', stepIndex: 0, reason: 'Error rate exceeded acceptable limits', status: 'rejected', resolvedBy: 'admin@sophia.ai', resolvedAt: Date.now() - 86400000, createdAt: Date.now() - 86400000 * 2 },
  { id: 'esc-4', executionId: 'exec-009', stepIndex: 1, reason: 'Latency ratio anomaly detected', status: 'auto_resolved', resolvedAt: Date.now() - 3600000, createdAt: Date.now() - 86400000 },
  { id: 'esc-5', executionId: 'exec-010', stepIndex: 3, reason: 'Composite confidence score below 0.70', status: 'pending', createdAt: Date.now() - 1800000 },
];
