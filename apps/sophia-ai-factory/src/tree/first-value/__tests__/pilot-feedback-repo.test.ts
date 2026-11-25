// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  listPilotFeedbackForUser,
  recordPilotFeedback,
} from '@/tree/first-value/pilot-state-repo';

describe('listPilotFeedbackForUser', () => {
  it('returns status and operatorReply when columns exist and falls back cleanly on legacy schema', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-fb-repo-'));
    try {
      const dbPath = path.join(tmpDir, 'legacy.sqlite');
      const d1 = new NodeSqliteD1Database(dbPath) as unknown as D1Database;
      await d1.exec(`
        CREATE TABLE pilot_feedback (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          artifact_id TEXT,
          rating INTEGER NOT NULL,
          category TEXT NOT NULL,
          comment TEXT NOT NULL,
          created_at_iso TEXT NOT NULL
        );
      `);

      await recordPilotFeedback(d1, {
        orgId: 'org_1',
        userId: 'u_1',
        rating: 4,
        category: 'usefulness',
        comment: 'Legacy row',
        nowIso: '2026-11-25T10:00:00.000Z',
      });

      // Legacy fallback path (no status/operator_reply columns)
      const legacyItems = await listPilotFeedbackForUser(d1, { orgId: 'org_1', userId: 'u_1' });
      expect(legacyItems).toHaveLength(1);
      expect(legacyItems[0]?.status).toBe('received');
      expect(legacyItems[0]?.operatorReply).toBeNull();

      // Upgraded schema path with status + operator_reply + resolved_at_iso
      await d1.exec(`
        ALTER TABLE pilot_feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'received';
        ALTER TABLE pilot_feedback ADD COLUMN operator_reply TEXT;
        ALTER TABLE pilot_feedback ADD COLUMN resolved_at_iso TEXT;
      `);
      await d1
        .prepare(
          `UPDATE pilot_feedback SET status = ?, operator_reply = ?, resolved_at_iso = ? WHERE id = ?`,
        )
        .bind('resolved', 'Fixed in latest pilot deploy', '2026-11-25T11:00:00.000Z', legacyItems[0]?.id)
        .run();

      const upgradedItems = await listPilotFeedbackForUser(d1, {
        orgId: 'org_1',
        userId: 'u_1',
        limit: 5,
      });
      expect(upgradedItems).toHaveLength(1);
      expect(upgradedItems[0]?.status).toBe('resolved');
      expect(upgradedItems[0]?.operatorReply).toBe('Fixed in latest pilot deploy');
      expect(upgradedItems[0]?.resolvedAtIso).toBe('2026-11-25T11:00:00.000Z');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
