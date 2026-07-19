import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextStateManager } from '../context-state-manager';
import { promises as fs } from 'fs';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
});

describe('ContextStateManager', () => {
  const sessionId = 'test-session-123';
  const workDir = '/tmp/orchestrator';
  let manager: ContextStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ContextStateManager(sessionId, workDir);
  });

  it('should initialize with default state', () => {
    const state = manager.getState();
    expect(state.sessionId).toBe(sessionId);
    expect(state.phase).toBe('setup');
    expect(state.goal).toBe('Initializing...');
    expect(state.decisions).toEqual({});
  });

  it('should update goal', () => {
    manager.updateGoal('Build a house');
    expect(manager.getState().goal).toBe('Build a house');
  });

  it('should advance phase', () => {
    manager.advancePhase('execution');
    expect(manager.getState().phase).toBe('execution');
  });

  it('should record decisions', () => {
    manager.recordDecision('framework', 'Next.js');
    expect(manager.getState().decisions['framework']).toBe('Next.js');
  });

  it('should record agent results', () => {
    manager.recordAgentResult('researcher', 'Found a great library');
    const state = manager.getState();
    expect(state.lastAgentResult).toBeDefined();
    expect(state.lastAgentResult?.agent).toBe('researcher');
    expect(state.lastAgentResult?.summary).toBe('Found a great library');
    expect(state.lastAgentResult?.timestamp).toBeDefined();
  });

  it('should save state to file', async () => {
    manager.updateGoal('Save test');
    await manager.save();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(`.orchestrator-state-${sessionId}.json`),
      expect.stringContaining('Save test'),
      expect.any(String)
    );
  });

  it('should load state from file if it exists', async () => {
    const savedState = {
      sessionId,
      goal: 'Loaded Goal',
      phase: 'testing',
      completedSteps: ['step1'],
      pendingSteps: ['step2'],
      decisions: { key: 'val' },
      turnBudget: 5,
    };
    (fs.readFile as any).mockResolvedValue(JSON.stringify(savedState));

    await manager.load();
    expect(manager.getState().goal).toBe('Loaded Goal');
    expect(manager.getState().phase).toBe('testing');
    expect(manager.getState().decisions['key']).toBe('val');
  });

  it('should use default state if load fails', async () => {
    (fs.readFile as any).mockRejectedValue(new Error('File not found'));
    await manager.load();
    expect(manager.getState().goal).toBe('Initializing...');
  });

  it('should generate a correct state summary', () => {
    manager.updateGoal('Summary Test');
    manager.advancePhase('review');
    manager.recordDecision('color', 'blue');

    const state = manager.getState();
    state.completedSteps = ['init', 'design'];

    const summary = manager.getStateSummary();
    expect(summary).toContain('[Phase: review]');
    expect(summary).toContain('[Goal: Summary Test]');
    expect(summary).toContain('Completed: init, design');
    expect(summary).toContain('Decisions: color: blue');
  });

  it('should generate a correct system context string', () => {
    manager.updateGoal('Context Test');
    manager.advancePhase('implementation');
    manager.recordDecision('db', 'D1');

    const state = manager.getState();
    state.pendingSteps = ['code', 'test'];

    const context = manager.getSystemContext();
    expect(context).toContain('Goal: Context Test');
    expect(context).toContain('Current Phase: implementation');
    expect(context).toContain('Pending Steps: code, test');
    expect(context).toContain('"db": "D1"');
    expect(context).toContain('Bounded state mode');
  });
});
