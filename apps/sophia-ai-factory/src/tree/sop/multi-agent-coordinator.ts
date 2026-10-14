/**
 * Multi-Agent Coordinator Facade
 *
 * Layer: tree (domain-reusable, imports seed only)
 * Preserves 100% backward compatibility for all callers.
 */

export * from './coordinator/index';
export { saveCheckpoint, loadCheckpoint } from './multi-agent-coordinator-checkpoint';
