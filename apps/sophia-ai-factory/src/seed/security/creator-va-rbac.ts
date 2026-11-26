/**
 * Creator-to-VA Workspace RBAC with Immutable Affiliate-Link Locking.
 *
 * Clean-room field-level authorization (MIT pattern from stalniy/casl and
 * ottabase/ottabase): lets VAs/editors draft scripts and render videos while
 * strictly locking referralUrl, shortCode, publish, and delete_offer to the
 * workspace owner — preventing affiliate link hijacking.
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

const LOCKED_OWNER_FIELDS = new Set(['referralUrl', 'referral_url', 'shortCode', 'short_code']);

const ROLE_ACTIONS: Record<WorkspaceRole, ReadonlySet<WorkspaceAction>> = {
  owner: new Set([
    'draft_script',
    'render_video',
    'edit_referral_url',
    'publish_campaign',
    'delete_offer',
    'view_analytics',
  ]),
  va_editor: new Set(['draft_script', 'render_video', 'view_analytics']),
  viewer: new Set(['view_analytics']),
};

export function canPerformWorkspaceAction(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return ROLE_ACTIONS[role].has(action);
}

export function assertFieldsMutableByRole(
  role: WorkspaceRole,
  mutatedFields: readonly string[],
): { readonly allowed: boolean; readonly blockedFields: readonly string[] } {
  if (role === 'owner') {
    return { allowed: true, blockedFields: [] };
  }
  if (role === 'viewer') {
    return { allowed: false, blockedFields: [...mutatedFields] };
  }
  const blocked = mutatedFields.filter((f) => LOCKED_OWNER_FIELDS.has(f));
  return { allowed: blocked.length === 0, blockedFields: blocked };
}
