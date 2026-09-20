/**
 * Integration Test Suite: Organization Invitation Lifecycle & Atomic Consumption
 *
 * Exercises the end-to-end invitation flow against an in-memory D1 SQLite database:
 * 1. Creation, hashing, and database persistence
 * 2. Seat quota enforcement (pre-flight and post-flight)
 * 3. Atomic consumption & single-use guarantee (anti-double-consumption)
 * 4. Expiration handling (7-day TTL enforcement)
 * 5. Revocation flow
 *
 * @module __tests__/integration/enterprise/org-invitations-integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  createOrgInvitation,
  acceptOrgInvitation,
  revokeOrgInvitation,
} from '@/tree/organizations/invitation-service';
import { sha256Hex } from '@/seed/security/invitation-token';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Organization Invitations Integration Suite', () => {
  let rawDb: any;
  let db: any;
  const ownerUserId = 'usr_owner_founder';
  const orgId = 'org_enterprise_integration';

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        tier TEXT NOT NULL DEFAULT 'pro',
        max_seats INTEGER NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE organization_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (org_id, user_id)
      );

      CREATE TABLE org_invitations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER,
        created_by TEXT NOT NULL,
        invited_by TEXT GENERATED ALWAYS AS (created_by) VIRTUAL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE VIEW IF NOT EXISTS organization_invitations AS SELECT * FROM org_invitations;

      INSERT INTO organizations (id, name, slug, tier, max_seats)
      VALUES ('${orgId}', 'Enterprise Test Org', 'ent-test', 'pro', 5);

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES ('mem_owner', '${orgId}', '${ownerUserId}', 'owner', 1000, 1000);
    `);
    db = makeD1(rawDb);
  });

  it('generates invitation with SHA-256 hash storage and returns single-use token', async () => {
    const invite = await createOrgInvitation(db, {
      orgId,
      email: '  CreativeLead@Agency.com  ',
      role: 'creator',
      invitedByUserId: ownerUserId,
    });

    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invite.inviteUrl).toContain(`token=${invite.token}`);

    // Verify database row
    const tokenHash = await sha256Hex(invite.token);
    const row = rawDb
      .prepare('SELECT * FROM org_invitations WHERE id = ?')
      .get(invite.invitationId) as any;

    expect(row).toBeDefined();
    expect(row.org_id).toBe(orgId);
    expect(row.email).toBe('creativelead@agency.com'); // Lowercased and trimmed
    expect(row.role).toBe('creator');
    expect(row.token_hash).toBe(tokenHash);
    expect(row.status).toBe('pending');
    expect(row.expires_at).toBeGreaterThan(Date.now());
  });

  it('accepts invitation, adds member, and transitions status to accepted', async () => {
    const invite = await createOrgInvitation(db, {
      orgId,
      email: 'invitee@agency.com',
      role: 'admin',
      invitedByUserId: ownerUserId,
    });

    const result = await acceptOrgInvitation(db, invite.token, 'usr_new_admin');
    expect(result.success).toBe(true);
    expect(result.orgId).toBe(orgId);
    expect(result.role).toBe('admin');

    // Verify member in database
    const memberRow = rawDb
      .prepare('SELECT * FROM organization_members WHERE user_id = ?')
      .get('usr_new_admin') as any;

    expect(memberRow).toBeDefined();
    expect(memberRow.org_id).toBe(orgId);
    expect(memberRow.role).toBe('admin');

    // Verify invitation status
    const invRow = rawDb
      .prepare('SELECT * FROM org_invitations WHERE id = ?')
      .get(invite.invitationId) as any;

    expect(invRow.status).toBe('accepted');
    expect(invRow.accepted_at).toBeGreaterThan(0);
  });

  it('enforces single-use invariant: re-accepting consumed token throws INVITATION_ALREADY_USED', async () => {
    const invite = await createOrgInvitation(db, {
      orgId,
      email: 'singleuse@agency.com',
      role: 'creator',
      invitedByUserId: ownerUserId,
    });

    await acceptOrgInvitation(db, invite.token, 'usr_first');

    await expect(
      acceptOrgInvitation(db, invite.token, 'usr_second'),
    ).rejects.toThrow(/INVITATION_ALREADY_USED/);
  });

  it('rejects expired invitation tokens and marks status expired', async () => {
    const invite = await createOrgInvitation(db, {
      orgId,
      email: 'late@agency.com',
      role: 'viewer',
      invitedByUserId: ownerUserId,
    });

    // Artificially expire
    rawDb
      .prepare('UPDATE org_invitations SET expires_at = ? WHERE id = ?')
      .run(Date.now() - 10000, invite.invitationId);

    await expect(
      acceptOrgInvitation(db, invite.token, 'usr_late'),
    ).rejects.toThrow(/INVITATION_EXPIRED/);

    const invRow = rawDb
      .prepare('SELECT status FROM org_invitations WHERE id = ?')
      .get(invite.invitationId) as any;

    expect(invRow.status).toBe('expired');
  });

  it('enforces seat quota: blocks invitation creation when quota is reached', async () => {
    // Pro tier has 5 seats. Owner occupies 1. Fill 4 seats.
    for (let i = 2; i <= 5; i++) {
      rawDb
        .prepare(
          'INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(`mem_${i}`, orgId, `usr_${i}`, 'creator', 1000, 1000);
    }

    await expect(
      createOrgInvitation(db, {
        orgId,
        email: 'overflow@agency.com',
        role: 'viewer',
        invitedByUserId: ownerUserId,
      }),
    ).rejects.toThrow(/SEAT_QUOTA_EXCEEDED/);
  });

  it('revokes an invitation and blocks subsequent acceptance', async () => {
    const invite = await createOrgInvitation(db, {
      orgId,
      email: 'revoked@agency.com',
      role: 'creator',
      invitedByUserId: ownerUserId,
    });

    const revoked = await revokeOrgInvitation(db, invite.invitationId, orgId);
    expect(revoked).toBe(true);

    await expect(
      acceptOrgInvitation(db, invite.token, 'usr_revoked_actor'),
    ).rejects.toThrow(/INVITATION_ALREADY_USED/);
  });
});
