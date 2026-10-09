/**
 * Optimistic Concurrency Control (OCC) CAS Engine — Sophia AI Factory (Root Facade).
 *
 * Atomic Compare-And-Swap (CAS) state updates on `playbook_patterns` and
 * mission lifecycle transitions (`completed` -> `learning` -> `iterating`).
 *
 * Layer: tree (domain reusable — only imports from @/seed).
 *
 * @module tree/learning-loop/scoring-cas
 */

export * from './cas';
