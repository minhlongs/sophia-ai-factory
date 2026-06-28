/**
 * Mock data for AgentSessionsClient.
 * Replace with API calls when backend endpoints are available.
 */

import type { AgentSession, AgentTaskAssignment } from '@/seed/types/multi-agent';

export const MOCK_TASKS: AgentTaskAssignment[] = [
  { id: 't-1',  sessionId: 's-1', agentRole: 'script_writer',    stepIndex: 0, status: 'completed', startedAt: Date.now() - 3600000,    completedAt: Date.now() - 3000000, createdAt: Date.now() - 3700000 },
  { id: 't-2',  sessionId: 's-1', agentRole: 'voice_generator',  stepIndex: 1, status: 'running',   startedAt: Date.now() - 2900000,                                       createdAt: Date.now() - 3700000 },
  { id: 't-3',  sessionId: 's-1', agentRole: 'video_producer',   stepIndex: 2, status: 'pending',                                                                          createdAt: Date.now() - 3700000 },
  { id: 't-4',  sessionId: 's-2', agentRole: 'script_writer',    stepIndex: 0, status: 'completed', startedAt: Date.now() - 86400000,   completedAt: Date.now() - 85000000, createdAt: Date.now() - 86500000 },
  { id: 't-5',  sessionId: 's-2', agentRole: 'voice_generator',  stepIndex: 1, status: 'completed', startedAt: Date.now() - 84900000,   completedAt: Date.now() - 83000000, createdAt: Date.now() - 86500000 },
  { id: 't-6',  sessionId: 's-2', agentRole: 'video_producer',   stepIndex: 2, status: 'completed', startedAt: Date.now() - 82900000,   completedAt: Date.now() - 80000000, createdAt: Date.now() - 86500000 },
  { id: 't-7',  sessionId: 's-2', agentRole: 'publisher',        stepIndex: 3, status: 'completed', startedAt: Date.now() - 79900000,   completedAt: Date.now() - 78000000, createdAt: Date.now() - 86500000 },
  { id: 't-8',  sessionId: 's-3', agentRole: 'analyst',          stepIndex: 0, status: 'failed',    startedAt: Date.now() - 172800000,  errorMessage: 'API rate limit exceeded', createdAt: Date.now() - 172900000 },
  { id: 't-9',  sessionId: 's-4', agentRole: 'script_writer',    stepIndex: 0, status: 'running',   startedAt: Date.now() - 600000,                                        createdAt: Date.now() - 700000 },
  { id: 't-10', sessionId: 's-4', agentRole: 'analyst',          stepIndex: 1, status: 'pending',                                                                          createdAt: Date.now() - 700000 },
];

export const MOCK_SESSIONS: AgentSession[] = [
  { id: 's-1', executionId: 'exec-007', supervisorAgent: 'gpt-4o-mini',    status: 'running',   workerCount: 3, completedCount: 1, failedCount: 0, startedAt: Date.now() - 3700000,    createdAt: Date.now() - 3700000 },
  { id: 's-2', executionId: 'exec-006', supervisorAgent: 'claude-3-haiku', status: 'completed', workerCount: 4, completedCount: 4, failedCount: 0, startedAt: Date.now() - 86500000,   completedAt: Date.now() - 78000000, createdAt: Date.now() - 86500000 },
  { id: 's-3', executionId: 'exec-005', supervisorAgent: 'gpt-4o-mini',    status: 'failed',    workerCount: 1, completedCount: 0, failedCount: 1, startedAt: Date.now() - 172900000,  createdAt: Date.now() - 172900000 },
  { id: 's-4', executionId: 'exec-008', supervisorAgent: 'claude-3-haiku', status: 'running',   workerCount: 2, completedCount: 0, failedCount: 0, startedAt: Date.now() - 700000,     createdAt: Date.now() - 700000 },
];
