import { promises as fs } from 'fs';
import path from 'path';
import { BlackboardStore, type BlackboardEntry } from './blackboard-store';

export interface Turn {
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  agent?: string;
  timestamp: number;
}

export interface OrchestratorState {
  sessionId: string;
  goal: string;
  phase: string;
  completedSteps: string[];
  pendingSteps: string[];
  decisions: Record<string, string>; // Legacy decisions for backward compatibility
  blackboardState?: string; // Serialized BlackboardStore
  lastAgentResult?: { agent: string; summary: string; timestamp: number };
  turnBudget: number;
}

export class ContextStateManager {
  private state: OrchestratorState;
  private statePath: string;
  public blackboard: BlackboardStore;

  constructor(sessionId: string, workDir: string) {
    this.statePath = path.join(workDir, `.orchestrator-state-${sessionId}.json`);
    this.blackboard = new BlackboardStore(sessionId);
    this.state = {
      sessionId,
      goal: 'Initializing...',
      phase: 'setup',
      completedSteps: [],
      pendingSteps: [],
      decisions: {},
      turnBudget: 3,
    };
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      this.state = JSON.parse(data);
      if (this.state.blackboardState) {
        this.blackboard.importState(this.state.blackboardState);
      }
    } catch (error) {
      // If file doesn't exist, use default state
    }
  }

  async save(): Promise<void> {
    this.state.blackboardState = this.blackboard.exportState();
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  updateGoal(goal: string): void {
    this.state.goal = goal;
  }

  advancePhase(phase: string): void {
    this.state.phase = phase;
  }

  recordDecision(key: string, value: string): void {
    this.state.decisions[key] = value;
    this.writeToBlackboard(key, value, 'decision');
  }

  writeToBlackboard(key: string, value: string, type: BlackboardEntry['type'], turnId: string = 'unknown'): void {
    this.blackboard.write({
      key,
      value,
      type,
      turnId,
      pinned: false,
    });
  }

  recordAgentResult(agent: string, summary: string): void {
    this.state.lastAgentResult = {
      agent,
      summary,
      timestamp: Date.now(),
    };
  }

  getBlackboardSnapshot(): string {
    const pinned = this.blackboard.getPinned();
    const all = this.blackboard.readByType('decision')
      .concat(this.blackboard.readByType('constraint'))
      .concat(this.blackboard.readByType('finding'));

    // Remove duplicates (pinned items are already in all)
    const uniqueEntries = Array.from(new Map(all.map(e => [e.key, e])).values());

    if (uniqueEntries.length === 0) return 'No active facts on blackboard.';

    return uniqueEntries
      .map(e => `[${e.type.toUpperCase()}] ${e.key} = ${e.value}${e.pinned ? ' (pinned)' : ''}`)
      .join('\n');
  }

  getStateSummary(): string {
    const decisionsStr = Object.entries(this.state.decisions)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return `Current Status: [Phase: ${this.state.phase}] [Goal: ${this.state.goal}] ` +
           `Completed: ${this.state.completedSteps.join(', ') || 'none'}. ` +
           `Decisions: ${decisionsStr || 'none'}.`;
  }

  seedPrompt(): string {
    return `
# ORCHESTRATOR SYSTEM PROMPT
Goal: ${this.state.goal}
Current Phase: ${this.state.phase}
Pending Steps: ${this.state.pendingSteps.join(', ') || 'none'}

## BLACKBOARD STATE (FACT STORE)
${this.getBlackboardSnapshot()}

## CONSTRAINTS
Bounded state mode. Only last ${this.state.turnBudget} turns are provided.
    `.trim();
  }

  getSystemContext(): string {
    // Maintaining for backward compatibility, but seedPrompt is preferred
    return this.seedPrompt();
  }

  getState(): OrchestratorState {
    return this.state;
  }
}
