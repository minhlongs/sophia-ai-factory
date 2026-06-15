/**
 * Cmd+K Action Types
 *
 * Defines the CmdKAction interface and action group categories.
 * Actions are sourced from: pages (static), SOPs (dynamic), missions (dynamic), admin (role-gated).
 *
 * @module components/cmd-k/cmd-k-action-types
 */

export type ActionGroup = 'pages' | 'sops' | 'missions' | 'admin';

export interface CmdKAction {
  id: string;
  label: string;
  /** Short text shown next to label (e.g. key hint or description) */
  description?: string;
  group: ActionGroup;
  /** Handler invoked when user selects this action */
  onSelect: () => void;
  /** If true, only visible to admin users */
  adminOnly?: boolean;
}
