/**
 * Multi-Org Financial Close Orchestrator & Intercompany Settlement Engine
 *
 * Facade providing 100% backward compatibility for the modularized financial close submodules.
 * Layer: tree (Pure domain logic, depends only on @/seed and @/tree)
 *
 * @module tree/finance/financial-close-orchestrator
 */

export * from './close';
