/**
 * Re-export shim — AgentTeamPanel
 *
 * P1-2 fix: agents/page.tsx imports from this path instead of
 * deep-mounting into missions/ to avoid the import smell.
 * No logic change — pure re-export.
 */

export { AgentTeamPanel } from '@/forest/components/missions/agent-team-panel';
