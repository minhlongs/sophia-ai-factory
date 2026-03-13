/**
 * AGI SOPs API Client
 * Client for interacting with AGI SOPs Python backend
 */

import type {
  SOP,
  SOPListResponse,
  ExecutionResult,
  PlanRequest,
  PlanResponse,
  SearchResponse,
} from '../types/agi-sops';

const AGI_SOPS_API = '/api/agi-sops';

export class AgiSopsClient {
  /**
   * List all available SOPs
   */
  static async listSops(): Promise<SOPListResponse> {
    const res = await fetch(`${AGI_SOPS_API}/sops`);
    if (!res.ok) {
      throw new Error('Failed to list SOPs');
    }
    return res.json();
  }

  /**
   * Get SOP details by name
   */
  static async getSop(name: string, version?: string): Promise<SOP> {
    const url = new URL(`${AGI_SOPS_API}/sops/${encodeURIComponent(name)}`);
    if (version) {
      url.searchParams.set('version', version);
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to get SOP: ${name}`);
    }
    return res.json();
  }

  /**
   * Create a new SOP
   */
  static async createSop(name: string): Promise<SOP> {
    const res = await fetch(`${AGI_SOPS_API}/sops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create SOP: ${name}`);
    }
    return res.json();
  }

  /**
   * Run an SOP by name
   */
  static async runSop(name: string, version?: string): Promise<ExecutionResult> {
    const res = await fetch(`${AGI_SOPS_API}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, version }),
    });
    if (!res.ok) {
      throw new Error(`Failed to run SOP: ${name}`);
    }
    return res.json();
  }

  /**
   * Cook - Execute SOP to achieve a goal
   */
  static async cook(goal: string, options?: { verbose?: boolean; dryRun?: boolean }): Promise<ExecutionResult> {
    const res = await fetch(`${AGI_SOPS_API}/cook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, ...options }),
    });
    if (!res.ok) {
      throw new Error(`Failed to cook: ${goal}`);
    }
    return res.json();
  }

  /**
   * Generate a plan for a goal
   */
  static async plan(goal: string): Promise<PlanResponse> {
    const res = await fetch(`${AGI_SOPS_API}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal } satisfies PlanRequest),
    });
    if (!res.ok) {
      throw new Error(`Failed to plan: ${goal}`);
    }
    return res.json();
  }

  /**
   * Search SOPs with semantic search
   */
  static async search(query: string, limit = 5): Promise<SearchResponse> {
    const url = new URL(`${AGI_SOPS_API}/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', limit.toString());
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to search: ${query}`);
    }
    return res.json();
  }
}
