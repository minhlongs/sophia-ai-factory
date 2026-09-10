import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccountOwnershipDetails,
  getSupportAccessState,
  toggleSupportAccess,
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
} from '../ownership-management';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({
  first: mockFirst,
  all: mockAll,
  run: mockRun,
}));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

describe('Account Ownership & Administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccountOwnershipDetails', () => {
    it('returns owner details for user with OWNER role', async () => {
      mockFirst
        .mockResolvedValueOnce({ id: 'om_1', org_id: 'org_abc', role: 'owner', org_name: 'Agency Alpha' })
        .mockResolvedValueOnce(null); // support access

      const res = await getAccountOwnershipDetails('usr_1');

      expect(res.isOwner).toBe(true);
      expect(res.role).toBe('OWNER');
      expect(res.orgId).toBe('org_abc');
      expect(res.orgName).toBe('Agency Alpha');
      expect(res.supportAccess.enabled).toBe(false);
    });

    it('returns editor details for non-owner member', async () => {
      mockFirst
        .mockResolvedValueOnce({ id: 'om_2', org_id: 'org_abc', role: 'editor', org_name: 'Agency Alpha' })
        .mockResolvedValueOnce(null);

      const res = await getAccountOwnershipDetails('usr_2');

      expect(res.isOwner).toBe(false);
      expect(res.role).toBe('EDITOR');
    });
  });

  describe('toggleSupportAccess', () => {
    it('enables temporary support access for 24h', async () => {
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const res = await toggleSupportAccess('usr_1', 'org_abc', true);

      expect(res.enabled).toBe(true);
      expect(res.grantedBy).toBe('usr_1');
      expect(res.expiresAt).not.toBeNull();
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('tenant_settings'));
    });

    it('disables support access', async () => {
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const res = await toggleSupportAccess('usr_1', 'org_abc', false);

      expect(res.enabled).toBe(false);
      expect(res.expiresAt).toBeNull();
    });
  });

  describe('listTeamMembers', () => {
    it('lists all members for an org', async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          { id: 'm1', org_id: 'org_abc', user_id: 'u1', role: 'owner', created_at: '2026-01-01', email: 'owner@a.com' },
          { id: 'm2', org_id: 'org_abc', user_id: 'u2', role: 'editor', created_at: '2026-01-02', email: 'ed@a.com' },
        ],
      });

      const members = await listTeamMembers('usr_1', 'org_abc');

      expect(members).toHaveLength(2);
      expect(members[0].role).toBe('OWNER');
      expect(members[1].role).toBe('EDITOR');
    });
  });

  describe('invite, update, and remove members', () => {
    it('invites a new member with specified role', async () => {
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const newMember = await inviteTeamMember('usr_1', 'org_abc', 'new@a.com', 'VIEWER');

      expect(newMember.email).toBe('new@a.com');
      expect(newMember.role).toBe('VIEWER');
      expect(newMember.orgId).toBe('org_abc');
    });

    it('updates a member role', async () => {
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const success = await updateTeamMemberRole('usr_1', 'org_abc', 'm2', 'EDITOR');

      expect(success).toBe(true);
      expect(mockBind).toHaveBeenCalledWith('editor', 'm2', 'org_abc');
    });

    it('removes a team member', async () => {
      mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

      const success = await removeTeamMember('usr_1', 'org_abc', 'm2');

      expect(success).toBe(true);
      expect(mockBind).toHaveBeenCalledWith('m2', 'org_abc');
    });
  });
});
