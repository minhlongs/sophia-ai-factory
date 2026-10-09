/**
 * Partner Analytics Export Engine
 *
 * Facade providing 100% backward compatibility for the modularized partner export submodules.
 * Layer: tree/partners (Pure domain formatting — edge compatible, zero Node-only deps)
 * Dependencies: @/seed and @/tree only
 *
 * @module tree/partners/export-formatter
 */

export * from './export';
