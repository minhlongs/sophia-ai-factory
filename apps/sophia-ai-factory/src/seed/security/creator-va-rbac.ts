/**
 * Creator-to-VA Workspace RBAC with Immutable Affiliate-Link Locking.
 *
 * Clean-room fail-closed field-level authorization (MIT pattern from stalniy/casl
 * and ottabase/ottabase): uses an explicit allowlist of mutable fields for
 * `va_editor` and fails closed for any unknown role or non-allowlisted field.
 *
 * Layer: seed/security (pure isomorphic policy, zero external deps)
 *
 * @module seed/security/creator-va-rbac
 */

export type WorkspaceRole = 'owner' | 'va_editor' | 'viewer';

export type WorkspaceAction =
  | 'draft_script'
  | 'render_video'
  | 'edit_referral_url'
  | 'publish_campaign'
  | 'delete_offer'
  | 'view_analytics';

/** Explicit allowlist of fields a VA/editor is permitted to mutate. */
const VA_MUTABLE_FIELDS = new Set([
  'title',
  'hook',
  'script',
  'scenes',
  'caption',
  'videoDraft',
  'thumbnailDraft',
]);

const ROLE_ACTIONS = new Map<WorkspaceRole, ReadonlySet<WorkspaceAction>>([
  [
    'owner',
    new Set<WorkspaceAction>([
      'draft_script',
      'render_video',
      'edit_referral_url',
      'publish_campaign',
      'delete_offer',
      'view_analytics',
    ]),
  ],
  ['va_editor', new Set<WorkspaceAction>(['draft_script', 'render_video', 'view_analytics'])],
  ['viewer', new Set<WorkspaceAction>(['view_analytics'])],
]);

export function canPerformWorkspaceAction(role: WorkspaceRole, action: WorkspaceAction): boolean {
  const allowed = ROLE_ACTIONS.get(role);
  return allowed ? allowed.has(action) : false;
}

export function assertFieldsMutableByRole(
  role: WorkspaceRole,
  mutatedFields: readonly string[],
): { readonly allowed: boolean; readonly blockedFields: readonly string[] } {
  if (role === 'owner') {
    return { allowed: true, blockedFields: [] };
  }
  if (role === 'va_editor') {
    const blocked = mutatedFields.filter((f) => !VA_MUTABLE_FIELDS.has(f.trim()));
    return { allowed: blocked.length === 0, blockedFields: blocked };
  }
  return { allowed: false, blockedFields: [...mutatedFields] };
}
