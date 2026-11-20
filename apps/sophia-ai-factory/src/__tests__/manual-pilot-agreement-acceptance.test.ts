// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite/database';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { persistPilotAgreementAcceptance, validatePilotAgreementInput } from '@/app/api/checkout/modules/manual-pilot-agreement-acceptance';

const agreement = { accepted: true as const, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale: 'en' as const };

describe('pilot agreement acceptance', () => {
  it('rejects missing, stale, tampered and invalid locale consent before side effects', () => {
    expect(() => validatePilotAgreementInput({ ...agreement, accepted: false })).toThrow();
    expect(() => validatePilotAgreementInput({ ...agreement, version: 'stale' })).toThrow();
    expect(() => validatePilotAgreementInput({ ...agreement, hash: '0'.repeat(64) })).toThrow();
    expect(() => validatePilotAgreementInput({ ...agreement, locale: 'fr' as 'en' })).toThrow();
  });

  it('persists server timestamp and refuses mutation/deletion', async () => {
    const db = new NodeSqliteD1Database(':memory:');
    await db.prepare('INSERT INTO organizations(id,name) VALUES (?,?)').bind('o','Org').run().catch(() => undefined);
    await db.prepare('INSERT INTO users(id,email) VALUES (?,?)').bind('u','u@example.test').run().catch(() => undefined);
    await db.prepare("INSERT INTO org_members(id,org_id,user_id,role) VALUES ('m','o','u','owner')").run();
    await db.exec(`CREATE TABLE IF NOT EXISTS manual_pilot_settlements(id TEXT PRIMARY KEY,order_id TEXT UNIQUE)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS manual_pilot_terms_acceptances(id TEXT PRIMARY KEY,order_id TEXT UNIQUE,user_id TEXT,org_id TEXT,sku_code TEXT,agreement_version TEXT,agreement_hash TEXT,locale TEXT,accepted_at TEXT,channel TEXT,payment_method TEXT,legal_status TEXT)`);
    await db.exec(readFileSync('migrations/0514_manual_pilot_terms_acceptance.sql', 'utf8'));
    await db.exec("INSERT INTO manual_pilot_settlements(id,order_id) VALUES ('s','order')");
    const row = await persistPilotAgreementAcceptance({ db, orderId: 'order', userId: 'u', agreement, nowIso: '2026-11-20T00:00:00.000Z' });
    expect(row).toMatchObject({ user_id: 'u', org_id: 'o', locale: 'en', accepted_at: '2026-11-20T00:00:00.000Z', payment_method: 'offline_bank_transfer' });
    await expect(db.prepare("UPDATE manual_pilot_terms_acceptances SET locale='vi'").run()).rejects.toThrow();
    await expect(db.prepare("DELETE FROM manual_pilot_terms_acceptances").run()).rejects.toThrow();
  });
});
